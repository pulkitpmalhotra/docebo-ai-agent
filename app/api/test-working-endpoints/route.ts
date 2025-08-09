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

    // Test the working endpoint with different headers
    const testEndpoint = '/restapi/v1/users';
    
    // Define header variations with proper types
    const headerVariations: Record<string, string>[] = [
      // Standard API headers
      {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Try with different Accept headers
      {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      // Try with X-Requested-With (AJAX header)
      {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      // Try with API version header
      {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'API-Version': 'v1'
      }
    ];

    const results: Record<string, any> = {};

    for (let i = 0; i < headerVariations.length; i++) {
      const headers = headerVariations[i];
      
      try {
        const response = await fetch(`${baseUrl}${testEndpoint}`, {
          method: 'GET',
          headers: headers
        });

        const responseText = await response.text();
        
        // Try to parse as JSON
        let parsedBody;
        try {
          parsedBody = JSON.parse(responseText);
        } catch {
          parsedBody = responseText.substring(0, 300) + '...';
        }

        results[`test_${i + 1}`] = {
          headers_used: headers,
          status: response.status,
          content_type: response.headers.get('content-type'),
          is_json: response.headers.get('content-type')?.includes('application/json'),
          body_preview: parsedBody,
          success: response.status === 200 && response.headers.get('content-type')?.includes('application/json')
        };

      } catch (error) {
        results[`test_${i + 1}`] = {
          headers_used: headers,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Also test with query parameters
    try {
      const queryHeaders: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };

      const response = await fetch(`${baseUrl}${testEndpoint}?limit=3&format=json`, {
        method: 'GET',
        headers: queryHeaders
      });

      const responseText = await response.text();
      let parsedBody;
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText.substring(0, 300);
      }

      results['with_query_params'] = {
        endpoint: `${testEndpoint}?limit=3&format=json`,
        status: response.status,
        content_type: response.headers.get('content-type'),
        is_json: response.headers.get('content-type')?.includes('application/json'),
        body_preview: parsedBody,
        success: response.status === 200 && response.headers.get('content-type')?.includes('application/json')
      };

    } catch (error) {
      results['with_query_params'] = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json({
      status: 'header_testing',
      endpoint_tested: testEndpoint,
      base_url: baseUrl,
      results: results,
      successful_tests: Object.values(results).filter((r: any) => r.success).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
