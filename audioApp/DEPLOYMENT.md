# Deployment Guide

## Environment Setup

### 1. Configure Environment Variables

Create your local environment file:
```bash
cp .env.example .env
```

Edit `.env` and set your backend URL:
- **Local development**: `EXPO_PUBLIC_API_URL=http://localhost:5000`
- **Mobile testing**: `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5000`
- **Production**: `EXPO_PUBLIC_API_URL=https://your-production-backend.com`

### 2. Update App Configuration

Edit `app.json` and replace placeholder values:
- `owner`: Your Expo username
- `extra.eas.projectId`: Your EAS project ID (get from `eas init`)
- `ios.bundleIdentifier`: Your unique iOS bundle ID
- `android.package`: Your unique Android package name

### 3. Install EAS CLI

```bash
npm install -g eas-cli
```

### 4. Initialize EAS Project

```bash
eas init
```

## Building for Different Environments

### Development Build (for testing)

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

### Preview Build (internal distribution)

Update `eas.json` preview profile with your computer's IP:
```json
"preview": {
  "env": {
    "EXPO_PUBLIC_API_URL": "http://192.168.1.100:5000"
  }
}
```

Then build:
```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

### Production Build

Update `eas.json` production profile with your production backend:
```json
"production": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://your-production-backend.com"
  }
}
```

Build for stores:
```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

## Web Deployment

Build for web:
```bash
npx expo export --platform web
```

Deploy to hosting service (e.g., Netlify, Vercel):
```bash
# Example for Netlify
npx netlify-cli deploy --dir dist
```

## Local Network Testing (No Build Required)

1. Start backend: `python app.py`
2. Update `.env` with your computer's IP: `EXPO_PUBLIC_API_URL=http://192.168.1.100:5000`
3. Start Expo: `npx expo start`
4. Scan QR code with Expo Go app

## Troubleshooting

### Backend Connection Issues
- Ensure phone and computer are on same WiFi
- Check Windows Firewall allows port 5000
- Verify IP address in `.env` matches your computer's IP

### Build Issues
- Run `eas doctor` to check configuration
- Ensure all assets (icons, splash screen) exist in `assets/images/`

### Audio Recording Issues on Android
- Ensure FFmpeg is installed on backend server
- Check microphone permission is granted
