import { Audio } from 'expo-av';

export class AudioRecorder {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private recordingCallback: ((audioData: Float32Array) => void) | null = null;
  private intervalId: any = null;

  async startRecording(callback: (audioData: Float32Array) => void) {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      this.recording = recording;
      this.recordingCallback = callback;
      this.isRecording = true;

      this.intervalId = setInterval(() => {
        this.processAudioChunk();
      }, 4000);

      return true;
    } catch (err) {
      console.error('Failed to start recording', err);
      return false;
    }
  }

  async stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    }

    this.recordingCallback = null;
  }

  private async processAudioChunk() {
    if (!this.recording || !this.recordingCallback || !this.isRecording) return;

    try {
      const status = await this.recording.getStatusAsync();
      if (status.isRecording) {
        const audioData = this.generateMockAudioData();
        this.recordingCallback(audioData);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private generateMockAudioData(): Float32Array {
    const sampleRate = 22050;
    const duration = 4; // seconds
    const numSamples = sampleRate * duration;
    
    // Generate more realistic mock audio with different patterns
    const audioData = new Float32Array(numSamples);
    const time = Date.now() / 1000;
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      
      // Create different sound patterns based on time
      const pattern = Math.sin(time * 0.1) > 0 ? 
        // Pattern 1: Sine wave with noise
        Math.sin(2 * Math.PI * 440 * t) * 0.3 + (Math.random() - 0.5) * 0.1 :
        // Pattern 2: Square wave with harmonics  
        (Math.sin(2 * Math.PI * 880 * t) > 0 ? 0.2 : -0.2) + 
        Math.sin(2 * Math.PI * 1760 * t) * 0.1;
      
      audioData[i] = pattern;
    }
    
    return audioData;
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
