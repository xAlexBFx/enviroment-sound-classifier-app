import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

export interface ClassificationResult {
  className: string;
  confidence: number;
  allProbabilities: { [key: string]: number };
  volume: number; // 0-1 scale representing audio volume
}

export class ModelService {
  private model: tf.LayersModel | null = null;
  private isLoaded = false;
  
  // Urban Sound 8K class names (10 classes)
  private readonly CLASS_NAMES = [
    'air_conditioner',
    'car_horn', 
    'children_playing',
    'dog_bark',
    'drilling',
    'engine_idling',
    'gun_shot',
    'jackhammer',
    'siren',
    'street_music'
  ];

  async loadModel(): Promise<boolean> {
    try {
      // Try to initialize GPU backend first, fallback to CPU
      try {
        await tf.setBackend('webgl');
      } catch (gpuError) {
        await tf.setBackend('cpu');
      }
      
      await tf.ready();
      this.model = this.createMockModel();
      this.isLoaded = true;
      
      return true;
    } catch (error) {
      console.error('Failed to load model:', error);
      return false;
    }
  }

  private async loadModelAsset(): Promise<ArrayBuffer> {
    // This would load the actual .tflite file
    // For now, return a mock buffer
    return new ArrayBuffer(0);
  }

  private createMockModel(): tf.LayersModel {
    // Create a more efficient mock model with fewer layers
    const model = tf.sequential();
    
    // Simpler model for faster inference
    model.add(tf.layers.conv2d({
      inputShape: [128, 173, 1],
      filters: 16, // Reduced from 32
      kernelSize: [3, 3],
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    
    model.add(tf.layers.conv2d({
      filters: 32, // Reduced from 64
      kernelSize: [3, 3], // Smaller kernel
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 64, activation: 'relu' })); // Reduced from 256
    model.add(tf.layers.dropout({ rate: 0.2 })); // Reduced dropout
    model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));
    
    return model;
  }

  async predict(audioData: number[][][], volume: number): Promise<ClassificationResult> {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded');
    }

    try {
      // Optimize tensor creation - reuse tensors when possible
      const startTime = performance.now();
      
      // Pre-allocate tensor with correct shape to avoid reshaping
      const processedData = audioData.map(frame => 
        frame.map(row => Array.isArray(row) ? row : [row])
      );
      
      // Create tensor more efficiently with proper typing
      // Convert the nested array structure to flat array for tensor4d
      const flatData: number[] = [];
      for (let i = 0; i < processedData.length; i++) {
        for (let j = 0; j < processedData[i].length; j++) {
          for (let k = 0; k < processedData[i][j].length; k++) {
            flatData.push(processedData[i][j][k]);
          }
        }
      }
      
      const inputTensor = tf.tensor4d(flatData, [1, 128, 173, 1]);
      
      // Use synchronous prediction for better performance
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Find max probability more efficiently
      let maxProb = 0;
      let maxIndex = 0;
      
      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          maxIndex = i;
        }
      }
      
      const result: ClassificationResult = {
        className: this.CLASS_NAMES[maxIndex],
        confidence: maxProb,
        allProbabilities: {},
        volume: volume
      };
      
      // Pre-allocate allProbabilities object
      for (let i = 0; i < this.CLASS_NAMES.length; i++) {
        result.allProbabilities[this.CLASS_NAMES[i]] = probabilities[i];
      }
      
      // Clean up tensors immediately
      inputTensor.dispose();
      prediction.dispose();
      
      const endTime = performance.now();
      
      // Set to unknown if confidence is below 96%
      if (result.confidence < 0.96) {
        result.className = 'unknown';
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  async predictBatch(audioDataArray: number[][][][]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (const audioData of audioDataArray) {
      try {
        const result = await this.predict(audioData, 0); // Default volume for batch
        results.push(result);
      } catch (error) {
        console.error('Batch prediction failed for one item:', error);
        results.push({
          className: 'unknown',
          confidence: 0,
          allProbabilities: {},
          volume: 0
        });
      }
    }
    
    return results;
  }

  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  getClassNames(): string[] {
    return [...this.CLASS_NAMES];
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isLoaded = false;
  }
}
