import { NextResponse } from 'next/server';

interface EndpointTestResult {
  status: number | string;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  success: boolean;
  error?: string;
}

export async function GET() {
  try {
    // Get auth token first
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    const authResponse = await fetch(`${baseUrl}/oauth2/token`, {
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

    const authData = await authResponse.json();
    const token = authData.access_token;

    // Test multiple endpoints to see which ones work
    const endpointsToTest = [
      '/manage/v1/users',
      '/manage/v1/users?limit=1',
      '/learn/v1/courses',
      '/learn/v1/courses?limit=1',
      '/manage/v1/user/me',
      '/analytics/v1/reports/overview',
      '/learn/v1/learning-plans'
    ];

    const results: Record<string, EndpointTestResult> = {};

    for (const endpoint of endpointsToTest) {
      try {
        console.log(`Testing endpoint: ${endpoint}`);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        const responseText = await response.text();
        
        let parsedBody;
        try {
          parsedBody = response.status < 300 ? JSON.parse(responseText) : responseText;
        } catch {
          parsedBody = responseText;
        }
        
        results[endpoint] = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
          success: response.status < 300
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results[endpoint] = {
          status: 'error',
          error: errorMessage,
          success: false
        };
      }
    }

    return NextResponse.json({
      status: 'debug',
      token_received: !!token,
      base_url: baseUrl,
      endpoint_tests: results,
      summary: {
        total_endpoints: endpointsToTest.length,
        successful_endpoints: Object.values(results).filter(r => r.success).length,
        failed_endpoints: Object.values(results).filter(r => !r.success).length
      },
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
