import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    // Redirect to Docebo for authorization
    const authUrl = new URL(`https://${process.env.DOCEBO_DOMAIN}/oauth2/authorize`);
    authUrl.searchParams.set('client_id', process.env.DOCEBO_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', `${request.nextUrl.origin}/api/auth/docebo`);
    authUrl.searchParams.set('scope', 'api');
    
    return NextResponse.redirect(authUrl.toString());
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await fetch(`https://${process.env.DOCEBO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.DOCEBO_CLIENT_ID!,
        client_secret: process.env.DOCEBO_CLIENT_SECRET!,
        code: code,
        redirect_uri: `${request.nextUrl.origin}/api/auth/docebo`,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.access_token) {
      // Test API call with new token
      const testResponse = await fetch(`https://${process.env.DOCEBO_DOMAIN}/manage/v1/users?limit=1`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });
      
      const testData = await testResponse.text();
      
      return NextResponse.json({
        status: 'oauth_success',
        token_received: true,
        api_test_status: testResponse.status,
        api_test_response: testData.substring(0, 500),
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      status: 'oauth_failed',
      error: 'No access token received',
      response: tokenData
    }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({
      status: 'oauth_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
