export const config = {
  docebo: {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  },
  gemini: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
  }
};

// Validate on startup
const requiredEnvVars = [
  'DOCEBO_DOMAIN',
  'DOCEBO_CLIENT_ID', 
  'DOCEBO_CLIENT_SECRET',
  'DOCEBO_USERNAME',
  'DOCEBO_PASSWORD',
  'GOOGLE_GEMINI_API_KEY'
];

const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}
