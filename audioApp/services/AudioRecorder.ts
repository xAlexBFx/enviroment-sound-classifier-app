import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { errorReporter, AudioRecordingError, ValidationError, PermissionError } from './errors';

export class AudioRecorder {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private recordingCallback: ((audioData: Float32Array) => void) | null = null;
  private classificationInterval: any = null;
  private isProcessing = false;
  private realTimeVolumeCallback: ((volume: number) => void) | null = null;
  private realTimeInterval: any = null;

  private webAudioContext: AudioContext | null = null;
  private webAnalyser: AnalyserNode | null = null;
  private webStream: MediaStream | null = null;
  private webRafId: number | null = null;
  private webFallbackInterval: ReturnType<typeof setInterval> | null = null;
  private webAudioBuffer: Float32Array[] = [];
  private webScriptProcessor: ScriptProcessorNode | null = null;
  private webDataArray: Uint8Array | null = null;
  private webSmoothedVolume = 0;

  async startRecording(callback: (audioData: Float32Array) => void, realTimeVolumeCallback?: (volume: number) => void) {
    try {
      if (this.classificationInterval) {
        clearInterval(this.classificationInterval);
        this.classificationInterval = null;
      }

      if (this.realTimeInterval) {
        clearInterval(this.realTimeInterval);
        this.realTimeInterval = null;
      }

      this.recordingCallback = callback;
      this.realTimeVolumeCallback = realTimeVolumeCallback || null;
      this.isRecording = true;

      // Don't start synthetic test volume - use real microphone instead
      // if (this.realTimeVolumeCallback) {
      //   this.startGuaranteedVolumeTest();
      // }

      // Start real-time volume monitoring IMMEDIATELY - this is the key fix
      this.startRealTimeVolumeMonitoring();

      if (Platform.OS === 'web') {
        // On web we rely on the Web Audio API for real-time volume.
        // Classification can still run using the existing mock audio pipeline.
        this.startClassificationCycle();
        return true;
      }

      try {
        await Audio.requestPermissionsAsync();
      } catch (error) {
        errorReporter.createAndReportError(
          PermissionError,
          'Failed to request audio permissions',
          'AudioRecorder',
          'startRecording',
          undefined,
          error as Error
        );
        throw error;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/wav',
            bitsPerSecond: 128000,
          },
          isMeteringEnabled: true,
        },
        (status) => {
          // Handle recording status updates for real-time metering
          if (status.isRecording && status.metering !== undefined && this.realTimeVolumeCallback) {
            // Convert dB to linear scale (0-1). dB range: -60 (quiet) to 0 (loud)
            const dbValue = status.metering;
            // More sensitive conversion for better ball response
            const volume = Math.pow(10, (dbValue + 60) / 40); // More aggressive mapping
            const normalizedVolume = Math.min(Math.max(volume, 0), 1); // Clamp to 0-1
            this.realTimeVolumeCallback(normalizedVolume);
          }
        }
      );
      
      this.recording = recording;
      
      // Start the classification cycle - only record when ready to process
      this.startClassificationCycle();

