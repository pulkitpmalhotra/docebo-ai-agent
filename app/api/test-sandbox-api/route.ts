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
    
    // Test the exact pattern that worked in your earlier example
    const sandboxTests: Array<{name: string, url: string}> = [
      {
        name: 'Search for susantha by email',
        url: '/manage/v1/user?search_text=susantha@google.com'
      },
      {
        name: 'Search for susantha by name',
        url: '/manage/v1/user?search_text=susantha'
      },
      {
        name: 'Search for specific user ID',
        url: '/manage/v1/user?search_text=51153'
      },
      {
        name: 'Search with empty string (get all)',
        url: '/manage/v1/user?search_text='
      },
      {
        name: 'Search with wildcard',
        url: '/manage/v1/user?search_text=*'
      },
      {
        name: 'Search with limit',
        url: '/manage/v1/user?search_text=&limit=5'
      }
    ];
    
    const results: Record<string, any> = {};
    
    for (const test of sandboxTests) {
      try {
        console.log(`🧪 Testing: ${test.name}`);
        
        const response = await fetch(`${baseUrl}${test.url}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          const data = await response.json();
          
          results[test.name] = {
            status: response.status,
            success: response.status === 200,
            contentType,
            itemCount: data.data?.items?.length || 0,
            totalCount: data.data?.total_count || 0,
            foundSusantha: data.data?.items?.some((user: any) => 
              user.email?.toLowerCase().includes('susantha') ||
              user.first_name?.toLowerCase().includes('susantha')
            ) || false,
            sampleEmails: data.data?.items?.slice(0, 3).map((user: any) => user.email) || [],
            fullResponse: data
          };
        } else {
          const text = await response.text();
          results[test.name] = {
            status: response.status,
            success: false,
            contentType,
            error: 'Non-JSON response',
            responsePreview: text.substring(0, 200)
          };
        }
        
      } catch (error) {
        results[test.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return NextResponse.json({
      message: 'Sandbox-specific API pattern tests',
      baseUrl,
      authSuccess: !!token,
      results,
      summary: {
        workingEndpoints: Object.entries(results).filter(([_, result]) => result.success),
        susanthaFound: Object.entries(results).some(([_, result]) => result.foundSusantha)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
