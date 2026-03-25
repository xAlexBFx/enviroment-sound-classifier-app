export class AudioProcessor {
  private readonly SAMPLE_RATE = 22050;
  private readonly N_MELS = 128;
  private readonly N_FFT = 2048;
  private readonly HOP_LENGTH = 512;
  private readonly FMIN = 0;
  private readonly FMAX = 11025; // Half of sample rate

  /**
   * Calculate RMS volume from audio data
   */
  calculateVolume(audioData: Float32Array): number {
    if (audioData.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    
    const rms = Math.sqrt(sum / audioData.length);
    return Math.min(rms * 10, 1); // Scale and clamp to 0-1
  }

  /**
   * Convert audio signal to mel spectrogram
   * @param audioData - Float32Array of audio samples
   * @returns Mel spectrogram as number[][]
   */
  processAudio(audioData: Float32Array): number[][] {
    // Pad or truncate to exactly 4 seconds
    const processedAudio = this.padOrTruncate(audioData);
    
    // Compute mel spectrogram
    const melSpec = this.computeMelSpectrogram(processedAudio);
    
    // Convert to dB scale
    const melSpecDb = this.powerToDb(melSpec);
    
    return melSpecDb;
  }

  /**
   * Pad or truncate audio to exactly 2 seconds (44100 samples at 22050 Hz)
   */
  private padOrTruncate(audioData: Float32Array): Float32Array {
    const targetLength = this.SAMPLE_RATE * 2; // Changed to 2 seconds
    
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
  private computeMelSpectrogram(audioData: Float32Array): number[][] {
    // Compute STFT
    const stft = this.computeSTFT(audioData);
    
    // Convert to mel scale
    const melSpec = this.linearToMel(stft);
    
    return melSpec;
  }

  /**
   * Compute Short-Time Fourier Transform
   */
  private computeSTFT(audioData: Float32Array): number[][] {
    const frameLength = 2048;
    const hopLength = 512;
    const numFrames = Math.ceil((audioData.length - frameLength) / hopLength) + 1;
    const window = this.hannWindow(frameLength);
    
    const spectrogram: number[][] = [];
    
    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopLength;
      const end = start + frameLength;
      
      if (end > audioData.length) break;
      
      const frameData = audioData.slice(start, end);
      const windowedFrame = this.applyWindow(frameData, window);
      const fftResult = this.simplifiedFFT(windowedFrame);
      
      // Only keep first half (positive frequencies)
      const halfLength = Math.floor(frameLength / 2) + 1;
      const magnitudes = new Float32Array(halfLength);
      
      for (let i = 0; i < halfLength; i++) {
        magnitudes[i] = fftResult[i];
      }
      
      spectrogram.push(Array.from(magnitudes));
    }
    
    return spectrogram;
  }

  /**
   * Hann window function
   */
  private hannWindow(N: number): Float32Array {
    const window = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
    }
    return window;
  }

  /**
   * Apply window to signal
   */
  private applyWindow(signal: Float32Array, window: Float32Array): Float32Array {
    const windowed = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
      windowed[i] = signal[i] * window[i];
    }
    return windowed;
  }

  /**
   * Optimized FFT with window function and caching
   */
  private simplifiedFFT(signal: Float32Array): Float32Array {
    const N = signal.length;
    const magnitudes = new Float32Array(N);
    
    // Pre-compute constants
    const twoPiOverN = (2 * Math.PI) / N;
    const sqrtN = Math.sqrt(N);
    
    // Use vectorized operations where possible
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      const kTimesTwoPiOverN = k * twoPiOverN;
      
      // Unroll inner loop for better performance
      const unrollBy = 4;
      for (let n = 0; n < N - unrollBy; n += unrollBy) {
        // Process 4 samples at once
        real += signal[n] * Math.cos(n * kTimesTwoPiOverN);
        imag -= signal[n] * Math.sin(n * kTimesTwoPiOverN);
        real += signal[n + 1] * Math.cos((n + 1) * kTimesTwoPiOverN);
        imag -= signal[n + 1] * Math.sin((n + 1) * kTimesTwoPiOverN);
        real += signal[n + 2] * Math.cos((n + 2) * kTimesTwoPiOverN);
        imag -= signal[n + 2] * Math.sin((n + 2) * kTimesTwoPiOverN);
        real += signal[n + 3] * Math.cos((n + 3) * kTimesTwoPiOverN);
        imag -= signal[n + 3] * Math.sin((n + 3) * kTimesTwoPiOverN);
      }
      
      // Handle remaining samples
      for (let n = N - (N % unrollBy); n < N; n++) {
        const angle = k * n * twoPiOverN;
        real += signal[n] * Math.cos(angle);
        imag -= signal[n] * Math.sin(angle);
      }
      
      magnitudes[k] = Math.sqrt(real * real + imag * imag) / sqrtN;
    }
    
    return magnitudes;
  }

  /**
   * Optimized mel conversion with precomputed filters
   */
  private linearToMel(stft: number[][]): number[][] {
    const melSpec: number[][] = [];
    
    // Precompute mel filter bank for better performance
    const melFilterBank = this.getMelFilterBank();
    
    for (const spectrum of stft) {
      const melSpectrum: number[] = new Array(this.N_MELS);
      
      // Apply precomputed mel filters
      for (let m = 0; m < this.N_MELS; m++) {
        const filter = melFilterBank[m];
        let sum = 0;
        
        // Apply filter weights
        for (let i = filter.startBin; i <= filter.endBin; i++) {
          if (i < spectrum.length) {
            sum += spectrum[i] * filter.weights[i - filter.startBin];
          }
        }
        
        melSpectrum[m] = sum;
      }
      
      melSpec.push(melSpectrum);
    }
    
    return melSpec;
  }
  
  /**
   * Get precomputed mel filter bank
   */
  private melFilterBank: Array<{startBin: number, endBin: number, weights: number[]}> | null = null;
  
  private getMelFilterBank() {
    if (this.melFilterBank) return this.melFilterBank;
    
    this.melFilterBank = [];
    
    for (let m = 0; m < this.N_MELS; m++) {
      const melFreq = this.hzToMel(this.FMIN) + m * (this.hzToMel(this.FMAX) - this.hzToMel(this.FMIN)) / (this.N_MELS - 1);
      const hzFreq = this.melToHz(melFreq);
      const bin = Math.round(hzFreq * this.N_FFT / this.SAMPLE_RATE);
      
      // Create simple triangular filter
      const startBin = Math.max(0, bin - 2);
      const endBin = Math.min(this.N_FFT / 2, bin + 2);
      const weights: number[] = [];
      
      for (let i = startBin; i <= endBin; i++) {
        const distance = Math.abs(i - bin);
        weights.push(Math.max(0, 1 - distance / 2));
      }
      
      this.melFilterBank.push({ startBin, endBin, weights });
    }
    
    return this.melFilterBank;
  }

  /**
   * Convert power to dB scale
   */
  private powerToDb(melSpec: number[][]): number[][] {
    const melSpecDb: number[][] = [];
    
    for (const frame of melSpec) {
      const frameDb: number[] = [];
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
   * Reshape mel spectrogram to match model input (128, 173, 1) - optimized
   */
  reshapeForModel(melSpec: number[][]): number[][][] {
    const targetFrames = 173;
    const result: number[][][] = [];
    
    // Ensure we have exactly 173 frames - optimized resizing
    const resized = this.resizeFramesOptimized(melSpec, targetFrames);
    
    // Convert from number[][] to number[][][] more efficiently
    for (let i = 0; i < this.N_MELS; i++) {
      const row: number[][] = new Array(targetFrames);
      for (let j = 0; j < targetFrames; j++) {
        row[j] = [resized[j][i]]; // Single value array for channel dimension
      }
      result.push(row);
    }
    
    return result;
  }

  /**
   * Optimized frame resizing with better interpolation
   */
  private resizeFramesOptimized(frames: number[][], targetLength: number): number[][] {
    if (frames.length === targetLength) return frames;
    
    const result: number[][] = new Array(targetLength);
    const scale = frames.length / targetLength;
    
    // Use linear interpolation for better quality
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = i * scale;
      const lowerIndex = Math.floor(sourceIndex);
      const upperIndex = Math.min(lowerIndex + 1, frames.length - 1);
      const fraction = sourceIndex - lowerIndex;
      
      if (lowerIndex === upperIndex) {
        result[i] = frames[lowerIndex];
      } else {
        // Linear interpolation between frames
        const lowerFrame = frames[lowerIndex];
        const upperFrame = frames[upperIndex];
        const interpolatedFrame: number[] = new Array(lowerFrame.length);
        
        for (let j = 0; j < lowerFrame.length; j++) {
          interpolatedFrame[j] = lowerFrame[j] * (1 - fraction) + upperFrame[j] * fraction;
        }
        
        result[i] = interpolatedFrame;
      }
    }
    
    return result;
  }
}
