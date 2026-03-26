# Documentation Index

Welcome to the Listen E documentation. This directory contains comprehensive guides for understanding, developing, and deploying the application.

## Quick Navigation

| Document | Purpose | Audience |
|----------|---------|----------|
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | Detailed frontend architecture, components, and data flow | Developers |
| [API_INTEGRATION.md](API_INTEGRATION.md) | API integration guide, endpoints, and data formats | Developers |
| [../audioApp/DEPLOYMENT.md](../audioApp/DEPLOYMENT.md) | Frontend deployment instructions | DevOps |
| [../backend/DEPLOYMENT.md](../backend/DEPLOYMENT.md) | Backend deployment instructions | DevOps |

## Related Repositories

- **Frontend (This Repo)**: [github.com/xAlexBFx/enviroment-sound-classifier](https://github.com/xAlexBFx/enviroment-sound-classifier)
- **Backend API**: [github.com/xAlexBFx/environment-sound-API](https://github.com/xAlexBFx/environment-sound-API)

## Documentation Overview

### For New Developers

1. Start with the main [README.md](../README.md) for project overview
2. Read [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) to understand the codebase
3. Review [API_INTEGRATION.md](API_INTEGRATION.md) for API communication details

### For DevOps/Deployment

1. Frontend deployment: [../audioApp/DEPLOYMENT.md](../audioApp/DEPLOYMENT.md)
2. Backend deployment: [../backend/DEPLOYMENT.md](../backend/DEPLOYMENT.md)
3. The API repo also has deployment guides for the backend service

### For API Integration

- See [API_INTEGRATION.md](API_INTEGRATION.md) for:
  - API endpoint specifications
  - Authentication and security
  - Data formats and examples
  - Error handling

## Architecture Diagrams

### System Overview
```
┌─────────────┐      HTTP       ┌─────────────┐
│  Frontend   │ ←─────────────→ │  Backend    │
│  (Expo)     │                 │  (Flask)    │
└─────────────┘                 └─────────────┘
                                       │
                                       │
                                       ↓
                                ┌─────────────┐
                                │  YAMNet     │
                                │  (TF Hub)   │
                                └─────────────┘
```

### Data Flow
```
Microphone → AudioRecorder → ClassificationService → API → YAMNet → Results → UI
```

## Contributing

When adding new features:
1. Update relevant documentation
2. Add code comments for complex logic
3. Update architecture diagrams if structure changes

## Support

For issues or questions:
- Frontend issues: [Create issue in this repo](https://github.com/xAlexBFx/enviroment-sound-classifier/issues)
- API issues: [Create issue in API repo](https://github.com/xAlexBFx/environment-sound-API/issues)
