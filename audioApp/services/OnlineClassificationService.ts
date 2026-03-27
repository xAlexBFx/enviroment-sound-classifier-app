import { ClassificationResult } from './ClassificationService';
import { errorReporter, NetworkError, ClassificationError, ValidationError } from './errors';

export class OnlineClassificationService {
  private backendUrl: string;
  private isInitialized = false;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  async initialize(): Promise<boolean> {
    try {
      // Test connection to backend
      const response = await fetch(`${this.backendUrl}/health`);
      if (response.ok) {
        this.isInitialized = true;
        return true;
      } else {
        errorReporter.createAndReportError(
          NetworkError,
          'Backend health check failed',
          'OnlineClassificationService',
          'initialize',
          { status: response.status, backendUrl: this.backendUrl }
        );
        return false;
      }
    } catch (error) {
      errorReporter.createAndReportError(
        NetworkError,
        'Failed to connect to backend',
        'OnlineClassificationService',
        'initialize',
        { backendUrl: this.backendUrl },
        error as Error
      );
      return false;
    }
  }

  async classifyAudio(audioData: Float32Array): Promise<ClassificationResult> {
    if (!this.isInitialized) {
      throw new Error('Online service not initialized');
    }

    try {
      // Validate audio data
      if (!audioData || audioData.length === 0) {
        errorReporter.createAndReportError(
          ValidationError,
          'Invalid audio data provided for classification',
          'OnlineClassificationService',
          'classifyAudio',
          { audioDataLength: audioData?.length || 0 }
        );
        throw new Error('Invalid audio data');
      }

      // Convert Float32Array to base64
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
        errorReporter.createAndReportError(
          NetworkError,
          `Backend classification error: ${response.status}`,
          'OnlineClassificationService',
          'classifyAudio',
          { status: response.status, backendUrl: this.backendUrl }
        );
        throw new Error(`Backend error: ${response.status}`);
      }

      const result = await response.json();
      
      // Convert backend response to ClassificationResult format
      return {
        className: result.className,
        confidence: result.confidence,
        allProbabilities: result.allProbabilities || {},
        volume: 0, // Backend doesn't provide volume, set to 0
      };
    } catch (error) {
      errorReporter.createAndReportError(
        ClassificationError,
        'Online classification failed',
        'OnlineClassificationService',
        'classifyAudio',
        { audioDataLength: audioData?.length || 0, backendUrl: this.backendUrl },
        error as Error
      );
      throw error;
    }
  }

  async classifyAudioBatch(audioDataArray: Float32Array[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (const audioData of audioDataArray) {
      try {
        const result = await this.classifyAudio(audioData);
        results.push(result);
      } catch (error) {
        console.error('Batch classification failed for one item:', error);
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

  isReady(): boolean {
    return this.isInitialized;
  }

  async updateBackendUrl(newUrl: string): Promise<boolean> {
    this.backendUrl = newUrl;
    this.isInitialized = false;
    return await this.initialize();
  }

  getBackendUrl(): string {
    return this.backendUrl;
  }

  private float32ToBase64(float32Array: Float32Array): string {
    // Convert Float32Array to ArrayBuffer, then to base64
    const buffer = float32Array.buffer;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  dispose(): void {
    this.isInitialized = false;
  }
}
