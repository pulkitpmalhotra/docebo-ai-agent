// app/api/health/route.ts - Simplified health check for Phase 1 MVP
import { NextRequest, NextResponse } from 'next/server';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    environment: 'healthy' | 'unhealthy';
    api_ready: 'healthy' | 'unhealthy';
  };
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Simple environment check
    const requiredEnvVars = [
      'DOCEBO_DOMAIN',
      'DOCEBO_CLIENT_ID',
      'DOCEBO_CLIENT_SECRET',
      'DOCEBO_USERNAME',
      'DOCEBO_PASSWORD',
      'GOOGLE_GEMINI_API_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    const envHealthy = missingEnvVars.length === 0;
    
    // Simple API readiness check
    const apiReady = true; // We assume API is ready if we can respond
    
    const healthStatus: HealthResponse = {
      status: envHealthy && apiReady ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: now - startTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        environment: envHealthy ? 'healthy' : 'unhealthy',
        api_ready: apiReady ? 'healthy' : 'unhealthy'
      }
    };

    // Add missing environment variables to response if any
    if (missingEnvVars.length > 0) {
      (healthStatus as any).missing_env_vars = missingEnvVars;
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(healthStatus, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        environment: 'unhealthy',
        api_ready: 'unhealthy'
      }
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

// Optional: Simple POST endpoint for health actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'ping':
        return NextResponse.json({ 
          message: 'pong',
          timestamp: new Date().toISOString()
        });

      case 'env_check':
        const requiredEnvVars = [
          'DOCEBO_DOMAIN',
          'DOCEBO_CLIENT_ID',
          'DOCEBO_CLIENT_SECRET',
          'DOCEBO_USERNAME',
          'DOCEBO_PASSWORD',
          'GOOGLE_GEMINI_API_KEY'
        ];
        
        const envStatus = requiredEnvVars.map(varName => ({
          name: varName,
          present: !!process.env[varName],
          value_preview: process.env[varName] ? 
            (process.env[varName]!.length > 10 ? 
              process.env[varName]!.substring(0, 10) + '...' : 
              process.env[varName]) : 
            'missing'
        }));
        
        return NextResponse.json({
          environment_variables: envStatus,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: ping, env_check' },
          { status: 400 }
        );
    }

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
