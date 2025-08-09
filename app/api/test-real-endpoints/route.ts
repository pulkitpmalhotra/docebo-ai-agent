import { NextResponse } from 'next/server';

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

    const authData = await authResponse.json();
    const token = authData.access_token;

    // Try alternative endpoint patterns based on API browser
    const alternativeEndpoints = [
      // Alternative API versions
      '/api/v1/users',
      '/api/v1/user',
      '/restapi/v1/users',
      
      // Different manage paths
      '/manage/v1/user',
      '/manage/user',
      '/manage/users',
      
      // Different learn paths  
      '/learn/v1/course',
      '/learn/course',
      '/learn/courses',
      
      // API browser pattern
      '/api/manage/v1/user',
      '/api/learn/v1/course',
      
      // Check what's actually available
      '/api',
      '/manage',
      '/learn',
      
      // Try getting API documentation
      '/api/swagger.json',
      '/api/docs',
      '/swagger.json'
    ];

    const results: Record<string, any> = {};

    for (const endpoint of alternativeEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        const responseText = await response.text();
        
        results[endpoint] = {
          status: response.status,
          statusText: response.statusText,
          success: response.status < 400,
          contentType: response.headers.get('content-type'),
          bodyPreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
        };

        // If we find something that works, log it
        if (response.status < 400) {
          console.log(`✅ Working endpoint found: ${endpoint}`);
        }

      } catch (error) {
        results[endpoint] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        };
      }
    }

    return NextResponse.json({
      status: 'endpoint_discovery',
      base_url: baseUrl,
      token_received: !!token,
      working_endpoints: Object.entries(results).filter(([_, result]) => result.success),
      all_results: results,
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
