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
    
    // Test different search approaches
    const searchTests = [
      { name: 'Search for susantha@google.com', url: `/manage/v1/user?search_text=susantha@google.com` },
      { name: 'Search for susantha', url: `/manage/v1/user?search_text=susantha` },
      { name: 'Search for google', url: `/manage/v1/user?search_text=google` },
      { name: 'Search for 51153 (user_id)', url: `/manage/v1/user?search_text=51153` },
      { name: 'Get all users (limit 10)', url: `/manage/v1/user?limit=10` },
      { name: 'Get user by ID 51153', url: `/manage/v1/user/51153` },
    ];
    
    const results: Record<string, any> = {};
    
    for (const test of searchTests) {
      try {
        console.log(`Testing: ${test.name}`);
        
        const response = await fetch(`${baseUrl}${test.url}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        const data = await response.json();
        
        results[test.name] = {
          status: response.status,
          itemCount: data.data?.items?.length || 0,
          totalCount: data.data?.total_count || 0,
          firstItem: data.data?.items?.[0] || null,
          allEmails: data.data?.items?.map((user: any) => user.email) || [],
          fullResponse: data
        };
        
      } catch (error) {
        results[test.name] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return NextResponse.json({
      message: 'Manual search tests',
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
