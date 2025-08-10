import { NextRequest, NextResponse } from 'next/server';

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
    
    // Test the EXACT URL that worked in your manual test
    const exactUrl = '/manage/v1/user?search_text=1280143';
    console.log(`🎯 Testing exact replica: ${baseUrl}${exactUrl}`);
    
    // Try different header combinations
    const headerTests: Array<{name: string, headers: Record<string, string>}> = [
      {
        name: 'Minimal headers',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      },
      {
        name: 'Standard headers',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      },
      {
        name: 'Full headers',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Headers from your working example',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; DoceboAPI/1.0)',
          'Cache-Control': 'no-cache'
        }
      }
    ];
    
    const results: Record<string, any> = {};
    
    for (const test of headerTests) {
      try {
        console.log(`🧪 Testing headers: ${test.name}`);
        console.log(`📋 Headers:`, test.headers);
        
        const response = await fetch(`${baseUrl}${exactUrl}`, {
          method: 'GET',
          headers: test.headers
        });
        
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
        
        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();
        
        console.log(`📊 Content-Type: ${contentType}`);
        console.log(`📊 Response (first 300 chars): ${responseText.substring(0, 300)}`);
        
        let parsedResponse;
        let isJson = false;
        
        if (contentType.includes('application/json')) {
          try {
            parsedResponse = JSON.parse(responseText);
            isJson = true;
            console.log(`✅ JSON parsed successfully`);
          } catch (jsonError) {
            console.log(`❌ JSON parse failed:`, jsonError);
            parsedResponse = `JSON parse error: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`;
          }
        } else {
          parsedResponse = responseText.substring(0, 500);
        }
        
        results[test.name] = {
          status: response.status,
          statusText: response.statusText,
          success: response.status === 200 && isJson,
          contentType,
          isJson,
          userFound: isJson && parsedResponse?.data?.items?.some((user: any) => 
            user.username === '1280143' || user.email?.includes('susantha')
          ),
          itemCount: isJson ? (parsedResponse?.data?.items?.length || 0) : 0,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          responsePreview: typeof parsedResponse === 'string' ? parsedResponse : JSON.stringify(parsedResponse, null, 2).substring(0, 1000)
        };
        
      } catch (error) {
        console.error(`❌ Test failed:`, error);
        results[test.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    // Also test if the token itself is valid by checking token info
    let tokenInfo;
    try {
      console.log(`🔍 Testing token info...`);
      const tokenResponse = await fetch(`${baseUrl}/oauth2/token-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const tokenText = await tokenResponse.text();
      tokenInfo = {
        status: tokenResponse.status,
        response: tokenText.substring(0, 500)
      };
    } catch (tokenError) {
      tokenInfo = {
        error: tokenError instanceof Error ? tokenError.message : 'Unknown'
      };
    }
    
    return NextResponse.json({
      message: 'Exact replica test of your working API call',
      testedUrl: exactUrl,
      baseUrl,
      tokenPreview: token.substring(0, 20) + '...',
      tokenInfo,
      headerTests: results,
      summary: {
        successfulTests: Object.entries(results).filter(([_, result]) => result.success),
        foundWorkingApproach: Object.values(results).some(result => result.success)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🔥 Main error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
