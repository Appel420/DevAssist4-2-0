# Local-Only Deployment Guide

## Backend

Run the backend locally:

```bash
cd backend
npm install
npm run dev
```

## iOS App

1. Open the Xcode project.
2. Point the API client at `http://127.0.0.1:3000/api`.
3. Build and run locally.

## Notes

- No cloud deployment is used.
- No external AI providers are required.
- Keep all data and services local to the device or workstation.
