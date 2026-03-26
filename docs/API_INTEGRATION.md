# API Integration Guide

This guide explains how the Listen E frontend integrates with the [Environment Sound Classification API](https://github.com/xAlexBFx/environment-sound-API).

## API Repository

**Backend API**: [github.com/xAlexBFx/environment-sound-API](https://github.com/xAlexBFx/environment-sound-API)

This separate repository contains:
- Flask REST API server
- YAMNet model integration
- Audio processing pipeline
- Deployment configurations

## Architecture Overview

```
┌─────────────────────┐         HTTP/HTTPS          ┌─────────────────────┐
│   Listen E App      │  ←──────────────────────→   │  Classification API │
│   (This Repo)       │      REST API Calls         │  (External Repo)    │
├─────────────────────┤                             ├─────────────────────┤
│                     │                             │                     │
│  AudioRecorder.ts   │  POST /classify             │  app_production.py  │
│  Classification     │  {audio: base64}            │  Flask Server       │
│  Service.ts         │                             │                     │
│                     │  Response:                  │  preprocess_audio() │
│                     │  {className,               │  YAMNet inference   │
│                     │   confidence,             │  521 classes        │
│                     │   allProbabilities}         │                     │
│                     │                             │                     │
└─────────────────────┘                             └─────────────────────┘
```

## API Endpoints

### Base URL Configuration

```typescript
// audioApp/app/(tabs)/index.tsx
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
```

Environment variables:
- **Development**: `http://localhost:5000`
- **Production**: `https://your-api.onrender.com`

### 1. Health Check

**Endpoint**: `GET /health`

**Purpose**: Verify API availability and model status

**Frontend Usage**:
```typescript
// ClassificationService.ts
async initialize(): Promise<boolean> {
  try {
    const response = await fetch(`${this.backendUrl}/health`);
    const data = await response.json();
    return data.yamnet_loaded === true;
  } catch (error) {
    return false;
  }
}
```

**Response**:
```json
{
  "status": "healthy",
  "yamnet_loaded": true,
  "yamnet_classes": 521,
  "version": "1.0.0"
}
```

### 2. Classify Audio

**Endpoint**: `POST /classify`

**Purpose**: Main classification endpoint - returns top prediction

**Frontend Usage**:
```typescript
// ClassificationService.ts
async classifyWithBackend(
  audioData: Float32Array, 
  volume: number
): Promise<ClassificationResult> {
  const base64Audio = this.float32ToBase64(audioData);
  
  const response = await fetch(`${this.backendUrl}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64Audio })
  });
  
  const data = await response.json();
  
  return {
    className: data.className,
    confidence: data.confidence,
    allProbabilities: data.allProbabilities,
    volume: volume
  };
}
```

**Request**:
```json
{
  "audio": "base64EncodedAudioData"
}
```

**Response**:
```json
{
  "className": "Speech",
  "confidence": 0.87,
  "allProbabilities": {
    "Speech": 0.87,
    "Music": 0.08,
    "Animal": 0.03,
    "Silence": 0.01,
    "Noise": 0.01
  },
  "model": "yamnet",
  "classIndex": 0,
  "totalClasses": 521
}
```

**Note**: If confidence < 0.6, `className` returns "uncertain"

### 3. Raw Classification

**Endpoint**: `POST /classify/raw`

**Purpose**: Returns top 5 predictions with detailed info

**Request**: Same as `/classify`

**Response**:
```json
{
  "topPredictions": [
    {
      "className": "Speech",
      "classIndex": 0,
      "confidence": 0.87
    },
    {
      "className": "Music",
      "classIndex": 137,
      "confidence": 0.08
    }
  ],
  "model": "yamnet",
  "totalClasses": 521
}
```

### 4. Extract Embeddings

**Endpoint**: `POST /embeddings`

**Purpose**: Get YAMNet embeddings for transfer learning

**Response**:
```json
{
  "embedding": [0.023, -0.156, ...],  // 1024 dimensions
  "dimensions": 1024
}
```

### 5. API Info

**Endpoint**: `GET /info`

**Purpose**: Get API metadata and available endpoints

**Response**:
```json
{
  "name": "YAMNet Sound Classification API",
  "version": "1.0.0",
  "model": "YAMNet",
  "classes": 521,
  "endpoints": {
    "/health": "GET - Health check",
    "/info": "GET - API information",
    "/classify": "POST - Classify audio (returns top prediction)",
    "/classify/raw": "POST - Classify audio (returns top 5 predictions)",
    "/embeddings": "POST - Extract YAMNet embeddings"
  }
}
```

## Audio Data Format

### Web Platform

**Format**: Raw PCM Float32Array

**Flow**:
```typescript
// 1. Capture from ScriptProcessorNode
const audioChunks: Float32Array[] = [];
processor.onaudioprocess = (e) => {
  audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
};

