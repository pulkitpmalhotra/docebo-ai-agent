import { NextRequest, NextResponse } from 'next/server';
import { healthController } from '../controllers/healthController';

export async function GET(request: NextRequest) {
  const healthStatus = await healthController.checkHealth();
  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

  return NextResponse.json(healthStatus, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json'
    }
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'ping':
      return NextResponse.json({ message: 'pong', timestamp: new Date().toISOString() });

    case 'env_check':
      const envStatus = await healthController.checkEnv();
      return NextResponse.json(envStatus);

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: ping, env_check' },
        { status: 400 }
      );
  }
}
