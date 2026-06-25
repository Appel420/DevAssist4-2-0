# Local-Only Deployment Guide

## Backend

Run the backend locally:

```bash
cd backend
npm install
npm start
```

## iOS App

1. Open the Xcode project.
2. Point the API client at the helper-discovered `DEVASSIST_API_BASE_URL`.
3. Build and run locally.

## Notes

- No cloud deployment is used.
- No external AI providers are required.
- Keep all data and services local to the device or workstation.
