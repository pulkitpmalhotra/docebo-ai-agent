import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      DOCEBO_DOMAIN: process.env.DOCEBO_DOMAIN ? 'Set' : 'Missing',
      DOCEBO_CLIENT_ID: process.env.DOCEBO_CLIENT_ID ? 'Set' : 'Missing',
      DOCEBO_CLIENT_SECRET: process.env.DOCEBO_CLIENT_SECRET ? 'Set' : 'Missing',
    };

    // Test basic URL construction
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    // Try just the OAuth endpoint first
    console.log('Testing OAuth endpoint:', `${baseUrl}/oauth2/token`);
    
    const response = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.DOCEBO_CLIENT_ID!,
        client_secret: process.env.DOCEBO_CLIENT_SECRET!,
        scope: 'api',
      }),
    });

    const responseText = await response.text();
    
    return NextResponse.json({
      status: 'debug',
      environment_variables: envCheck,
      docebo_url: baseUrl,
      oauth_endpoint: `${baseUrl}/oauth2/token`,
      response_status: response.status,
      response_headers: Object.fromEntries(response.headers.entries()),
      response_body: responseText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      status: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
