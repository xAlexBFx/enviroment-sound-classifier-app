import { ClassificationResult } from './ClassificationService';

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
        console.error('Backend health check failed');
        return false;
      }
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      return false;
    }
  }

  async classifyAudio(audioData: Float32Array): Promise<ClassificationResult> {
    if (!this.isInitialized) {
      throw new Error('Online service not initialized');
    }

    try {
      // Convert Float32Array to base64
      const base64Audio = this.float32ToBase64(audioData);
      
      console.log('🎤 Sending classification request to backend...');
      
      const response = await fetch(`${this.backendUrl}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
        }),
      });

      console.log('🎤 Classification request sent, waiting for response...');

      if (!response.ok) {
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
      console.error('Online classification failed:', error);
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
