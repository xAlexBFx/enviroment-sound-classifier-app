# Listen E - Environmental Sound Classification App

A cross-platform mobile application for real-time environmental sound classification using YAMNet (521 AudioSet classes). Connects to the [Environment Sound Classification API](https://github.com/xAlexBFx/environment-sound-API) for backend inference.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Listen E App                              │
│                    (React Native / Expo)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │  Audio       │  │  Classification  │  │  UI Components   ││
│  │  Recorder    │──│  Service         │──│  (Display,       ││
│  │  (Web/Native)│  │  (API Client)    │  │   Recorder)      ││
│  └──────────────┘  └──────────────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP/WebSocket
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Environment Sound Classification API                │
│              (Separate Repository - Backend)                     │
│         https://github.com/xAlexBFx/environment-sound-API          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  YAMNet      │  │  Audio       │  │  REST API Endpoints  │ │
│  │  Model       │  │  Processing  │  │  /health, /classify  │ │
│  │  (TF Hub)    │  │  (Librosa)   │  │  /embeddings         │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
enviroment-sound-classifier/
├── audioApp/                          # Frontend React Native/Expo app
│   ├── app/                           # App routes (Expo Router)
│   │   └── (tabs)/
│   │       └── index.tsx              # Main recording/classification screen
│   ├── components/
│   │   ├── AudioRecorder.tsx          # Recording UI component
│   │   └── ClassificationDisplay.tsx  # Results display component
│   ├── services/
│   │   ├── AudioRecorder.ts          # Audio capture (Web + Native)
│   │   └── ClassificationService.ts   # API client for backend
│   ├── app.json                       # Expo configuration
│   ├── .env                           # Environment variables
│   ├── .env.example                   # Environment template
│   └── DEPLOYMENT.md                  # Frontend deployment guide
│
└── backend/                           # Local backend (for development)
    ├── app.py                         # Development Flask server
    ├── app_production.py              # Production Flask server
    ├── requirements.txt               # Python dependencies
    ├── Dockerfile                     # Container config
    ├── render.yaml                    # Render deployment config
    └── DEPLOYMENT.md                  # Backend deployment guide
```

## Related Repositories

| Repository | Purpose | Link |
|------------|---------|------|
| **This Repo** | Frontend mobile app (React Native/Expo) | [xAlexBFx/enviroment-sound-classifier](https://github.com/xAlexBFx/enviroment-sound-classifier) |
| **API Repo** | Backend classification API (Flask/YAMNet) | [xAlexBFx/environment-sound-API](https://github.com/xAlexBFx/environment-sound-API) |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+ (for local backend)
- Expo Go app (for mobile testing)
- FFmpeg (for audio processing)

### 1. Clone and Setup

```bash
# Clone frontend repository
git clone https://github.com/xAlexBFx/enviroment-sound-classifier.git
cd enviroment-sound-classifier

# Install frontend dependencies
cd audioApp
npm install

# Setup environment
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_API_URL to your backend URL
```

### 2. Backend Setup (Choose one)

**Option A: Use the separate API repository (Recommended for production)**
```bash
# Clone the API repository
git clone https://github.com/xAlexBFx/environment-sound-API.git
cd environment-sound-API

# Follow the API repo's deployment guide
# Deploy to Render, Railway, or run locally
```

**Option B: Use local backend (for development)**
```bash
cd backend

# Create Python virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
python app.py
```

### 3. Run Frontend

```bash
cd audioApp

# For web development
npx expo start --web

# For mobile (scan QR code with Expo Go)
npx expo start

# For production build
npx expo export --platform web
```

## Frontend Architecture

### Audio Recording Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AudioRecorder.ts                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │  Platform    │     │  Recording   │     │  Audio      │ │
│  │  Detection   │────→│  Engine      │────→│  Processing │ │
│  │              │     │              │     │             │ │
│  │ - Web:       │     │ - Web:       │     │ - Resample  │ │
│  │   Script     │     │   Audio API  │     │   to 16kHz  │ │
│  │   Processor  │     │ - Native:    │     │ - Normalize │ │ │
│  │ - Native:    │     │   expo-av    │     │ - Base64    │ │
│  │   expo-av    │     │              │     │   encode    │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Classification Service

```
┌─────────────────────────────────────────────────────────────┐
│               ClassificationService.ts                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐     ┌──────────────────────────┐    │
│  │  Audio Buffer    │     │  API Communication       │    │
│  │  Management      │────→│                          │    │
│  │                  │     │  POST /classify          │    │
│  │ - 4-second       │     │  Audio → Base64 → JSON   │    │
│  │   chunks         │     │                          │    │
│  │ - Real-time      │     │  Response:               │    │
│  │   callback       │     │  {className, confidence, │    │
│  └──────────────────┘     │   allProbabilities}       │    │
│                           └──────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## API Integration

The frontend connects to the [Environment Sound Classification API](https://github.com/xAlexBFx/environment-sound-API) at the configured `EXPO_PUBLIC_API_URL`.

### API Endpoints Used

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/health` | GET | - | `{status, yamnet_loaded, yamnet_classes}` |
| `/classify` | POST | `{audio: base64String}` | `{className, confidence, allProbabilities}` |
| `/classify/raw` | POST | `{audio: base64String}` | `{topPredictions[], model, totalClasses}` |
| `/embeddings` | POST | `{audio: base64String}` | `{embedding[], dimensions}` |
| `/info` | GET | - | `{name, version, endpoints}` |

### Request/Response Example

```typescript
// Classification Request
const audioData = Float32Array;  // Raw audio samples
const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)));

