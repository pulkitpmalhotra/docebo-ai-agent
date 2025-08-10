import { NextRequest, NextResponse } from 'next/server';

// Define the type for test results
interface TestResult {
  status: number;
  statusText: string;
  contentType: string | null;
  isJson: boolean;
  bodyPreview: string;
  success: boolean;
  error?: string;
}

export async function GET() {
  try {
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    console.log('🔑 Testing OAuth authentication only...');
    
    // Test just the OAuth endpoint
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
    
    if (!authResponse.ok) {
      return NextResponse.json({
        status: 'auth_failed',
        auth_status: authResponse.status,
        auth_response: authData,
        error: 'OAuth authentication failed'
      });
    }
    
    console.log('✅ OAuth successful, testing API endpoints...');
    
    // Test different API endpoint patterns that might work in sandbox
    const token = authData.access_token;
    const endpointsToTest = [
      '/manage/v1/users?limit=1',
      '/learn/v1/courses?limit=1',
      '/restapi/v1/users?limit=1',  // Alternative API path
      '/api/manage/v1/users?limit=1',  // Another alternative
      '/manage/users?limit=1',  // Simplified path
      '/learn/courses?limit=1',  // Simplified path
      '/api/v1/users?limit=1',  // Generic API path
    ];
    
    // Use proper typing for testResults
    const testResults: Record<string, TestResult> = {};
    
    for (const endpoint of endpointsToTest) {
      try {
        console.log(`Testing endpoint: ${endpoint}`);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        const responseText = await response.text();
        
        testResults[endpoint] = {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          isJson: response.headers.get('content-type')?.includes('application/json') || false,
          bodyPreview: responseText.substring(0, 200),
          success: response.status >= 200 && response.status < 300
        };
        
        if (response.status >= 200 && response.status < 300) {
          console.log(`✅ Working endpoint found: ${endpoint}`);
        }
        
      } catch (error) {
        testResults[endpoint] = {
          status: 0,
          statusText: 'Error',
          contentType: null,
          isJson: false,
          bodyPreview: '',
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        };
      }
    }
    
    return NextResponse.json({
      status: 'endpoint_test',
      auth_successful: true,
      token_received: !!token,
      base_url: baseUrl,
      endpoint_tests: testResults,
      working_endpoints: Object.entries(testResults).filter(([_, result]) => result.success),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
