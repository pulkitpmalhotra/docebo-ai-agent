# Troubleshooting Guide

Common issues and solutions for the Docebo AI Agent.

## 🚨 Quick Diagnostics

### Health Check
```bash
# Test if the application is running
curl -f http://localhost:3000/api/health

# Check environment variables
curl -X POST http://localhost:3000/api/health \
  -H "Content-Type: application/json" \
  -d '{"action": "env_check"}'
```

### Basic Functionality Test
```bash
# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find user test@example.com"}'
```

## 🔧 Common Issues

### 1. Environment Variables

#### **Issue**: "Missing required environment variable"
```json
{
  "status": "unhealthy",
  "missing_env_vars": ["DOCEBO_DOMAIN"]
}
```

**Solutions:**
1. **Check .env.local exists:**
   ```bash
   ls -la .env.local
   ```

2. **Verify all required variables:**
   ```bash
   cat .env.local | grep -E "DOCEBO_|GOOGLE_"
   ```

3. **For production deployment:**
   - Vercel: Dashboard → Project → Settings → Environment Variables
   - Netlify: Site Settings → Environment Variables
   - Docker: Check docker-compose.yml environment section

#### **Issue**: "Invalid Docebo domain format"
```
Error: Token request failed: 404
```

**Solutions:**
1. **Check domain format:**
   ```bash
   # Correct format (no https://)
   DOCEBO_DOMAIN=company.docebosaas.com
   
   # Incorrect formats
   DOCEBO_DOMAIN=https://company.docebosaas.com  # ❌
   DOCEBO_DOMAIN=company.docebosaas.com/         # ❌
   ```

2. **Verify domain accessibility:**
   ```bash
   curl -I https://your-domain.docebosaas.com
   ```

### 2. Docebo API Issues

#### **Issue**: "Authentication failed" (401 errors)
```json
{
  "error": "Docebo API error: 401"
}
```

**Solutions:**
1. **Verify OAuth2 credentials:**
   - Go to Docebo Admin → API and SSO → API Credentials
   - Check Client ID and Client Secret are correct
   - Ensure OAuth2 app is active

2. **Check user credentials:**
   - Verify username/password are correct
   - Ensure user has admin permissions
   - Test login manually in Docebo

3. **Test token generation:**
   ```bash
   curl -X POST "https://your-domain.docebosaas.com/oauth2/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=password&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=api&username=YOUR_USERNAME&password=YOUR_PASSWORD"
   ```

#### **Issue**: "User not found" responses
```json
{
  "response": "❌ User Not Found: john@company.com"
}
```

**Solutions:**
1. **Verify email spelling:**
   - Check for typos in email address
   - Ensure exact case match

2. **Check user exists in Docebo:**
   - Search manually in Docebo admin
   - Verify user is active (not suspended)

3. **Test API permissions:**
   ```bash
   # Test user search directly
   curl -X GET "https://your-domain.docebosaas.com/manage/v1/user?search_text=john@company.com" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

#### **Issue**: "Course not found" responses
**Solutions:**
1. **Check course name:**
   - Use exact course name from Docebo
   - Try searching with partial names
   - Check course is published/active

2. **Use course ID instead:**
   ```
   "Course info 123" (using course ID)
   ```

### 3. Performance Issues

#### **Issue**: Slow response times (>30 seconds)
**Solutions:**
1. **Use background processing:**
   ```bash
   # Instead of /api/chat, use:
   curl -X POST http://localhost:3000/api/chat-bg
   ```

2. **Increase timeouts:**
   ```bash
   API_TIMEOUT=60000
   ```

3. **Check Docebo API performance:**
   - Test direct API calls
   - Check Docebo system status

#### **Issue**: "Request timeout" errors
**Solutions:**
1. **For large datasets, use background processing:**
   ```javascript
   // Use chat-bg endpoint for users with many enrollments
   fetch('/api/chat-bg', {
     method: 'POST',
     body: JSON.stringify({ message: "User enrollments john@company.com" })
   })
   ```

2. **Increase timeout settings:**
   ```bash
   API_TIMEOUT=45000
   VERCEL_FUNCTION_TIMEOUT=30
   ```

### 4. Rate Limiting

#### **Issue**: "Rate limit exceeded" (429 errors)
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

**Solutions:**
1. **Wait for rate limit reset:**
   - Check `retryAfter` value in response
   - Wait specified seconds before retry

2. **Adjust rate limits:**
   ```bash
   API_RATE_LIMIT=200  # Increase limit
   ```

3. **For production, implement distributed rate limiting:**
   - Use Redis for rate limit storage
   - Implement user-based limits

### 5. Network and Connectivity

#### **Issue**: "Network error" or connection timeouts
**Solutions:**
1. **Check internet connectivity:**
   ```bash
   ping google.com
   ```

2. **Verify Docebo domain accessibility:**
   ```bash
   nslookup your-domain.docebosaas.com
   curl -I https://your-domain.docebosaas.com
   ```

3. **Check firewall/proxy settings:**
   - Ensure HTTPS traffic is allowed
   - Check corporate proxy settings

### 6. Development Issues

#### **Issue**: "Module not found" errors
**Solutions:**
1. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be >= 18.0.0
   npm --version   # Should be >= 8.0.0
   ```

