# Frontend Architecture Guide

## Overview

The Listen E frontend is a React Native application built with Expo, supporting iOS, Android, and Web platforms. It provides real-time audio capture and classification through integration with the Environment Sound Classification API.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Listen E App                                   │
│                          (React Native / Expo)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         UI Layer                                     │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │  Home Screen     │  │  AudioRecorder   │  │  Classification  │  │   │
│  │  │  (app/(tabs)/    │  │  Component       │  │  Display         │  │   │
│  │  │   index.tsx)     │  │  (components/)   │  │  Component       │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Service Layer                                   │   │
│  │  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │   ClassificationService      │  │      AudioRecorder           │  │   │
│  │  │                              │  │                              │  │   │
│  │  │  • API communication         │  │  • Platform detection        │  │   │
│  │  │  • Audio chunk management    │  │  • Recording engine          │  │   │
│  │  │  • Health checking           │  │  • Audio encoding            │  │   │
│  │  │  • Result processing         │  │  • Volume monitoring         │  │   │
│  │  └──────────────────────────────┘  └──────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    External Integration                              │   │
│  │              Environment Sound Classification API                    │   │
│  │                    (REST API over HTTP)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Home Screen (`app/(tabs)/index.tsx`)

**Purpose**: Main application entry point and state coordinator

**Responsibilities**:
- Initialize `ClassificationService` with backend URL
- Manage recording state (start/stop)
- Handle classification results
- Display connection errors

**Key State**:
```typescript
const [isInitializing, setIsInitializing] = useState(true);
const [isRecording, setIsRecording] = useState(false);
const [currentResult, setCurrentResult] = useState<ClassificationResult | null>(null);
const [realTimeVolume, setRealTimeVolume] = useState(0);
```

**Lifecycle**:
1. Mount → Initialize service (health check)
2. On success → Auto-start recording
3. On error → Show connection alert

### 2. AudioRecorder Component (`components/AudioRecorder.tsx`)

**Purpose**: Visual recording interface

**Features**:
- Recording status indicator
- Microphone permission handling
- Initialization loading state

**Props**:
```typescript
interface AudioRecorderComponentProps {
  isRecording: boolean;
  isInitializing: boolean;
}
```

### 3. ClassificationDisplay Component (`components/ClassificationDisplay.tsx`)

**Purpose**: Visualize classification results

**Features**:
- Top prediction with confidence percentage
- Confidence bar visualization
- Top 5 predictions list
- Real-time volume indicator
- Class name formatting (e.g., "dog_bark" → "Dog Bark")

**Data Flow**:
```
ClassificationResult
    ↓
┌─────────────────────────┐
│ Top Prediction Display  │ ← Shows className + confidence%
│ Confidence Bar          │ ← Animated width based on confidence
├─────────────────────────┤
│ Top 5 Predictions       │ ← Sorted list from allProbabilities
│ Volume Indicator        │ ← Real-time dB level
└─────────────────────────┘
```

## Service Layer Architecture

### AudioRecorder.ts

**Platform-Specific Implementation**:

```
┌──────────────────────────────────────────────────────────────┐
│                    AudioRecorder Class                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │     Web Path     │          │   Native Path    │         │
│  ├──────────────────┤          ├──────────────────┤         │
│  │ ScriptProcessor  │          │ expo-av          │         │
│  │ Node (Audio API) │          │ Recording        │         │
│  │                  │          │                  │         │
│  │ Output: Float32  │          │ Output: M4A      │         │
│  │ Array (PCM)      │          │ (AAC encoded)    │         │
│  │                  │          │                  │         │
│  │ → Direct use     │          │ → Add marker     │         │
│  │                  │          │   888.888 +      │         │
│  │                  │          │   file bytes     │         │
│  └──────────────────┘          └──────────────────┘         │
│           │                              │                    │
│           └──────────────┬───────────────┘                    │
│                          ↓                                    │
│                 ┌─────────────────┐                          │
│                 │ Backend API     │                          │
│                 │ /classify       │                          │
│                 └─────────────────┘                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Key Methods**:

| Method | Platform | Description |
|--------|----------|-------------|
| `startWebAudioMonitoring()` | Web | Initialize Web Audio API, ScriptProcessorNode |
| `startNewRecording()` | Native | Start expo-av recording |
| `getWebAudioData()` | Web | Concatenate audio buffers from ScriptProcessor |
| `readAudioFile()` | Native | Read file, add marker 888.888, send as float array |
| `recordAndProcess()` | Both | Main loop: 4-second capture cycle |

**Web Audio Flow**:
```typescript
// 1. Get microphone access
stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Create audio context and processor
audioContext = new AudioContext({ sampleRate: 22050 });
processor = audioContext.createScriptProcessor(4096, 1, 1);

// 3. Capture audio chunks
processor.onaudioprocess = (e) => {
  const inputData = e.inputBuffer.getChannelData(0);
  this.webAudioBuffer.push(new Float32Array(inputData));
};

// 4. Every 4 seconds, concatenate and send
const audioData = this.getWebAudioData();  // Flatten all chunks
this.recordingCallback(audioData);
```

**Native Audio Flow**:
```typescript
// 1. Configure recording
const recording = new Audio.Recording();
await recording.prepareToRecordAsync({
  android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4 },
  ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.HIGH },
});

// 2. Record for 4 seconds
await recording.startAsync();
await new Promise(resolve => setTimeout(resolve, 4000));
await recording.stopAndUnloadAsync();