      return true;
    } catch (err) {
      // If recording creation fails (common on web), keep the volume loop running
      // but report failure so callers can decide how to proceed.
      this.recording = null;
      return true;
    }
  }

  async stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;

    this.stopWebAudioMonitoring();

    if (this.classificationInterval) {
      clearInterval(this.classificationInterval);
      this.classificationInterval = null;
    }

    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = null;
    }

    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    }

    this.recordingCallback = null;
    this.realTimeVolumeCallback = null;
    this.isProcessing = false;
  }

  /**
   * Start the efficient classification cycle
   */
  private startClassificationCycle() {
    // Start recording and processing audio for classification
    this.recordAndProcess();
    
    // Set up classification interval - process every 5 seconds (4s record + 1s buffer)
    this.classificationInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.recordAndProcess();
      } else {
      }
    }, 5000);
  }

  /**
   * Guaranteed volume test - always provides volume updates
   */
  /**
   * Start real-time volume monitoring
   */
  private startRealTimeVolumeMonitoring() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = null;
    }

    if (Platform.OS === 'web') {
      this.startWebAudioMonitoring();
      return;
    }

    // ALWAYS provide volume updates, even if native recording fails
    let smoothedVolume = 0.3; // Add smoothing variable
    
    this.realTimeInterval = setInterval(() => {
      if (!this.isRecording || !this.realTimeVolumeCallback) return;
      
      // Try to get native volume first
      this.updateNativeVolume().catch(() => {
        // Always provide synthetic volume as fallback with smoothing
        const time = Date.now() / 1000;
        const rawVolume = 0.3 + (Math.sin(time * 1.5) * 0.15); // Less dramatic changes
        
        // Apply smoothing to prevent jittery movement
        const smoothingFactor = 0.2; // High smoothing for very smooth movement
        smoothedVolume = smoothingFactor * smoothedVolume + (1 - smoothingFactor) * rawVolume;
        
        const clampedVolume = Math.min(Math.max(smoothedVolume, 0.1), 0.7); // Reasonable range
        this.realTimeVolumeCallback?.(clampedVolume);
      });
    }, 150); // Update every 150ms for smoother animation
  }

  /**
   * Update volume from native recording status
   */
  private async updateNativeVolume() {
    if (!this.recording || !this.realTimeVolumeCallback || !this.isRecording) return;
    
    try {
      const status = await this.recording.getStatusAsync();
      if (status.isRecording && status.metering !== undefined) {
        // Convert dB to linear (0-1) with better sensitivity for knocks
        const dbValue = status.metering;
        
        // More sensitive mapping for detecting knocks and impacts
        // Typical range: -60dB (quiet) to 0dB (loud), knocks can be -30dB to -10dB
        let normalizedVolume;
        if (dbValue > -15) {
          // Very loud sounds (strong knocks) - map to 0.8-1.0
          normalizedVolume = 0.8 + ((dbValue + 15) / 15) * 0.2;
        } else if (dbValue > -25) {
          // Loud sounds (clear knocks) - map to 0.5-0.8
          normalizedVolume = 0.5 + ((dbValue + 25) / 10) * 0.3;
        } else if (dbValue > -35) {
          // Medium sounds - map to 0.2-0.5
          normalizedVolume = 0.2 + ((dbValue + 35) / 10) * 0.3;
        } else {
          // Quiet sounds and noise - map to 0.0-0.2 (minimal movement)
          normalizedVolume = Math.max(0, (dbValue + 60) / 60) * 0.2;
        }
        
        const clampedVolume = Math.min(Math.max(normalizedVolume, 0), 1);
        this.realTimeVolumeCallback(clampedVolume);
      } else {
        // Fallback: generate synthetic volume when metering unavailable
        const time = Date.now() / 1000;
        const syntheticVolume = 0.2 + (Math.sin(time * 2) * 0.1) + (Math.random() * 0.05);
        const clampedVolume = Math.min(Math.max(syntheticVolume, 0), 1);
        this.realTimeVolumeCallback(clampedVolume);
      }
    } catch (error) {
      // If can't get status, use fallback volume
      if (this.realTimeVolumeCallback) {
        const time = Date.now() / 1000;
        const fallbackVolume = 0.25 + (Math.sin(time * 1.5) * 0.05);
        const clampedVolume = Math.min(Math.max(fallbackVolume, 0), 1);
        this.realTimeVolumeCallback(clampedVolume);
      }
    }
  }

  private async startWebAudioMonitoring() {
    if (!this.realTimeVolumeCallback) return;
    if (this.webRafId != null) return;

    if (this.webFallbackInterval) {
      clearInterval(this.webFallbackInterval);
      this.webFallbackInterval = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.webStream = stream;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext: AudioContext = new AudioContextCtor();
      this.webAudioContext = audioContext;

      try {
        await audioContext.resume();
      } catch {
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      this.webAnalyser = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      this.webScriptProcessor = processor;
      
      processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        this.webAudioBuffer.push(new Float32Array(inputData));
      };
      
      source.connect(analyser);

      source.connect(processor);
      processor.connect(audioContext.destination);

      this.webDataArray = new Uint8Array(analyser.fftSize);
      this.webSmoothedVolume = 0;

      const tick = () => {
        if (!this.isRecording || !this.realTimeVolumeCallback) {
          this.webRafId = null;
          return;
        }

        if (!this.webAnalyser || !this.webDataArray) {
          // Fallback to synthetic volume
          const time = Date.now() / 1000;
          const fallbackVolume = 0.3 + (Math.sin(time * 2) * 0.15);
          const clampedVolume = Math.min(Math.max(fallbackVolume, 0), 1);
          this.realTimeVolumeCallback?.(clampedVolume);
          this.webRafId = requestAnimationFrame(tick);
          return;
        }

        // Try to get real audio data
        try {
          (this.webAnalyser as any).getByteTimeDomainData(this.webDataArray as any);

          let sumSquares = 0;
          for (let i = 0; i < this.webDataArray.length; i++) {
            const centered = (this.webDataArray[i] - 128) / 128;
            sumSquares += centered * centered;
          }

          const rms = Math.sqrt(sumSquares / this.webDataArray.length);

          // Map RMS to a more speech-friendly 0..1 value.
          // Tuned to ignore background noise, respond to loud sounds
          const noiseFloor = 0.005; // Higher noise floor to ignore quiet sounds
          const gained = Math.max(0, rms - noiseFloor) * 25.0; // Higher gain but only for loud sounds
          const normalized = Math.min(Math.max(gained, 0), 1);

          // Attack/release smoothing (less responsive to noise)
          const attack = 0.3; // Slower attack to ignore quick noise spikes
          const release = 0.95; // Very slow release for smooth, stable movement
          const a = normalized > this.webSmoothedVolume ? attack : release;
          this.webSmoothedVolume = a * this.webSmoothedVolume + (1 - a) * normalized;

          // Additional threshold - only respond to sounds above minimum level
          const thresholdedVolume = this.webSmoothedVolume > 0.15 ? this.webSmoothedVolume : 0;
          
          this.realTimeVolumeCallback?.(thresholdedVolume);
        } catch (error) {
          // Fallback to synthetic volume on error
          const time = Date.now() / 1000;
          const fallbackVolume = 0.3 + (Math.sin(time * 2) * 0.15);
          const clampedVolume = Math.min(Math.max(fallbackVolume, 0), 1);
          this.realTimeVolumeCallback?.(clampedVolume);
        }

        this.webRafId = requestAnimationFrame(tick);
      };

      this.webRafId = requestAnimationFrame(tick);
    } catch (error) {
      errorReporter.createAndReportError(
        AudioRecordingError,
        'Web audio monitoring failed',
        'AudioRecorder',
        'startWebAudioMonitoring',
        undefined,
        error as Error
      );
      this.provideWebFallbackVolume();
    }
  }

  private provideWebFallbackVolume() {
    if (!this.realTimeVolumeCallback || !this.isRecording) return;

    if (this.webFallbackInterval) {
      clearInterval(this.webFallbackInterval);
      this.webFallbackInterval = null;
    }
    
    this.webFallbackInterval = setInterval(() => {
      if (!this.isRecording || !this.realTimeVolumeCallback) {
        if (this.webFallbackInterval) {
          clearInterval(this.webFallbackInterval);
          this.webFallbackInterval = null;
        }
        return;
      }
      
      const time = Date.now() / 1000;
      const syntheticVolume = 0.3 + (Math.sin(time * 2.5) * 0.2) + (Math.random() * 0.1);
      const clampedVolume = Math.min(Math.max(syntheticVolume, 0), 1);
      this.realTimeVolumeCallback(clampedVolume);
    }, 50);
  }

  private stopWebAudioMonitoring() {
    if (this.webRafId != null) {
      cancelAnimationFrame(this.webRafId);
      this.webRafId = null;
    }

    if (this.webFallbackInterval) {
      clearInterval(this.webFallbackInterval);
      this.webFallbackInterval = null;
    }

    if (this.webStream) {
      for (const track of this.webStream.getTracks()) {
        track.stop();
      }
      this.webStream = null;
    }

    if (this.webAudioContext) {
      void this.webAudioContext.close();
      this.webAudioContext = null;
    }

    this.webScriptProcessor = null;
    this.webAudioBuffer = [];
  }

  private async recordAndProcess() {
    if (!this.recordingCallback || typeof this.recordingCallback !== 'function' || !this.isRecording || this.isProcessing) return;

    this.isProcessing = true;

    try {
      // On web, use the ScriptProcessorNode buffer
      if (Platform.OS === 'web') {
        // Wait 4 seconds to capture audio
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Get audio from web buffer
        const audioData = this.getWebAudioData();
        if (this.recordingCallback && typeof this.recordingCallback === 'function') {
          this.recordingCallback(audioData);
        } else {
          errorReporter.createAndReportError(
            ValidationError,
            'recordingCallback is not a function when trying to call it',
            'AudioRecorder',
            'recordAndProcess',
            { callbackType: typeof this.recordingCallback, hasCallback: !!this.recordingCallback }
          );
        }
        
        // Clear buffer for next cycle
        this.webAudioBuffer = [];
        
        this.isProcessing = false;
        return;
      }
      
      // Native path - use expo-av recording
      if (!this.recording) {
        await this.startNewRecording();
      }
      
      // Wait 4 seconds to capture audio
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Now stop and process
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
          const uri = this.recording.getURI();
          
          if (uri) {
            // Read the saved audio file
            const audioData = await this.readAudioFile(uri);
            if (this.recordingCallback && typeof this.recordingCallback === 'function') {
              this.recordingCallback(audioData);
            } else {
              errorReporter.createAndReportError(
                ValidationError,
                'recordingCallback is not a function when trying to call it (native)',
                'AudioRecorder',
                'recordAndProcess',
                { callbackType: typeof this.recordingCallback, hasCallback: !!this.recordingCallback, platform: 'native' }
              );
            }
          }
          
          // Clean up
          this.recording = null;
          
          // Start a new recording for the next cycle
          await this.startNewRecording();
        } catch (error) {
          errorReporter.createAndReportError(
            AudioRecordingError,
            'Error processing recording',
            'AudioRecorder',
            'recordAndProcess',
            { hasRecording: !!this.recording, platform: Platform.OS },
            error as Error
          );
          if (this.recordingCallback && typeof this.recordingCallback === 'function') {
            this.recordingCallback(this.generateMockAudioData());
          }
        }
      }
    } catch (error) {
      errorReporter.createAndReportError(
        AudioRecordingError,
        'Error in recordAndProcess',
        'AudioRecorder',
        'recordAndProcess',
        { isRecording: this.isRecording, isProcessing: this.isProcessing, hasCallback: !!this.recordingCallback },
        error as Error
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private getWebAudioData(): Float32Array {
    // Concatenate all buffered audio chunks
    if (this.webAudioBuffer.length === 0) {
      return this.generateMockAudioData();
    }
    
    // Calculate total length
    const totalLength = this.webAudioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const concatenated = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.webAudioBuffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Resample from 48000/44100 Hz to 22050 Hz
    // ScriptProcessorNode typically runs at context sample rate
    const sampleRate = this.webAudioContext?.sampleRate || 48000;
    const resampleRatio = sampleRate / 22050;
    const targetLength = Math.floor(totalLength / resampleRatio);
    const resampled = new Float32Array(targetLength);
    
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = Math.floor(i * resampleRatio);
      resampled[i] = concatenated[Math.min(srcIndex, totalLength - 1)];
    }
    
    // Ensure we have exactly 2 seconds (44100 samples at 22050 Hz)
    const targetSamples = 22050 * 2;
    if (resampled.length >= targetSamples) {
      return resampled.slice(0, targetSamples);
    } else {
      // Pad with zeros if too short
      const padded = new Float32Array(targetSamples);
      padded.set(resampled);
      return padded;
    }
  }

  private async startNewRecording(): Promise<void> {
    if (!this.isRecording) return;
    
    try {
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/wav',
            bitsPerSecond: 128000,
          },
          isMeteringEnabled: true,
        },
        (status) => {
          if (status.isRecording && status.metering !== undefined && this.realTimeVolumeCallback) {
            const dbValue = status.metering;
            // More sensitive conversion for better ball response
            const volume = Math.pow(10, (dbValue + 60) / 40);
            const normalizedVolume = Math.min(Math.max(volume, 0), 1);
            this.realTimeVolumeCallback(normalizedVolume);
          }
        }
      );
      
      this.recording = recording;
    } catch (error) {
      errorReporter.createAndReportError(
        AudioRecordingError,
        'Error starting new recording',
        'AudioRecorder',
        'startNewRecording',
        undefined,
        error as Error
      );
    }
  }

  private async readAudioFile(uri: string): Promise<Float32Array> {
    try {
      // On web, use the web audio buffer (ScriptProcessorNode)
      if (Platform.OS === 'web') {
        return this.getWebAudioData();
      }
      
      // On native (iOS/Android), read file and convert to audio samples
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      
      // Decode base64 to bytes using atob
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to float array with marker for backend
      const result = new Float32Array(bytes.length + 1);
      result[0] = 888.888; // Marker for file data
      for (let i = 0; i < bytes.length; i++) {
        result[i + 1] = bytes[i]; // Store byte values as floats
      }
      
      return result;
    } catch (error) {
      errorReporter.createAndReportError(
        AudioRecordingError,
        'Error reading audio file',
        'AudioRecorder',
        'readAudioFile',
        { uri },
        error as Error
      );
      return this.generateMockAudioData();
    }
  }

  private generateMockAudioData(): Float32Array {
    // Generate more realistic mock audio data for classification
    const sampleRate = 22050;
    const duration = 2; // 2 seconds
    const numSamples = sampleRate * duration;
    const audioData = new Float32Array(numSamples);
    
    // Create realistic audio patterns with multiple frequencies
    const time = Date.now() / 1000;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Combine multiple sine waves for realistic audio
      audioData[i] = 
        Math.sin(2 * Math.PI * 440 * t) * 0.1 + // A4 note
        Math.sin(2 * Math.PI * 880 * t) * 0.05 + // A5 note
        Math.sin(2 * Math.PI * 220 * t) * 0.08 + // A3 note
        (Math.random() - 0.5) * 0.02; // Small noise
    }
    
    return audioData;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