// 2. Concatenate chunks
const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
const audioData = new Float32Array(totalLength);
let offset = 0;
audioChunks.forEach(chunk => {
  audioData.set(chunk, offset);
  offset += chunk.length;
});

// 3. Convert to base64
const bytes = new Uint8Array(audioData.buffer);
const base64 = btoa(String.fromCharCode(...bytes));
```

### Native Platform (iOS/Android)

**Format**: M4A/AAC with marker

**Flow**:
```typescript
// 1. Record with expo-av (produces M4A file)
const recording = new Audio.Recording();
await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
await recording.startAsync();
// ... wait 4 seconds ...
await recording.stopAndUnloadAsync();
const uri = recording.getURI();

// 2. Read file as base64
const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
const binaryString = atob(base64);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}

// 3. Add marker (888.888) and convert to float array
const result = new Float32Array(bytes.length + 1);
result[0] = 888.888;  // Marker tells backend this is file data
for (let i = 0; i < bytes.length; i++) {
  result[i + 1] = bytes[i];
}

// 4. Convert to base64 for transmission
const bytesForTransfer = new Uint8Array(result.buffer);
const base64ForApi = btoa(String.fromCharCode(...bytesForTransfer));
```

### Backend Processing

The backend detects the data type:

```python
def preprocess_audio(audio_data, sample_rate=22050):
    audio_bytes = base64.b64decode(audio_data)
    
    # Check for file marker
    if len(audio_bytes) > 4:
        first_float = np.frombuffer(audio_bytes[:4], dtype=np.float32)[0]
        
        if abs(first_float - 888.888) < 0.001:
            # File data - reconstruct and decode with FFmpeg
            float_array = np.frombuffer(audio_bytes[4:], dtype=np.float32)
            file_bytes = bytes([int(min(255, max(0, f))) for f in float_array])
            
            # Detect format from header
            if file_bytes[:4] == b'RIFF':
                ext = '.wav'
            elif b'ftyp' in file_bytes[:100]:
                ext = '.m4a'
            
            # Decode with librosa (uses FFmpeg)
            audio_array, sr = librosa.load(temp_path, sr=16000, mono=True)
        else:
            # Raw PCM data
            audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
            audio_array = librosa.resample(audio_array, orig_sr=sample_rate, target_sr=16000)
    
    # Normalize to [-1, 1]
    max_val = np.max(np.abs(audio_array))
    if max_val > 0:
        audio_array = audio_array / max_val
    
    return audio_array
```

## Request Flow Sequence

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  App    │     │  Audio  │     │  API    │     │  Model  │
│         │     │Recorder │     │         │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │  startRecording              │               │
     │──────────────→│               │               │
     │               │               │               │
     │               │  Record 4s    │               │
     │               │──────────────→│               │
     │               │               │               │
     │               │  Audio Buffer │               │
     │               │←──────────────│               │
     │               │               │               │
     │  classifyWithBackend(audio)   │               │
     │──────────────→│               │               │
     │               │               │               │
     │               │  POST /classify              │
     │               │  {audio: base64}             │
     │               │──────────────→│               │
     │               │               │               │
     │               │               │  preprocess()   │
     │               │               │  resample()   │
     │               │               │  normalize()  │
     │               │               │               │
     │               │               │  yamnet_model()│
     │               │               │──────────────→│
     │               │               │               │
     │               │               │  scores[521]  │
     │               │               │←──────────────│
     │               │               │               │
     │               │               │  argmax()     │
     │               │               │  top_k(5)     │
     │               │               │               │
     │               │  JSON Response│               │
     │               │←──────────────│               │
     │               │               │               │
     │  ClassificationResult         │               │
     │←──────────────│               │               │
     │               │               │               │
     │  Update UI    │               │               │
     │──────────────→│               │               │
     │               │               │               │
```

