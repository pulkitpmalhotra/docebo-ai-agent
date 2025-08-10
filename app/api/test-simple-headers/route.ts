// app/api/test-simple-headers/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    // Get token first
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
      return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }

    const authData = await authResponse.json();
    const token = authData.access_token;
    
    // Test 1: Minimal headers (what curl would use)
    console.log('🧪 Test 1: Minimal headers');
    const test1Response = await fetch(`${baseUrl}/manage/v1/user?search_text=susantha@google.com`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const test1Text = await test1Response.text();
    const test1Result = {
      status: test1Response.status,
      contentType: test1Response.headers.get('content-type'),
      isJson: test1Response.headers.get('content-type')?.includes('application/json'),
      bodyPreview: test1Text.substring(0, 200),
      success: test1Response.status === 200 && test1Response.headers.get('content-type')?.includes('application/json')
    };

    // Test 2: Add Accept header
    console.log('🧪 Test 2: With Accept header');
    const test2Response = await fetch(`${baseUrl}/manage/v1/user?search_text=susantha@google.com`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    const test2Text = await test2Response.text();
    const test2Result = {
      status: test2Response.status,
      contentType: test2Response.headers.get('content-type'),
      isJson: test2Response.headers.get('content-type')?.includes('application/json'),
      bodyPreview: test2Text.substring(0, 200),
      success: test2Response.status === 200 && test2Response.headers.get('content-type')?.includes('application/json')
    };

    // Test 3: NO Content-Type (this might be the issue)
    console.log('🧪 Test 3: Standard headers without Content-Type');
    const test3Response = await fetch(`${baseUrl}/manage/v1/user?search_text=susantha@google.com`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'NodeJS-Fetch/1.0'
      }
    });
    
    const test3Text = await test3Response.text();
    const test3Result = {
      status: test3Response.status,
      contentType: test3Response.headers.get('content-type'),
      isJson: test3Response.headers.get('content-type')?.includes('application/json'),
      bodyPreview: test3Text.substring(0, 200),
      success: test3Response.status === 200 && test3Response.headers.get('content-type')?.includes('application/json')
    };

    // Test 4: What we were doing before (the broken one)
    console.log('🧪 Test 4: Our original headers (likely broken)');
    const test4Response = await fetch(`${baseUrl}/manage/v1/user?search_text=susantha@google.com`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'  // This might be causing 500!
      }
    });
    
    const test4Text = await test4Response.text();
    const test4Result = {
      status: test4Response.status,
      contentType: test4Response.headers.get('content-type'),
      isJson: test4Response.headers.get('content-type')?.includes('application/json'),
      bodyPreview: test4Text.substring(0, 200),
      success: test4Response.status === 200 && test4Response.headers.get('content-type')?.includes('application/json')
    };

    // Test 5: Try without search parameter
    console.log('🧪 Test 5: No search parameter, just get all users');
    const test5Response = await fetch(`${baseUrl}/manage/v1/user?page_size=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    const test5Text = await test5Response.text();
    const test5Result = {
      status: test5Response.status,
      contentType: test5Response.headers.get('content-type'),
      isJson: test5Response.headers.get('content-type')?.includes('application/json'),
      bodyPreview: test5Text.substring(0, 200),
      success: test5Response.status === 200 && test5Response.headers.get('content-type')?.includes('application/json')
    };

    const allResults = {
      'Test 1: Minimal headers': test1Result,
      'Test 2: With Accept': test2Result,
      'Test 3: No Content-Type': test3Result,
      'Test 4: Our original (broken)': test4Result,
      'Test 5: No search param': test5Result
    };

    const workingTests = Object.entries(allResults).filter(([_, result]) => result.success);
    
    return NextResponse.json({
      message: 'Simple header tests completed',
      authSuccess: true,
      results: allResults,
      summary: {
        workingTests: workingTests.map(([name, _]) => name),
        allFailed: workingTests.length === 0,
        suspectedIssue: test4Result.status === 500 && test3Result.status !== 500 ? 
          'Content-Type header on GET requests causes 500 error' : 
          'Unknown issue'
      },
      recommendation: workingTests.length > 0 ? 
        `Use the configuration from: ${workingTests[0][0]}` : 
        'All tests failed - API might be completely down',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
