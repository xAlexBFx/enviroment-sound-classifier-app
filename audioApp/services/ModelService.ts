import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

export interface ClassificationResult {
  className: string;
  confidence: number;
  allProbabilities: { [key: string]: number };
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
    // Create a mock model that matches the expected architecture
    // In practice, this would be replaced with actual TFLite loading
    const model = tf.sequential();
    
    model.add(tf.layers.conv2d({
      inputShape: [128, 173, 1],
      filters: 32,
      kernelSize: [3, 3],
      activation: 'relu'
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    
    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: [5, 5],
      activation: 'relu'
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    
    model.add(tf.layers.conv2d({
      filters: 128,
      kernelSize: [3, 3],
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));
    
    return model;
  }

  async predict(audioData: number[][]): Promise<ClassificationResult> {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded');
    }

    try {
      const processedData = audioData.map(frame => 
        frame.map(row => Array.isArray(row) ? row : [row])
      );
      const inputTensor = tf.tensor4d([processedData]);
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
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
        allProbabilities: {}
      };
      
      for (let i = 0; i < this.CLASS_NAMES.length; i++) {
        result.allProbabilities[this.CLASS_NAMES[i]] = probabilities[i];
      }
      
      inputTensor.dispose();
      prediction.dispose();
      
      return result;
    } catch (error) {
      console.error('Prediction failed:', error);
      throw error;
    }
  }

  async predictBatch(audioDataArray: number[][][]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (const audioData of audioDataArray) {
      try {
        const result = await this.predict(audioData);
        results.push(result);
      } catch (error) {
        console.error('Batch prediction failed for one item:', error);
        results.push({
          className: 'unknown',
          confidence: 0,
          allProbabilities: {}
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