const response = await fetch(`${API_URL}/classify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ audio: base64Audio })
});

// Classification Response
{
  "className": "Speech",
  "confidence": 0.87,
  "allProbabilities": {
    "Speech": 0.87,
    "Music": 0.08,
    "Silence": 0.03,
    "Noise": 0.02
  },
  "model": "yamnet",
  "classIndex": 0,
  "totalClasses": 521
}
```

## Key Components

### AudioRecorder.ts

Handles audio capture for both web and native platforms:
- **Web**: Uses Web Audio API with ScriptProcessorNode for raw PCM capture
- **Native**: Uses expo-av for recording (AAC/M4A format)
- Converts all audio to Float32Array for transmission
- Sends raw file bytes with marker (888.888) for backend decoding

### ClassificationService.ts

Manages API communication and audio processing:
- Initializes connection to backend API
- Manages audio recording cycles (4-second chunks)
- Sends audio to `/classify` endpoint
- Handles real-time volume monitoring
- Processes classification results

### ClassificationDisplay.tsx

Renders classification results:
- Shows top predicted class with confidence
- Displays confidence bar visualization
- Lists top 5 predictions
- Shows real-time volume indicator
- Formats class names for display

## Environment Configuration

### Frontend (.env)

```bash
# Backend API URL
EXPO_PUBLIC_API_URL=http://localhost:5000  # Development
# EXPO_PUBLIC_API_URL=https://your-api.onrender.com  # Production

# App Configuration
EXPO_PUBLIC_APP_NAME=Listen E
EXPO_PUBLIC_DEBUG_MODE=true
```

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL | `http://localhost:5000` |
| `EXPO_PUBLIC_APP_NAME` | App display name | `Listen E` |
| `EXPO_PUBLIC_DEBUG_MODE` | Enable debug logging | `false` |

## Deployment

### Frontend Deployment

The frontend can be deployed to various platforms:

1. **Expo EAS Build** (Recommended for mobile)
   ```bash
   cd audioApp
   eas build --platform ios  # or android
   ```

2. **Web Deployment**
   ```bash
   cd audioApp
   npx expo export --platform web
   # Deploy dist/ folder to Netlify, Vercel, etc.
   ```

See [audioApp/DEPLOYMENT.md](audioApp/DEPLOYMENT.md) for detailed instructions.

### Backend Deployment

The backend API is in a separate repository. See:
- [environment-sound-API](https://github.com/xAlexBFx/environment-sound-API) - Main API repo
- [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) - Local backend deployment guide

## Audio Processing Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Microphone │────→│  Platform   │────→│  Backend    │────→│  YAMNet     │
│  Input      │     │  Encoding   │     │  Processing │     │  Inference  │
├─────────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
│ Web: PCM    │     │ Web: Raw    │     │ FFmpeg      │     │ 16kHz       │
│ Native: AAC │     │ Native:     │     │ Decode      │     │ Resample    │
│             │     │ M4A+marker  │     │ →16kHz      │     │ 1024-dim    │
│             │     │             │     │ Normalize   │     │ Embeddings  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                       │
                                                                       ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │←────│  API        │←────│  Top-K      │←────│  521-Class  │
│  Display    │     │  Response   │     │  Selection  │     │  Softmax    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Model Information

- **Model**: YAMNet (Yet Another Mobile Network)
- **Source**: TensorFlow Hub
- **Classes**: 521 AudioSet classes
- **Input**: 16kHz mono audio
- **Output**: Per-class confidence scores (0-1)
- **Uncertainty Threshold**: < 60% confidence = "uncertain"

## Development Workflow

1. **Start Backend**: Run the API locally or connect to deployed API
2. **Configure Frontend**: Set `EXPO_PUBLIC_API_URL` in `.env`
3. **Start Frontend**: `npx expo start`
4. **Test**: Use Expo Go (mobile) or web browser
5. **Iterate**: Changes hot-reload automatically

## Troubleshooting

### Connection Issues

- Ensure phone and computer are on same WiFi (for local testing)
- Check firewall settings for port 5000
- Verify `EXPO_PUBLIC_API_URL` is correct

### Audio Issues

- Grant microphone permissions in app settings
- Ensure FFmpeg is installed on backend server
- Check audio format compatibility (see API repo)

### Model Loading

- First request may be slow (model download)
- Subsequent requests use cached model
- Check `/health` endpoint for model status

## License

MIT License - See LICENSE file for details

## Credits

- YAMNet model by Google (TensorFlow Hub)
- AudioSet dataset by Google Research
- Built with React Native, Expo, Flask, and TensorFlow