#### **Issue**: TypeScript compilation errors
**Solutions:**
1. **Run type checking:**
   ```bash
   npm run type-check
   ```

2. **Fix common issues:**
   ```bash
   # Update TypeScript
   npm install typescript@latest

   # Clear Next.js cache
   rm -rf .next
   ```

#### **Issue**: Build failures
**Solutions:**
1. **Check build process:**
   ```bash
   npm run build
   ```

2. **Common fixes:**
   ```bash
   # Fix linting errors
   npm run lint:fix

   # Clear caches
   npm run clean
   npm install
   ```

## 🔍 Debugging Steps

### 1. Enable Debug Logging
```bash
# Add to .env.local
DEBUG=true
NODE_ENV=development
```

### 2. Check Application Logs

**Local Development:**
```bash
npm run dev
# Check console output
```

**Vercel:**
- Go to Vercel Dashboard → Your Project → Functions
- Click on function to see logs

**Docker:**
```bash
docker-compose logs -f docebo-ai-agent
```

### 3. Test Individual Components

**Test Intent Analyzer:**
```javascript
import { IntentAnalyzer } from './app/api/chat/intent-analyzer';
const result = IntentAnalyzer.analyzeIntent("Find user test@example.com");
console.log(result);
```

**Test Docebo API:**
```javascript
import { DoceboAPI } from './app/api/chat/docebo-api';
const api = new DoceboAPI(config);
const users = await api.searchUsers("test@example.com");
console.log(users);
```

### 4. API Response Analysis

**Check API response structure:**
```bash
# Test with verbose output
curl -v -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find user test@example.com"}'
```

## 📊 Monitoring and Alerts

### Set Up Monitoring

**1. Health Check Monitoring:**
```bash
# Add to cron job or monitoring service
*/5 * * * * curl -f https://your-app.vercel.app/api/health || echo "Health check failed"
```

**2. Error Rate Monitoring:**
- Monitor 4xx and 5xx response rates
- Set alerts for >5% error rate

**3. Response Time Monitoring:**
- Monitor average response times
- Set alerts for >10 second responses

### Log Analysis

**Look for patterns in logs:**
1. **Authentication failures:** Multiple 401 errors
2. **Rate limiting:** 429 errors clustering
3. **Timeouts:** Requests taking >30 seconds
4. **Invalid inputs:** Malformed requests

## 🆘 Getting Help

### Before Seeking Help

1. **Check this troubleshooting guide**
2. **Review application logs**
3. **Test with curl commands**
4. **Verify environment configuration**

### Information to Include

When reporting issues, provide:

1. **Error message** (exact text)
2. **Steps to reproduce**
3. **Environment details:**
   ```bash
   node --version
   npm --version
   npm list --depth=0
   ```
4. **Configuration** (without secrets):
   ```bash
   # Example
   DOCEBO_DOMAIN=company.docebosaas.com
   NODE_ENV=production
   API_RATE_LIMIT=100
   ```
5. **Logs** (relevant sections only)

### Support Channels

1. **GitHub Issues:** Create detailed issue with reproduction steps
2. **Documentation:** Check README.md and API documentation
3. **Community:** Join Discord/Slack for community support
4. **Email Support:** For urgent production issues

## 🔄 Recovery Procedures

### Application Recovery

**1. Restart Application:**
```bash
# Local development
npm run dev

# Docker
docker-compose restart

# Vercel - redeploy
vercel --prod
```

**2. Clear Caches:**
```bash
# Clear Next.js cache
rm -rf .next

# Clear npm cache
npm cache clean --force

# Clear rate limit cache (if using file-based)
# Rate limits reset automatically after time window
```

**3. Database Recovery (if applicable):**
```bash
# Current version has no database
# Future versions may include database recovery procedures
```

### Emergency Procedures

**1. Rollback Deployment:**
```bash
# For Vercel
vercel rollback [DEPLOYMENT_URL]

# For Docker
docker-compose down
docker-compose up -d [PREVIOUS_IMAGE_TAG]
```

**2. Temporary Disable Features:**
```bash
# Disable rate limiting
API_RATE_LIMIT=99999

# Disable input validation (emergency only)
DISABLE_VALIDATION=true
```

**3. Maintenance Mode:**
```bash
# Add maintenance mode flag
MAINTENANCE_MODE=true
```

Remember: Always test fixes in development before applying to production!
