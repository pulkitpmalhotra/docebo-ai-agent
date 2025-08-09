import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Hello from Docebo AI Agent API!',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
}
