import { AudioRecorder } from './AudioRecorder';

export interface ClassificationResult {
  className: string;
  confidence: number;
  allProbabilities: { [key: string]: number };
  volume: number;
}

export class ClassificationService {
  private audioRecorder: AudioRecorder;
  private isInitialized = false;
  private classificationCallback: ((result: ClassificationResult) => void) | null = null;
  private realTimeVolumeCallback: ((volume: number) => void) | null = null;
  private backendUrl: string;

  constructor(backendUrl: string = 'http://localhost:5000') {
    this.audioRecorder = new AudioRecorder();
    this.backendUrl = backendUrl;
  }

  async initialize(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      if (response.ok) {
        this.isInitialized = true;
        return true;
      } else {
        console.error('Backend health check failed');
        return false;
      }
    } catch (error) {
      console.error('Failed to connect to backend:', error);
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
      const volume = this.calculateVolume(audioData);
      const result = await this.classifyWithBackend(audioData, volume);
      
      if (this.classificationCallback) {
        this.classificationCallback(result);
      }

      if (this.realTimeVolumeCallback) {
        this.realTimeVolumeCallback(volume);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private calculateVolume(audioData: Float32Array): number {
    if (audioData.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    return Math.min(rms * 10, 1);
  }

  private async classifyWithBackend(audioData: Float32Array, volume: number): Promise<ClassificationResult> {
    try {
      const base64Audio = this.float32ToBase64(audioData);
      
      const response = await fetch(`${this.backendUrl}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();

      return {
        className: data.className,
        confidence: data.confidence,
        allProbabilities: data.allProbabilities || {},
        volume: volume,
      };
    } catch (error) {
      console.error('Backend classification failed:', error);
      return {
        className: 'unknown',
        confidence: 0,
        allProbabilities: {},
        volume: volume,
      };
    }
  }

  private float32ToBase64(float32Array: Float32Array): string {
    const buffer = float32Array.buffer;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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

  async getModelClassNames(): Promise<string[]> {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        return data.classes || [];
      }
    } catch (error) {
      console.error('Failed to get class names:', error);
    }
    return [];
  }

  async classifySingleAudio(audioData: Float32Array): Promise<ClassificationResult> {
    if (!this.isInitialized) {
      throw new Error('Classification Service not initialized');
    }

    const volume = this.calculateVolume(audioData);
    return await this.classifyWithBackend(audioData, volume);
  }

  async updateBackendUrl(newUrl: string): Promise<boolean> {
    this.backendUrl = newUrl;
    this.isInitialized = false;
    return await this.initialize();
  }

  getBackendUrl(): string {
    return this.backendUrl;
  }

  dispose(): void {
    this.stopClassification();
    this.isInitialized = false;
  }
}
