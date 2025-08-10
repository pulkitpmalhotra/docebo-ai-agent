import { NextRequest, NextResponse } from 'next/server';

// Define proper types for the endpoint configuration
interface EndpointConfig {
  endpoint: string;
  headers: Record<string, string>;
}

interface TestResult {
  status: number;
  contentType: string;
  isJson: boolean;
  success: boolean;
  headers_used: Record<string, string>;
  body_preview: any;
  error?: string;
}

export async function GET() {
  try {
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    // Get auth token
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

    if (!authResponse.ok) {
      return NextResponse.json({
        status: 'auth_failed',
        message: 'Could not authenticate with Docebo'
      });
    }

    const authData = await authResponse.json();
    const token = authData.access_token;
    
    // Test sandbox-specific patterns based on your earlier findings
    const sandboxEndpoints: (string | EndpointConfig)[] = [
      // These were returning 200 in your earlier tests but as HTML
      '/restapi/v1/users',
      '/manage/user',
      '/manage/users', 
      '/learn/course',
      '/learn/courses',
      
      // Try with different headers that might return JSON
      { 
        endpoint: '/restapi/v1/users', 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      },
      { 
        endpoint: '/manage/users', 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    ];
    
    const results: Record<string, TestResult> = {};
    
    for (const endpointConfig of sandboxEndpoints) {
      const endpoint = typeof endpointConfig === 'string' ? endpointConfig : endpointConfig.endpoint;
      
      // Ensure headers are properly typed with all string values
      const headers: Record<string, string> = typeof endpointConfig === 'string' 
        ? {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        : endpointConfig.headers;
      
      try {
        console.log(`Testing sandbox endpoint: ${endpoint}`);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: headers
        });
        
        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();
        
        let parsedBody;
        try {
          if (contentType.includes('application/json')) {
            parsedBody = JSON.parse(responseText);
          } else {
            parsedBody = responseText.substring(0, 300) + '...';
          }
        } catch {
          parsedBody = responseText.substring(0, 300) + '...';
        }
        
        results[endpoint] = {
          status: response.status,
          contentType: contentType,
          isJson: contentType.includes('application/json'),
          success: response.status === 200 && contentType.includes('application/json'),
          headers_used: headers,
          body_preview: parsedBody
        };
        
      } catch (error) {
        results[endpoint] = {
          status: 0,
          contentType: '',
          isJson: false,
          success: false,
          headers_used: headers,
          body_preview: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return NextResponse.json({
      status: 'sandbox_test',
      message: 'Testing sandbox-specific API patterns',
      auth_successful: true,
      results: results,
      working_json_endpoints: Object.entries(results).filter(([_, result]) => result.success),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
