// __tests__/api/health.test.js
import { GET, POST } from '../../app/api/health/route'
import { NextRequest } from 'next/server'

describe('/api/health', () => {
  let request

  beforeEach(() => {
    request = new NextRequest('http://localhost:3000/api/health')
  })

  describe('GET /api/health', () => {
    it('should return healthy status when all environment variables are present', async () => {
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.environment).toBe('healthy')
      expect(data.checks.api_ready).toBe('healthy')
      expect(data.version).toBe('1.0.0')
      expect(data.timestamp).toBeDefined()
      expect(data.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should return unhealthy status when environment variables are missing', async () => {
      // Temporarily remove an environment variable
      const originalDomain = process.env.DOCEBO_DOMAIN
      delete process.env.DOCEBO_DOMAIN

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.environment).toBe('unhealthy')
      expect(data.missing_env_vars).toContain('DOCEBO_DOMAIN')

      // Restore environment variable
      process.env.DOCEBO_DOMAIN = originalDomain
    })

    it('should include proper cache control headers', async () => {
      const response = await GET(request)
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })

  describe('POST /api/health', () => {
    it('should respond to ping action', async () => {
      const postRequest = new NextRequest('http://localhost:3000/api/health', {
        method: 'POST',
        body: JSON.stringify({ action: 'ping' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(postRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('pong')
      expect(data.timestamp).toBeDefined()
    })

    it('should provide environment check', async () => {
      const postRequest = new NextRequest('http://localhost:3000/api/health', {
        method: 'POST',
        body: JSON.stringify({ action: 'env_check' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(postRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.environment_variables).toBeDefined()
      expect(Array.isArray(data.environment_variables)).toBe(true)
      
      const doceboDomain = data.environment_variables.find(env => env.name === 'DOCEBO_DOMAIN')
      expect(doceboDomain.present).toBe(true)
    })

    it('should reject invalid actions', async () => {
      const postRequest = new NextRequest('http://localhost:3000/api/health', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid_action' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(postRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid action. Supported actions: ping, env_check')
    })

    it('should handle malformed JSON', async () => {
      const postRequest = new NextRequest('http://localhost:3000/api/health', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(postRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})
