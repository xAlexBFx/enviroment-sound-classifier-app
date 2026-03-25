import { AudioRecorder } from './AudioRecorder';
import { AudioProcessor } from './AudioProcessor';
import { ModelService, ClassificationResult } from './ModelService';

export class ClassificationService {
  private audioRecorder: AudioRecorder;
  private audioProcessor: AudioProcessor;
  private modelService: ModelService;
  private isInitialized = false;
  private classificationCallback: ((result: ClassificationResult) => void) | null = null;
  private realTimeVolumeCallback: ((volume: number) => void) | null = null;

  constructor() {
    this.audioRecorder = new AudioRecorder();
    this.audioProcessor = new AudioProcessor();
    this.modelService = new ModelService();
  }

  async initialize(): Promise<boolean> {
    try {
      const initialized = await this.modelService.loadModel();
      if (!initialized) {
        return false;
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Classification Service:', error);
      return false;
    }
  }

  async startClassification(callback: (result: ClassificationResult) => void, realTimeVolumeCallback?: (volume: number) => void): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Classification Service not initialized');
    }

    this.classificationCallback = callback;
    this.realTimeVolumeCallback = realTimeVolumeCallback || null;

    try {
      const started = await this.audioRecorder.startRecording(async (audioData: Float32Array) => {
        await this.processAudioChunk(audioData);
      }, this.realTimeVolumeCallback || undefined);
      
      if (started) {
        return true;
      } else {
        throw new Error('Failed to start audio recording');
      }
    } catch (error) {
      console.error('Failed to start classification:', error);
      throw error;
    }
  }

  async stopClassification(): Promise<void> {
    try {
      await this.audioRecorder.stopRecording();
      this.classificationCallback = null;
      this.realTimeVolumeCallback = null;
    } catch (error) {
      console.error('Failed to stop classification:', error);
    }
  }

  private async processAudioChunk(audioData: Float32Array): Promise<void> {
    try {
      // Calculate volume from raw audio data
      const volume = this.audioProcessor.calculateVolume(audioData);
      
      const melSpec = this.audioProcessor.processAudio(audioData);
      const reshapedData = this.audioProcessor.reshapeForModel(melSpec);
      const result = await this.modelService.predict(reshapedData, volume);
      
      if (this.classificationCallback) {
        this.classificationCallback(result);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  isClassifying(): boolean {
    return this.audioRecorder.isActive();
  }

  /**
   * Get access to the audio recorder for testing purposes
   */
  getAudioRecorder(): AudioRecorder {
    return this.audioRecorder;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getModelClassNames(): string[] {
    return this.modelService.getClassNames();
  }

  async classifySingleAudio(audioData: Float32Array): Promise<ClassificationResult> {
    if (!this.isInitialized) {
      throw new Error('Classification Service not initialized');
    }

    try {
      // Process audio to mel spectrogram
      const melSpec = this.audioProcessor.processAudio(audioData);
      
      // Reshape for model input
      const reshapedData = this.audioProcessor.reshapeForModel(melSpec);
      
      // Run inference
      const result = await this.modelService.predict(reshapedData);
      
      return result;
    } catch (error) {
      console.error('Error classifying single audio:', error);
      throw error;
    }
  }

  dispose(): void {
    this.stopClassification();
    this.modelService.dispose();
    this.isInitialized = false;
  }
}
