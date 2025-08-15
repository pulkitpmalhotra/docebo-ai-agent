# Deployment Guide

This guide covers deploying the Docebo AI Agent to various platforms.

## 🚀 Quick Deploy (Vercel - Recommended)

### Prerequisites
- GitHub repository with your code
- Vercel account
- Docebo admin credentials
- Google Gemini API key

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Link to existing project or create new
# - Set up project settings
# - Deploy
```

### 2. Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```bash
# Required Variables
DOCEBO_DOMAIN=your-domain.docebosaas.com
DOCEBO_CLIENT_ID=your_client_id
DOCEBO_CLIENT_SECRET=your_client_secret
DOCEBO_USERNAME=your_admin_username
DOCEBO_PASSWORD=your_admin_password
GOOGLE_GEMINI_API_KEY=your_gemini_key

# Optional Variables
NODE_ENV=production
API_RATE_LIMIT=100
API_TIMEOUT=30000
```

### 3. Deploy Production Version

```bash
vercel --prod
```

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  docebo-ai-agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DOCEBO_DOMAIN=${DOCEBO_DOMAIN}
      - DOCEBO_CLIENT_ID=${DOCEBO_CLIENT_ID}
      - DOCEBO_CLIENT_SECRET=${DOCEBO_CLIENT_SECRET}
      - DOCEBO_USERNAME=${DOCEBO_USERNAME}
      - DOCEBO_PASSWORD=${DOCEBO_PASSWORD}
      - GOOGLE_GEMINI_API_KEY=${GOOGLE_GEMINI_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Deploy with Docker
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## ☁️ Other Cloud Platforms

### Netlify

1. **Connect Repository**
   - Go to Netlify Dashboard
   - Click "New site from Git"
   - Connect your GitHub repository

2. **Build Settings**
   ```bash
   Build command: npm run build
   Publish directory: .next
   ```

3. **Environment Variables**
   - Go to Site Settings → Environment Variables
   - Add all required variables from `.env.example`

4. **Deploy**
   - Netlify will automatically deploy on git push

### AWS Amplify

1. **Connect Repository**
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   amplify init
   amplify add hosting
   amplify publish
   ```

2. **Environment Variables**
   - Set in Amplify Console → App Settings → Environment Variables

### Railway

1. **Deploy from GitHub**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login and deploy
   railway login
   railway link
   railway up
   ```

2. **Environment Variables**
   - Set in Railway Dashboard → Variables

### Render

1. **Create Web Service**
   - Connect GitHub repository
   - Set build command: `npm run build`
   - Set start command: `npm start`

2. **Environment Variables**
   - Add in Render Dashboard → Environment

## 🔧 Production Configuration

### Environment Variables Checklist

**Required:**
- [ ] `DOCEBO_DOMAIN`
- [ ] `DOCEBO_CLIENT_ID`
- [ ] `DOCEBO_CLIENT_SECRET`
- [ ] `DOCEBO_USERNAME`
- [ ] `DOCEBO_PASSWORD`
- [ ] `GOOGLE_GEMINI_API_KEY`

**Recommended:**
- [ ] `NODE_ENV=production`
- [ ] `API_RATE_LIMIT=100`
- [ ] `API_TIMEOUT=30000`
- [ ] `CACHE_DURATION=300`

**Optional:**
- [ ] `SENTRY_DSN` (error tracking)
- [ ] `NEXT_PUBLIC_GA_ID` (analytics)
- [ ] `API_KEY` (API protection)
- [ ] `ALLOWED_ORIGINS` (CORS)

### Security Configuration

```bash
# Add security headers
SECURITY_HEADERS=true

# Enable rate limiting
API_RATE_LIMIT=100

# Set allowed origins for CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Optional API key protection
API_KEY=your_secure_api_key_here
```

### Performance Optimization

```bash
# Cache settings
CACHE_DURATION=300

# API timeout
API_TIMEOUT=30000

# Connection pool settings
DB_CONNECTION_LIMIT=10
```

## 📊 Monitoring Setup

### Health Checks

All platforms should monitor:
```
GET /api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123456,
  "checks": {
    "environment": "healthy",
    "api_ready": "healthy"
  }
}
```

### Error Tracking (Sentry)

1. **Install Sentry**
   ```bash
   npm install @sentry/nextjs
   ```

2. **Configure**
   ```javascript
   // sentry.client.config.js
   import * as Sentry from "@sentry/nextjs";

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     tracesSampleRate: 1.0,
   });
   ```

3. **Environment Variable**
   ```bash
   SENTRY_DSN=your_sentry_dsn_here
   ```

### Analytics (Google Analytics)

1. **Environment Variable**
   ```bash
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
   ```

2. **Add to Layout**
   ```javascript
   // In app/layout.tsx
   import { GoogleAnalytics } from '@next/third-parties/google'

   export default function RootLayout({ children }) {
     return (
       <html>
         <body>{children}</body>
         <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
       </html>
     )
   }
   ```

## 🔧 Post-Deployment Checklist

### Functional Testing
- [ ] Health check endpoint responds
- [ ] User search works
- [ ] Course search works
- [ ] Learning plan search works
- [ ] Enrollment management functions
- [ ] Error handling works properly

### Performance Testing
- [ ] Response times under 2 seconds
- [ ] Rate limiting works
- [ ] Memory usage stable
- [ ] No memory leaks

### Security Testing
- [ ] HTTPS enabled
- [ ] Security headers present
- [ ] Rate limiting active
- [ ] Input validation working
- [ ] No sensitive data exposed

### Monitoring Setup
- [ ] Health checks configured
- [ ] Error tracking active
- [ ] Analytics configured
- [ ] Alerts set up

## 🚨 Troubleshooting

### Common Issues

**1. Environment Variables Not Found**
```bash
# Check environment variables are set
curl -X POST https://your-app.vercel.app/api/health \
  -H "Content-Type: application/json" \
  -d '{"action": "env_check"}'
```

**2. Docebo API Connection Issues**
```bash
# Test Docebo connectivity
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find user test@example.com"}'
```

**3. Build Failures**
```bash
# Check build logs in platform dashboard
# Common fixes:
npm run type-check  # Fix TypeScript errors
npm run lint       # Fix linting errors
npm audit fix      # Fix security vulnerabilities
```

**4. Runtime Errors**
```bash
# Check application logs
# Enable debug mode temporarily:
DEBUG=true
```

### Performance Issues

**1. Slow API Responses**
- Increase `API_TIMEOUT`
- Check Docebo API performance
- Enable caching with `CACHE_DURATION`

**2. Memory Issues**
- Monitor memory usage
- Check for memory leaks
- Restart application if needed

**3. Rate Limiting Issues**
- Adjust `API_RATE_LIMIT`
- Implement Redis for distributed rate limiting
- Monitor usage patterns

## 🔄 Updates and Maintenance

### Deployment Updates
```bash
# For Vercel
git push origin main  # Auto-deploys

# For Docker
docker-compose pull
docker-compose up -d

# For other platforms
# Follow platform-specific update procedures
```

### Database Maintenance
```bash
# No database required for current version
# Future versions may include:
# - Database migrations
# - Cache clearing
# - Data backups
```

### Security Updates
```bash
# Regular security updates
npm audit
npm audit fix

# Update dependencies
npm update

# Check for critical security patches
npm outdated
```

## 📞 Support

If you encounter issues during deployment:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review platform-specific documentation
3. Check application logs
4. Test with health check endpoint
5. Open an issue on GitHub with:
   - Platform used
   - Error messages
   - Environment configuration (without secrets)
   - Steps to reproduce