## Error Handling

### Frontend Errors

```typescript
// ClassificationService.ts
try {
  const response = await fetch(`${this.backendUrl}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64Audio })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
} catch (error) {
  console.error('Classification error:', error);
  // Return fallback result
  return {
    className: 'Error',
    confidence: 0,
    allProbabilities: {},
    volume: volume
  };
}
```

### Backend Error Responses

| Status | Meaning | Frontend Action |
|--------|---------|----------------|
| 200 | Success | Display results |
| 400 | Bad Request (invalid audio) | Log error, continue recording |
| 429 | Rate Limited | Wait, retry after delay |
| 500 | Server Error | Show connection error |

## Rate Limiting

The API limits requests to **60 per minute per IP**:

```python
# Backend: app_production.py
@limiter.limit("30 per minute")
def classify():
    # ...
```

**Frontend Adaptation**:
- 4-second recording chunks = 15 requests/minute per client
- Well within limit for single user
- Multiple users from same IP could hit limit

## CORS Configuration

### Development

Backend allows all origins:
```python
CORS(app)  # Allow all
```

### Production

Configure specific origins:
```python
CORS(app, origins=[
    "https://your-app.com",
    "https://your-app.netlify.app"
])
```

Or set environment variable:
```bash
ALLOWED_ORIGINS=https://your-app.com,https://your-app-staging.netlify.app
```

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **CORS**: Restrict to known origins
3. **Rate Limiting**: Prevents abuse (60 req/min)
4. **No PII**: Audio not stored, processed in-memory only
5. **Input Validation**: Backend validates audio data format

## Testing the API

### Using curl

```bash
# Health check
curl http://localhost:5000/health

# Classify audio (replace with actual base64)
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"audio": "your_base64_audio_here"}'
```

### Using JavaScript

```javascript
// Test API connection
async function testApi() {
  const response = await fetch('http://localhost:5000/health');
  const data = await response.json();
  console.log('API Status:', data);
}

// Test classification
async function testClassification(base64Audio) {
  const response = await fetch('http://localhost:5000/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64Audio })
  });
  const result = await response.json();
  console.log('Classification:', result);
}
```

## Deployment Integration

### Development

```bash
# Terminal 1: Start API
cd environment-sound-api
python app.py

# Terminal 2: Start Frontend
cd audioApp
EXPO_PUBLIC_API_URL=http://localhost:5000 npx expo start
```

### Production

1. Deploy API to Render/Railway/AWS
2. Update frontend `.env`:
   ```
   EXPO_PUBLIC_API_URL=https://your-api.onrender.com
   ```
3. Build and deploy frontend

## Troubleshooting

### Connection Refused

- Check API is running: `curl http://localhost:5000/health`
- Verify firewall allows port 5000
- Ensure phone and computer on same network (for mobile testing)

### CORS Errors

- Check `ALLOWED_ORIGINS` includes frontend URL
- For development, use `*` or `http://localhost:19006`

### 429 Rate Limited

- Reduce request frequency
- Implement client-side rate limiting
- Check if multiple clients sharing same IP

### Audio Processing Errors

- Verify FFmpeg installed on API server
- Check audio format matches expected input
- Review API logs for specific errors

## API Versioning

Current version: **v1.0.0**

Version info available at:
- `/health` endpoint: `"version": "1.0.0"`
- `/info` endpoint: `"version": "1.0.0"`

Future versions will use URL prefix: `/v2/classify`

## References

- [API Repository](https://github.com/xAlexBFx/environment-sound-API)
- [YAMNet Model](https://tfhub.dev/google/yamnet/1)
- [AudioSet Classes](https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv)
- [Flask Documentation](https://flask.palletsprojects.com)
- [Expo Documentation](https://docs.expo.dev)
