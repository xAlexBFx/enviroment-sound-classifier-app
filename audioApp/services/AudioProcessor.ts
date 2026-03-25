export class AudioProcessor {
  private readonly SAMPLE_RATE = 22050;
  private readonly N_MELS = 128;
  private readonly N_FFT = 2048;
  private readonly HOP_LENGTH = 512;
  private readonly FMIN = 0;
  private readonly FMAX = 11025; // Half of sample rate

  /**
   * Convert audio signal to mel spectrogram
   * @param audioData - Float32Array of audio samples
   * @returns Mel spectrogram as Float32Array[128][173]
   */
  processAudio(audioData: Float32Array): Float32Array[] {
    // Pad or truncate to exactly 4 seconds
    const processedAudio = this.padOrTruncate(audioData);
    
    // Compute mel spectrogram
    const melSpec = this.computeMelSpectrogram(processedAudio);
    
    // Convert to dB scale
    const melSpecDb = this.powerToDb(melSpec);
    
    return melSpecDb;
  }

  /**
   * Pad or truncate audio to exactly 4 seconds (88200 samples at 22050 Hz)
   */
  private padOrTruncate(audioData: Float32Array): Float32Array {
    const targetLength = this.SAMPLE_RATE * 4; // 4 seconds
    
    if (audioData.length > targetLength) {
      // Truncate
      return audioData.slice(0, targetLength);
    } else if (audioData.length < targetLength) {
      // Pad with zeros
      const padded = new Float32Array(targetLength);
      padded.set(audioData);
      return padded;
    }
    
    return audioData;
  }

  /**
   * Compute mel spectrogram
   */
  private computeMelSpectrogram(audioData: Float32Array): Float32Array[] {
    // Compute STFT
    const stft = this.computeSTFT(audioData);
    
    // Convert to mel scale
    const melSpec = this.linearToMel(stft);
    
    return melSpec;
  }

  /**
   * Compute Short-Time Fourier Transform
   */
  private computeSTFT(audioData: Float32Array): Float32Array[] {
    const frames = this.frameSignal(audioData);
    const window = this.hannWindow(this.N_FFT);
    
    const stft: Float32Array[] = [];
    
    for (const frame of frames) {
      // Apply window
      const windowed = new Float32Array(this.N_FFT);
      for (let i = 0; i < this.N_FFT; i++) {
        windowed[i] = frame[i] * window[i];
      }
      
      // Compute FFT (simplified - using magnitude only)
      const spectrum = this.computeFFT(windowed);
      stft.push(spectrum);
    }
    
    return stft;
  }

  /**
   * Frame the signal into overlapping windows
   */
  private frameSignal(audioData: Float32Array): Float32Array[] {
    const frames: Float32Array[] = [];
    const frameLength = this.N_FFT;
    const hopLength = this.HOP_LENGTH;
    
    for (let i = 0; i < audioData.length - frameLength; i += hopLength) {
      const frame = audioData.slice(i, i + frameLength);
      frames.push(frame);
    }
    
    return frames;
  }

  /**
   * Hann window function
   */
  private hannWindow(N: number): Float32Array {
    const window = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }
    return window;
  }

  /**
   * Simplified FFT computation (magnitude only)
   */
  private computeFFT(signal: Float32Array): Float32Array {
    const N = signal.length;
    const spectrum = new Float32Array(Math.floor(N / 2) + 1);
    
    // Simplified FFT - in practice you'd use a proper FFT library
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Convert linear frequency scale to mel scale
   */
  private linearToMel(stft: Float32Array[]): Float32Array[] {
    const melSpec: Float32Array[] = [];
    
    for (const spectrum of stft) {
      const melSpectrum = new Float32Array(this.N_MELS);
      
      // Simplified mel filter bank application
      for (let m = 0; m < this.N_MELS; m++) {
        let sum = 0;
        const melFreq = this.hzToMel(this.FMIN) + m * (this.hzToMel(this.FMAX) - this.hzToMel(this.FMIN)) / (this.N_MELS - 1);
        const hzFreq = this.melToHz(melFreq);
        
        // Find corresponding bin
        const bin = Math.round(hzFreq * this.N_FFT / this.SAMPLE_RATE);
        if (bin < spectrum.length) {
          sum = spectrum[bin];
        }
        
        melSpectrum[m] = sum;
      }
      
      melSpec.push(melSpectrum);
    }
    
    return melSpec;
  }

  /**
   * Convert power to decibel scale
   */
  private powerToDb(melSpec: Float32Array[]): Float32Array[] {
    const melSpecDb: Float32Array[] = [];
    
    for (const frame of melSpec) {
      const frameDb = new Float32Array(frame.length);
      for (let i = 0; i < frame.length; i++) {
        // Add small value to avoid log(0)
        const power = Math.max(frame[i], 1e-10);
        frameDb[i] = 10 * Math.log10(power);
      }
      melSpecDb.push(frameDb);
    }
    
    return melSpecDb;
  }

  /**
   * Convert Hz to mel scale
   */
  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Convert mel to Hz scale
   */
  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Reshape mel spectrogram to match model input (128, 173, 1)
   */
  reshapeForModel(melSpec: Float32Array[]): number[][][] {
    const targetFrames = 173;
    const result: number[][][] = [];
    
    // Ensure we have exactly 173 frames
    const resized = this.resizeFrames(melSpec, targetFrames);
    
    // Convert from Float32Array[][] to number[][][]
    for (let i = 0; i < this.N_MELS; i++) {
      const row: number[][] = [];
      for (let j = 0; j < targetFrames; j++) {
        const value = resized[j][i];
        row.push([value]); // Single value array for channel dimension
      }
      result.push(row);
    }
    
    return result;
  }

  /**
   * Resize frames to target number using interpolation
   */
  private resizeFrames(frames: Float32Array[], targetLength: number): Float32Array[] {
    if (frames.length === targetLength) return frames;
    
    const result: Float32Array[] = [];
    const scale = frames.length / targetLength;
    
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = Math.floor(i * scale);
      const frame = frames[Math.min(sourceIndex, frames.length - 1)];
      result.push(frame);
    }
    
    return result;
  }
}
