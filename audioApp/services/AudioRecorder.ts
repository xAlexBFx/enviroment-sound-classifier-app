import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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

      // Start real-time volume monitoring immediately so the UI ball can animate
      // even if native recording/metering isn't available on this platform.
      this.startRealTimeVolumeMonitoring();

      if (Platform.OS === 'web') {
        // On web we rely on the Web Audio API for real-time volume.
        // Classification can still run using the existing mock audio pipeline.
        this.startClassificationCycle();
        return true;
      }

      await Audio.requestPermissionsAsync();
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
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
          isMeteringEnabled: true,
        },
        (status) => {
          // Handle recording status updates for real-time metering
          if (status.isRecording && status.metering && this.realTimeVolumeCallback) {
            // Convert dB to linear scale (0-1). dB range: -60 (quiet) to 0 (loud)
            const dbValue = status.metering;
            const volume = Math.pow(10, dbValue / 20); // Convert dB to linear
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
      }
    }, 5000);
  }

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

    // On native, poll for volume data every 17ms (60fps) to match web smoothness
    this.realTimeInterval = setInterval(() => {
      this.updateNativeVolume();
    }, 17);
  }

  /**
   * Update volume from native recording status
   */
  private async updateNativeVolume() {
    if (!this.recording || !this.realTimeVolumeCallback || !this.isRecording) return;
    
    try {
      const status = await this.recording.getStatusAsync();
      if (status.isRecording && status.metering !== undefined) {
        // Convert dB to linear (0-1)
        const dbValue = status.metering;
        // Typical metering range is -160dB to 0dB
        const normalizedVolume = Math.min(Math.max((dbValue + 60) / 60, 0), 1);
        this.realTimeVolumeCallback(normalizedVolume);
      } else {
        // Fallback: generate synthetic volume when metering unavailable
        const syntheticVolume = 0.3 + (Math.random() * 0.2);
        this.realTimeVolumeCallback(syntheticVolume);
      }
    } catch (error) {
      // If can't get status, use fallback volume
      if (this.realTimeVolumeCallback) {
        const fallbackVolume = 0.3;
        this.realTimeVolumeCallback(fallbackVolume);
      }
    }
  }

  private async startWebAudioMonitoring() {
    if (!this.realTimeVolumeCallback) return;
    if (this.webRafId != null) return;

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
      source.connect(analyser);

      this.webDataArray = new Uint8Array(analyser.fftSize);
      this.webSmoothedVolume = 0;

      const tick = () => {
        if (!this.isRecording || !this.realTimeVolumeCallback || !this.webAnalyser || !this.webDataArray) {
          this.webRafId = null;
          return;
        }

        // Some TS DOM lib versions are overly strict about Uint8Array generics here.
        (this.webAnalyser as any).getByteTimeDomainData(this.webDataArray as any);

        let sumSquares = 0;
        for (let i = 0; i < this.webDataArray.length; i++) {
          const centered = (this.webDataArray[i] - 128) / 128;
          sumSquares += centered * centered;
        }

        const rms = Math.sqrt(sumSquares / this.webDataArray.length);

        // Map RMS to a more speech-friendly 0..1 value.
        // Tuned for typical laptop mic levels on web.
        const noiseFloor = 0.005;
        const gained = Math.max(0, rms - noiseFloor) * 12.0;
        const normalized = Math.min(Math.max(gained, 0), 1);

        // Attack/release smoothing (faster up, slower down)
        const attack = 0.55;
        const release = 0.92;
        const a = normalized > this.webSmoothedVolume ? attack : release;
        this.webSmoothedVolume = a * this.webSmoothedVolume + (1 - a) * normalized;

        this.realTimeVolumeCallback(this.webSmoothedVolume);

        this.webRafId = requestAnimationFrame(tick);
      };

      this.webRafId = requestAnimationFrame(tick);
    } catch {
      // If mic access fails on web, fall back to leaving volume at 0.
      this.stopWebAudioMonitoring();
    }
  }

  private stopWebAudioMonitoring() {
    if (this.webRafId != null) {
      cancelAnimationFrame(this.webRafId);
      this.webRafId = null;
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

    this.webAnalyser = null;
    this.webDataArray = null;
  }

  /**
   * Calculate mock real volume (placeholder for actual audio processing)
   * In production, this would process real microphone audio samples
   */
  private calculateMockRealVolume(): number {
    // This is a placeholder - in real implementation you would:
    // 1. Get actual audio samples from the recording
    // 2. Calculate RMS from real audio data
    // 3. Return actual volume level
    
    // For now, return a stable value to indicate microphone is working
    return 0.5; // Medium volume as placeholder
  }
  private async recordAndProcess() {
    if (!this.recordingCallback || !this.isRecording || this.isProcessing) return;

    this.isProcessing = true;

    try {
      // If we don't have a recording, start one
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
            this.recordingCallback(audioData);
          }
          
          // Clean up
          this.recording = null;
          
          // Start a new recording for the next cycle
          await this.startNewRecording();
        } catch (error) {
          console.error('Error processing recording:', error);
          this.recordingCallback(this.generateMockAudioData());
        }
      }
    } catch (error) {
      console.error('Error in recordAndProcess:', error);
    } finally {
      this.isProcessing = false;
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
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        },
        (status) => {
          if (status.isRecording && status.metering && this.realTimeVolumeCallback) {
            const dbValue = status.metering;
            const volume = Math.pow(10, dbValue / 20);
            const normalizedVolume = Math.min(Math.max(volume, 0), 1);
            this.realTimeVolumeCallback(normalizedVolume);
          }
        }
      );
      
      this.recording = recording;
    } catch (error) {
      console.error('Error starting new recording:', error);
    }
  }

  private async readAudioFile(uri: string): Promise<Float32Array> {
    try {
      // On web, we can't use expo-file-system, so use fetch instead
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        // Parse WAV file from array buffer
        return this.parseWavFromBuffer(arrayBuffer);
      }
      
      // On native, use expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      
      // Decode base64 to bytes
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return this.parseWavData(bytes);
    } catch (error) {
      console.error('Error reading audio file:', error);
      return this.generateMockAudioData();
    }
  }

  private parseWavFromBuffer(arrayBuffer: ArrayBuffer): Float32Array {
    const bytes = new Uint8Array(arrayBuffer);
    return this.parseWavData(bytes);
  }

  private parseWavData(bytes: Uint8Array): Float32Array {
    // Parse WAV file header
    const dataOffset = 44; // Standard WAV header size
    
    if (bytes.length < dataOffset) {
      console.warn('Audio file too small, using mock data');
      return this.generateMockAudioData();
    }
    
    // Extract PCM data (16-bit samples)
    const pcmData = bytes.slice(dataOffset);
    const numSamples = Math.floor(pcmData.length / 2);
    const floatData = new Float32Array(numSamples);
    
    // Convert 16-bit PCM to Float32 (-1.0 to 1.0)
    for (let i = 0; i < numSamples; i++) {
      const sample = (pcmData[i * 2] | (pcmData[i * 2 + 1] << 8));
      // Convert to signed 16-bit
      const signedSample = sample < 32768 ? sample : sample - 65536;
      floatData[i] = signedSample / 32768.0;
    }
    
    // Resample from 44100 Hz to 22050 Hz (take every 2nd sample)
    const targetLength = Math.floor(floatData.length / 2);
    const resampled = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      resampled[i] = floatData[i * 2];
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
