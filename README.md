# Docebo AI Agent 🤖

An AI-powered Docebo administration assistant that uses natural language processing to help with LMS management tasks.

![Docebo AI Agent Demo](https://via.placeholder.com/800x400/0066cc/ffffff?text=Docebo+AI+Agent+Demo)

## ✨ Features

### 🎯 Current Capabilities (Phase 1)
- **🔍 Smart Search**: Find users, courses, and learning plans with natural language
- **📚 Enrollment Management**: Enroll/unenroll users in courses and learning plans
- **👥 User Management**: Get detailed user information and enrollment status
- **📋 Learning Plan Management**: Search and get information about learning paths
- **💬 Natural Language Interface**: Chat-based interaction with advanced intent recognition
- **⚡ Real-time Processing**: Multiple processing strategies (direct, background, enhanced)

### 🚀 Example Commands
```
"Find user mike@company.com"
"Enroll john@company.com in course Python Programming"
"Check if sarah@company.com is enrolled in course Data Science"
"Find Python learning plans"
"User enrollments mike@company.com"
"Unenroll user@company.com from learning plan Leadership"
```

## 🏗️ Architecture

```
├── app/
│   ├── api/
│   │   ├── chat/              # Main chat endpoint with handlers
│   │   ├── chat-direct/       # Direct processing endpoint
│   │   ├── chat-bg/          # Background processing endpoint
│   │   ├── chat-enhanced/     # Enhanced chat with Gemini AI
│   │   └── health/           # Health check endpoint
│   ├── page.tsx              # Main chat interface
│   └── layout.tsx            # App layout
├── package.json              # Dependencies and scripts
├── next.config.js           # Next.js configuration
└── tailwind.config.js       # Styling configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Docebo admin account with API access
- Google Gemini API key

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd docebo-ai-agent
npm install
```

### 2. Environment Setup
```bash
# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your credentials
nano .env.local
```

### 3. Configure Docebo API Access
1. **Get OAuth2 Credentials:**
   - Go to Docebo Admin → API and SSO → API Credentials
   - Create new OAuth2 app
   - Copy Client ID and Client Secret

2. **Create API User:**
   - Create an admin user for API access
   - Ensure user has proper permissions for user/course management

### 4. Get Google Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Add to your `.env.local`

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 API Endpoints

### Main Chat Endpoint
- **POST** `/api/chat` - Main conversational interface
- **GET** `/api/chat` - API status and capabilities

### Alternative Processing Methods
- **POST** `/api/chat-direct` - Direct processing (faster, limited scope)
- **POST** `/api/chat-bg` - Background processing (for heavy operations)
- **POST** `/api/chat-enhanced` - Enhanced AI processing with Gemini

### Health & Monitoring
- **GET** `/api/health` - Application health check
- **POST** `/api/health` - Detailed health diagnostics

## 🎮 Usage Examples

### Basic User Search
```javascript
POST /api/chat
{
  "message": "Find user mike@company.com"
}
```

### Enrollment Management
```javascript
POST /api/chat
{
  "message": "Enroll john@company.com in course Python Programming"
}
```

### Learning Plan Operations
```javascript
POST /api/chat
{
  "message": "Enroll sarah@company.com in learning plan Data Science"
}
```

### Status Checking
```javascript
POST /api/chat
{
  "message": "Check if mike@company.com is enrolled in course Excel Training"
}
```

## 🔧 Configuration

### Environment Variables
See `.env.example` for all available configuration options.

**Required:**
- `DOCEBO_DOMAIN` - Your Docebo domain
- `DOCEBO_CLIENT_ID` - OAuth2 client ID
- `DOCEBO_CLIENT_SECRET` - OAuth2 client secret
- `DOCEBO_USERNAME` - Admin username
- `DOCEBO_PASSWORD` - Admin password
- `GOOGLE_GEMINI_API_KEY` - Gemini AI API key

**Optional:**
- `API_RATE_LIMIT` - Rate limiting (default: 100/min)
- `API_TIMEOUT` - API timeout (default: 30000ms)
- `CACHE_DURATION` - Cache duration (default: 300s)

### Docebo Permissions
Your API user needs these permissions:
- View users and user profiles
- Manage course enrollments
- View courses and learning plans
- Access enrollment data

## 🚀 Deployment

### Vercel (Recommended)
1. **Connect Repository:**
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Set Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables from `.env.example`

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### Other Platforms
The app works on any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- Render

## 🧪 Testing

### Run Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find user test@example.com"}'
```

### Development Testing
```bash
npm run type-check  # TypeScript validation
npm run lint       # Code linting
npm run build      # Production build test
```

## 🔒 Security

- **Rate Limiting**: API calls are rate-limited per IP
- **Input Validation**: All user inputs are sanitized
- **Environment Variables**: Sensitive data in environment variables only
- **CORS**: Configured for secure cross-origin requests
- **Authentication**: Secure token management with automatic refresh

## 📊 Monitoring

### Health Checks
The `/api/health` endpoint provides:
- Application status
- Environment validation
- API connectivity
- Performance metrics

### Error Handling
- Comprehensive error logging
- User-friendly error messages
- Fallback mechanisms for API failures
- Automatic retry logic

## 🗺️ Roadmap

### Phase 2 (Coming Soon)
- **User Management**: Create, update, deactivate users
- **Advanced Reporting**: Generate and export reports
- **Bulk Operations**: CSV uploads and batch processing
- **Notifications**: Email and system notifications
- **Workflow Automation**: Smart enrollment rules

### Phase 3 (Future)
- **Multi-tenant Support**: Multiple Docebo instances
- **Advanced Analytics**: Usage and performance insights
- **Mobile App**: Native mobile interface
- **Integrations**: Slack, Teams, Zapier connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues
- **"User not found"**: Check email spelling and user existence in Docebo
- **"API error 401"**: Verify your OAuth2 credentials and user permissions
- **"Timeout"**: Large enrollments may need background processing endpoint

### Getting Help
- 📖 Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- 🐛 Report issues on GitHub
- 💬 Join our Discord community
- 📧 Email support@yourcompany.com

## 🙏 Acknowledgments

- Docebo for providing comprehensive API documentation
- Google for Gemini AI capabilities
- Next.js team for the excellent framework
- The open-source community for inspiration and tools

---

**Built with ❤️ for Docebo administrators everywhere**