// 3. Read file and mark as file data
const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

// 4. Add marker and convert
const result = new Float32Array(bytes.length + 1);
result[0] = 888.888;  // Marker for backend
for (let i = 0; i < bytes.length; i++) {
  result[i + 1] = bytes[i];
}
```

### ClassificationService.ts

**Purpose**: Bridge between audio capture and backend API

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│               ClassificationService                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ Initialize  │───→│   Start     │───→│   Record    │  │
│  │             │    │  Recording  │    │   Cycle     │  │
│  │ Health Check│    │             │    │             │  │
│  └─────────────┘    └─────────────┘    │  4s chunks  │  │
│                                          └──────┬──────┘  │
│                                                 │         │
│                                                 ↓         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Display   │←───│   Process   │←───│   Send to   │  │
│  │   Results   │    │   Results   │    │   Backend   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Methods**:

| Method | Description |
|--------|-------------|
| `initialize()` | Check backend health at startup |
| `startClassification()` | Begin recording and classification cycle |
| `stopClassification()` | Stop all recording and processing |
| `classifyWithBackend()` | Send audio to API, return results |
| `float32ToBase64()` | Convert audio data to base64 for transmission |

**Data Types**:
```typescript
interface ClassificationResult {
  className: string;        // "Speech", "Music", etc.
  confidence: number;       // 0.0 - 1.0
  allProbabilities: Record<string, number>;  // Top 5 classes
  volume: number;         // Normalized 0-1
}
```

## Platform Differences

### Web (Browser)

**Advantages**:
- Direct PCM audio capture via Web Audio API
- No file encoding/decoding needed
- Lower latency

**Challenges**:
- Requires HTTPS for microphone access (except localhost)
- ScriptProcessorNode is deprecated (but still supported)
- Browser compatibility testing needed

### Native (iOS/Android)

**Advantages**:
- Hardware-optimized audio recording
- Background audio support
- Better performance on mobile devices

**Challenges**:
- Compressed audio format (M4A/AAC)
- Requires FFmpeg on backend for decoding
- File I/O overhead

**Solutions Implemented**:
1. Marker system (888.888) to indicate file data vs raw PCM
2. Backend detects format from file header (RIFF for WAV, ftyp for M4A)
3. Librosa with FFmpeg handles all formats

## Data Flow Sequence

```
Time →

┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  User   │   │  Audio  │   │ Backend │   │  Model  │   │   UI    │
│ Action  │   │ Capture │   │  API    │   │ YAMNet  │   │ Update  │
└────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
     │             │             │             │             │
     │  Open App   │             │             │             │
     │────────────→│             │             │             │
     │             │  Health     │             │             │
     │             │  Check      │             │             │
     │             │────────────→│             │             │
     │             │  Ready      │             │             │
     │             │←────────────│             │             │
     │             │             │             │             │
     │  Tap Start  │             │             │             │
     │────────────→│             │             │             │
     │             │  Record 4s  │             │             │
     │             │────────────→│             │             │
     │             │             │  Process    │             │
     │             │             │  Audio      │             │
     │             │             │────────────→│             │
     │             │             │             │  Classify   │
     │             │             │             │  521 classes│
     │             │             │  Results    │             │
     │             │             │←────────────│             │
     │             │             │             │             │
     │             │             │  JSON       │             │
     │             │←────────────│             │             │
     │             │             │             │             │
     │             │             │             │             │  Update
     │             │             │             │             │  Display
     │             │             │             │             │←────────
     │             │             │             │             │
     │             │  Record 4s  │             │             │
     │             │────────────→│  (repeat)   │             │
```

## State Management

The app uses React hooks for state management:

```
┌─────────────────────────────────────────┐
│         State Hierarchy                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Home Screen (index.tsx)        │   │
│  │  ├─ isInitializing              │   │
│  │  ├─ isRecording                   │   │
│  │  ├─ currentResult                 │   │
│  │  └─ realTimeVolume                  │   │
│  └─────────────────────────────────┘   │
│           │                             │
│           ▼                             │
│  ┌─────────────────────────────────┐   │
│  │  ClassificationDisplay          │   │
│  │  (receives result prop)         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  AudioRecorder                  │   │
│  │  (receives isRecording prop)    │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## Error Handling

### Connection Errors
```typescript
if (!initialized) {
  Alert.alert(
    'Backend Connection Failed',
    `Cannot connect to backend at ${BACKEND_URL}. Please check:\n\n` +
    '1. Backend server is running\n' +
    '2. Your device is on the same network as the backend'
  );
}
```

### Audio Errors
- Graceful fallback to mock data if recording fails
- Automatic retry on transient errors
- User feedback through console logs

## Performance Considerations

1. **Audio Chunk Size**: 4-second chunks balance latency vs accuracy
2. **Memory Management**: Audio buffers cleared after processing
3. **Rate Limiting**: Backend limits to 60 requests/minute per IP
4. **Model Loading**: One-time download, cached for subsequent requests

## Security

- **CORS**: Backend configured with `ALLOWED_ORIGINS`
- **Rate Limiting**: Prevents API abuse
- **No PII**: Audio processed in-memory, not stored

## Future Improvements

1. **WebSocket**: Real-time streaming instead of polling
2. **Local Model**: TensorFlow.js for edge inference
3. **Audio Visualization**: Waveform display during recording
4. **History**: Save classification results locally

## References

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [YAMNet Model](https://tfhub.dev/google/yamnet/1)
