// lib/config/environment.ts - Centralized environment configuration
export interface EnvironmentConfig {
  docebo: {
    domain: string;
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  };
  gemini: {
    apiKey: string;
  };
  app: {
    nodeEnv: string;
    isDevelopment: boolean;
    isProduction: boolean;
  };
}

function validateEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function createConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    docebo: {
      domain: validateEnvironmentVariable('DOCEBO_DOMAIN', process.env.DOCEBO_DOMAIN),
      clientId: validateEnvironmentVariable('DOCEBO_CLIENT_ID', process.env.DOCEBO_CLIENT_ID),
      clientSecret: validateEnvironmentVariable('DOCEBO_CLIENT_SECRET', process.env.DOCEBO_CLIENT_SECRET),
      username: validateEnvironmentVariable('DOCEBO_USERNAME', process.env.DOCEBO_USERNAME),
      password: validateEnvironmentVariable('DOCEBO_PASSWORD', process.env.DOCEBO_PASSWORD),
    },
    gemini: {
      apiKey: validateEnvironmentVariable('GOOGLE_GEMINI_API_KEY', process.env.GOOGLE_GEMINI_API_KEY),
    },
    app: {
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
    }
  };
}

// Validate environment on module load
let config: EnvironmentConfig;

try {
  config = createConfig();
  console.log('✅ Environment configuration loaded successfully');
} catch (error) {
  console.error('❌ Environment configuration failed:', error);
  throw error;
}

export { config };

// Helper function to validate specific requirements
export function validatePhase1Requirements(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Test Docebo domain format
    if (!config.docebo.domain.includes('.')) {
      errors.push('DOCEBO_DOMAIN should be a valid domain (e.g., company.docebosaas.com)');
    }

    // Test Gemini API key format
    if (!config.gemini.apiKey.startsWith('AIza')) {
      errors.push('GOOGLE_GEMINI_API_KEY should start with "AIza"');
    }

    // Ensure no placeholder values
    const placeholderValues = ['your-domain', 'your-client-id', 'your-secret', 'your-username'];
    const configValues = [
      config.docebo.domain,
      config.docebo.clientId,
      config.docebo.clientSecret,
      config.docebo.username
    ];

    placeholderValues.forEach(placeholder => {
      if (configValues.some(value => value.toLowerCase().includes(placeholder))) {
        errors.push(`Found placeholder value "${placeholder}" in configuration`);
      }
    });

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { 
      valid: false, 
      errors: [`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}
