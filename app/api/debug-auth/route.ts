import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    console.log('🔐 Starting auth debug...');
    console.log('🌐 Base URL:', baseUrl);
    console.log('🔑 Client ID:', process.env.DOCEBO_CLIENT_ID?.substring(0, 8) + '...');
    
    // Step 1: Test OAuth endpoint
    console.log('🔐 Testing OAuth...');
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

    console.log('🔐 Auth response status:', authResponse.status);
    console.log('🔐 Auth response headers:', Object.fromEntries(authResponse.headers.entries()));
    
    let authData;
    let authSuccess = false;
    try {
      const authText = await authResponse.text();
      console.log('🔐 Auth response text (first 500 chars):', authText.substring(0, 500));
      
      if (authResponse.headers.get('content-type')?.includes('application/json')) {
        authData = JSON.parse(authText);
        authSuccess = !!authData.access_token;
        console.log('🔐 Auth successful:', authSuccess);
      } else {
        console.log('❌ Auth response is not JSON');
        return NextResponse.json({
          error: 'OAuth response is not JSON',
          status: authResponse.status,
          headers: Object.fromEntries(authResponse.headers.entries()),
          body: authText.substring(0, 1000)
        });
      }
    } catch (parseError) {
      console.error('❌ Failed to parse auth response:', parseError);
      return NextResponse.json({
        error: 'Failed to parse OAuth response',
        parseError: parseError instanceof Error ? parseError.message : 'Unknown'
      });
    }

    if (!authSuccess) {
      return NextResponse.json({
        error: 'OAuth failed',
        authResponse: authData,
        status: authResponse.status
      });
    }

    const token = authData.access_token;
    console.log('✅ Got token:', token.substring(0, 20) + '...');
    
    // Step 2: Test API calls with different approaches
    const testCalls = [
      {
        name: 'Standard API call',
        url: '/manage/v1/user?limit=1',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'API call without Content-Type',
        url: '/manage/v1/user?limit=1', 
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      },
      {
        name: 'API call with User-Agent',
        url: '/manage/v1/user?limit=1',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'DoceboAI/1.0'
        }
      },
      {
        name: 'Alternative endpoint',
        url: '/restapi/v1/user?limit=1',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    ];

    const results: Record<string, any> = {};

    for (const test of testCalls) {
      try {
        console.log(`🧪 Testing: ${test.name}`);
        
        const apiResponse = await fetch(`${baseUrl}${test.url}`, {
          method: 'GET',
          headers: test.headers
        });
        
        console.log(`📊 ${test.name} status:`, apiResponse.status);
        console.log(`📊 ${test.name} headers:`, Object.fromEntries(apiResponse.headers.entries()));
        
        const contentType = apiResponse.headers.get('content-type') || '';
        const responseText = await apiResponse.text();
        
        console.log(`📊 ${test.name} content-type:`, contentType);
        console.log(`📊 ${test.name} response (first 200 chars):`, responseText.substring(0, 200));
        
        let parsedResponse;
        let isJson = false;
        
        if (contentType.includes('application/json')) {
          try {
            parsedResponse = JSON.parse(responseText);
            isJson = true;
          } catch (jsonError) {
            parsedResponse = `JSON parse error: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`;
          }
        } else {
          parsedResponse = responseText.substring(0, 500) + '...';
        }
        
        results[test.name] = {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          contentType,
          isJson,
          responsePreview: parsedResponse,
          headers: Object.fromEntries(apiResponse.headers.entries())
        };
        
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error);
        results[test.name] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return NextResponse.json({
      message: 'Authentication and API debug complete',
      baseUrl,
      authSuccess,
      tokenPreview: token.substring(0, 20) + '...',
      apiTests: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🔥 Debug error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
