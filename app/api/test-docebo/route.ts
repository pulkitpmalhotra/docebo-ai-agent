import { NextResponse } from 'next/server';
import { DoceboClient } from '@/lib/docebo';

export async function GET() {
  try {
    // Check if all required environment variables exist
    const requiredEnvVars = ['DOCEBO_DOMAIN', 'DOCEBO_CLIENT_ID', 'DOCEBO_CLIENT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json({
        status: 'failed',
        error: `Missing environment variables: ${missingVars.join(', ')}`,
        help: 'Add these variables in Vercel dashboard under Environment Variables'
      }, { status: 500 });
    }

    console.log('Testing Docebo API connection...');
    
    const docebo = new DoceboClient();
    const healthCheck = await docebo.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      // Test a simple API call
      const users = await docebo.getUsers({ limit: 3 });
      
      return NextResponse.json({
        status: 'success',
        message: 'Docebo API is working!',
        health_check: healthCheck,
        sample_data: {
          users_found: users.data?.length || 0,
          users_sample: users.data?.slice(0, 2).map((user: any) => ({
            id: user.id,
            email: user.email,
            name: `${user.firstname} ${user.lastname}`
          })) || []
        },
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        status: 'failed',
        error: 'Docebo API health check failed',
        details: healthCheck,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Docebo API test failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      help: 'Check your Docebo credentials and API permissions'
    }, { status: 500 });
  }
}
