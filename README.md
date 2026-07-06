# DevAssist 4.2.0 - Professional iOS Development Assistant

A secure, production-ready iOS application that combines video streaming with local-only chat functionality.

## 🔒 Security Features

- **Keychain Integration**: Secure storage of API keys and OAuth tokens
- **Input Sanitization**: All user inputs are validated and sanitized
- **HTTPS Only**: All network communications use HTTPS
- **Rate Limiting**: Backend API includes rate limiting protection
- **Data Encryption**: Sensitive data is encrypted at rest and in transit

## 🏗️ Architecture

### iOS App (Swift/SwiftUI)
- **MVVM Architecture**: Clean separation of concerns
- **Combine Framework**: Reactive programming for data flow
- **Secure Networking**: URLSession with proper error handling
- **Keychain Services**: Secure credential storage
- **Network Monitoring**: Real-time connectivity status

### Backend API (Node.js/Express)
- **Security Middleware**: Helmet, CORS, rate limiting
- **Input Validation**: Express-validator for request sanitization
- **Structured Logging**: Winston for comprehensive logging
- **Error Handling**: Proper error responses and logging

## 📱 Features

- **Video Streaming**: AVKit integration with proper audio session management
- **Local Chat Interface**: Secure chat with local backend API
- **Real-time Status**: Network and API health monitoring
- **Settings Management**: Secure configuration and privacy controls
- **Privacy Compliance**: Full privacy policy and data protection

## 🚀 Getting Started

### Prerequisites
- Xcode 15.0+
- iOS 15.0+
- Node.js 18.0+

### iOS Setup
1. Open `DevAssist4-2-0.xcodeproj` in Xcode
2. Configure your development team in project settings
3. Update API endpoints in `Configuration.swift`
4. Build and run on simulator or device

### Run Steps
1. Install backend dependencies:
   \`\`\`bash
   cd backend
   npm install
   \`\`\`
2. Start the backend:
   \`\`\`bash
   cd backend
   npm start
   \`\`\`
3. Start the continuous security monitor in a third terminal:
   \`\`\`bash
   node backend/node/csm-monitor.js
   \`\`\`
4. Set `DEVASSIST_API_BASE_URL` to the helper-discovered local URL, then open the iOS app in Xcode.

### Deployment
1. **iOS**: Use Xcode's archive and upload to App Store Connect
2. **Backend**: Run locally with Node.js or Docker using the helper-resolved host and port
3. **CSM**: Keep `node backend/node/csm-monitor.js` running while you work

## 🔐 Local Q-Resist Stack

- Hashing: BLAKE3, SHA3-512
- Signatures: Ed25519, ML-DSA-87, Falcon, SLH-DSA
- KEM: ML-KEM-1024
- AEAD: XChaCha20-Poly1305
- Tamper evidence: Merkle tree chaining and SHA3-512 logs
- Secret sharing: Shamir

Use the local stack as the default foundation for all cryptographic work in this repo.

## 🔐 Security Configuration

### API Keys
- Store API keys securely in iOS Keychain
- Never commit API keys to version control
- Use environment variables for backend configuration

### OAuth Tokens
- Implement proper OAuth 2.0 flow
- Store tokens securely in Keychain
- Implement token refresh logic

### Network Security
- All API calls use HTTPS
- Certificate pinning for production
- Proper error handling without exposing sensitive data

## 📊 Monitoring & Analytics

### Logging
- Structured logging with Winston (backend)
- os_log for iOS (Apple compliant)
- No sensitive data in logs

### Error Tracking
- Comprehensive error handling
- User-friendly error messages
- Detailed logging for debugging

## 🧪 Testing

### iOS Testing
\`\`\`bash
xcodebuild test \
  -project DevAssist4-2-0.xcodeproj \
  -scheme DevAssist4-2-0 \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
\`\`\`

### Backend Testing
\`\`\`bash
cd backend
npm test
npm run security-audit
\`\`\`

## 📋 Compliance

### Apple App Store Guidelines
- ✅ Privacy policy implemented
- ✅ Secure data handling
- ✅ Proper permission requests
- ✅ No hardcoded credentials
- ✅ Accessibility support

### Local-only Runtime
- ✅ Secure API endpoints
- ✅ Rate limiting implemented
- ✅ Proper error handling
- ✅ Structured logging
- ✅ Security headers
- ✅ Continuous security monitor

### Voice and Visual Input
- Voice prompts are accepted through the existing microphone flow.
- Visual prompts can be fed from a local VLM captioning pipeline.
- Raise the token budget when building larger multimodal responses.

## 🔄 Local Verification

- Security scanning
- Automated testing
- Build verification
- Continuous security monitoring

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue in this repository
- Contact: open an issue in this repository

---

**Note**: This application keeps runtime behavior local and avoids external AI vendors.
