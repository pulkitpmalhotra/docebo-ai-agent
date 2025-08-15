// jest.setup.js
import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.DOCEBO_DOMAIN = 'test.docebosaas.com'
process.env.DOCEBO_CLIENT_ID = 'test_client_id'
process.env.DOCEBO_CLIENT_SECRET = 'test_client_secret'
process.env.DOCEBO_USERNAME = 'test_username'
process.env.DOCEBO_PASSWORD = 'test_password'
process.env.GOOGLE_GEMINI_API_KEY = 'test_gemini_key'

// Mock fetch globally
global.fetch = jest.fn()

// Reset mocks between tests
beforeEach(() => {
  fetch.mockReset()
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}
