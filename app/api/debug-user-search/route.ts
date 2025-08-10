// app/api/debug-user-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'susantha@google.com';
    
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    console.log('🔍 Debug User Search for:', email);
    console.log('🌐 Base URL:', baseUrl);
    
    // Step 1: Get OAuth token
    console.log('🔑 Step 1: Getting OAuth token...');
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
      const authError = await authResponse.text();
      return NextResponse.json({
        step: 'authentication',
        status: 'failed',
        error: `Auth failed: ${authResponse.status} ${authResponse.statusText}`,
        details: authError
      });
    }

    const authData = await authResponse.json();
    const token = authData.access_token;
    
    console.log('✅ OAuth token obtained');

    // Step 2: Test different user search approaches
    const searchTests = [
      {
        name: 'Direct email search',
        url: `/manage/v1/user?search_text=${encodeURIComponent(email)}`,
        description: 'Search for user by exact email'
      },
      {
        name: 'Partial email search',
        url: `/manage/v1/user?search_text=${encodeURIComponent(email.split('@')[0])}`,
        description: 'Search for user by email prefix'
      },
      {
        name: 'Domain search',
        url: `/manage/v1/user?search_text=${encodeURIComponent(email.split('@')[1])}`,
        description: 'Search for users by domain'
      },
      {
        name: 'First name search (susantha)',
        url: `/manage/v1/user?search_text=susantha`,
        description: 'Search by first name'
      },
      {
        name: 'User ID search (51153)',
        url: `/manage/v1/user?search_text=51153`,
        description: 'Search by user ID from mock data'
      },
      {
        name: 'Username search (1280143)',
        url: `/manage/v1/user?search_text=1280143`,
        description: 'Search by username from mock data'
      },
      {
        name: 'List all users (limit 5)',
        url: `/manage/v1/user?limit=5`,
        description: 'Get first 5 users to see API structure'
      },
      {
        name: 'Empty search',
        url: `/manage/v1/user?search_text=`,
        description: 'Empty search to get all users'
      }
    ];

    const results: Record<string, any> = {};

    for (const test of searchTests) {
      try {
        console.log(`🧪 Testing: ${test.name}`);
        console.log(`📋 URL: ${test.url}`);
        
        const response = await fetch(`${baseUrl}${test.url}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log(`📊 Response (first 500 chars): ${responseText.substring(0, 500)}`);

        let parsedResponse;
        let isJson = false;
        let isHtml = false;

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          try {
            parsedResponse = JSON.parse(responseText);
            isJson = true;
          } catch (jsonError) {
            parsedResponse = `JSON parse error: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`;
          }
        } else if (contentType.includes('text/html') || responseText.includes('<html>')) {
          isHtml = true;
          parsedResponse = responseText.substring(0, 1000);
        } else {
          parsedResponse = responseText.substring(0, 500);
        }

        results[test.name] = {
          status: response.status,
          statusText: response.statusText,
          success: response.status === 200 && isJson,
          contentType,
          isJson,
          isHtml,
          description: test.description,
          url: test.url,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          responsePreview: parsedResponse,
          userFound: isJson && parsedResponse?.data?.items?.some((user: any) => 
            user.email?.toLowerCase().includes(email.toLowerCase()) ||
            user.first_name?.toLowerCase().includes('susantha')
          ),
          itemCount: isJson ? (parsedResponse?.data?.items?.length || 0) : 0,
          fullResponse: isJson ? parsedResponse : undefined
        };

        // If we found a working endpoint, try to find the specific user
        if (response.status === 200 && isJson && parsedResponse?.data?.items) {
          const foundUser = parsedResponse.data.items.find((user: any) => 
            user.email?.toLowerCase() === email.toLowerCase()
          );
          if (foundUser) {
            results[test.name].specificUser = foundUser;
          }
        }

      } catch (error) {
        console.error(`❌ Test failed: ${test.name}`, error);
        results[test.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          description: test.description,
          url: test.url
        };
      }
    }

    // Step 3: Try alternative endpoints
    const alternativeEndpoints = [
      '/restapi/v1/user',
      '/manage/user',
      '/api/manage/v1/user',
      '/learn/v1/user'
    ];

    console.log('🔄 Testing alternative endpoints...');
    
    for (const endpoint of alternativeEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}?limit=1`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        const responseText = await response.text();
        const contentType = response.headers.get('content-type') || '';

        results[`Alternative: ${endpoint}`] = {
          status: response.status,
          contentType,
          isJson: contentType.includes('application/json'),
          responsePreview: responseText.substring(0, 200),
          description: 'Alternative endpoint test'
        };

      } catch (error) {
        results[`Alternative: ${endpoint}`] = {
          error: error instanceof Error ? error.message : 'Unknown error',
          description: 'Alternative endpoint test'
        };
      }
    }

    return NextResponse.json({
      step: 'complete',
      searchEmail: email,
      authSuccess: true,
      tokenPreview: token.substring(0, 20) + '...',
      testResults: results,
      summary: {
        successfulTests: Object.entries(results).filter(([_, result]) => result.success),
        userFoundInTests: Object.entries(results).filter(([_, result]) => result.userFound || result.specificUser),
        htmlResponses: Object.entries(results).filter(([_, result]) => result.isHtml),
        errorResponses: Object.entries(results).filter(([_, result]) => result.status >= 400)
      },
      recommendations: generateRecommendations(results),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔥 Debug error:', error);
    return NextResponse.json({
      step: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateRecommendations(results: Record<string, any>): string[] {
  const recommendations: string[] = [];

  // Check if any test was successful
  const successfulTests = Object.entries(results).filter(([_, result]) => result.success);
  const htmlResponses = Object.entries(results).filter(([_, result]) => result.isHtml);
  const errorResponses = Object.entries(results).filter(([_, result]) => result.status >= 400);

  if (successfulTests.length === 0) {
    recommendations.push("❌ No API calls were successful. This suggests an authentication or endpoint issue.");
  } else {
    recommendations.push(`✅ ${successfulTests.length} API call(s) were successful.`);
  }

  if (htmlResponses.length > 0) {
    recommendations.push("🚨 Some responses returned HTML instead of JSON, indicating server errors or wrong endpoints.");
  }

  if (errorResponses.length === Object.keys(results).length) {
    recommendations.push("🔧 All endpoints failed. Check if your Docebo domain and credentials are correct.");
    recommendations.push("🔧 Try accessing your Docebo admin panel directly to verify the platform is working.");
  }

  const userFoundTests = Object.entries(results).filter(([_, result]) => result.userFound || result.specificUser);
  if (userFoundTests.length > 0) {
    recommendations.push(`👤 User found in ${userFoundTests.length} test(s). The API is working but there may be search parameter issues.`);
  } else {
    recommendations.push("👤 User not found in any successful tests. The user may not exist or may have different identifiers.");
  }

  if (successfulTests.length > 0) {
    const workingEndpoint = successfulTests[0][1];
    recommendations.push(`💡 Use this working pattern: ${workingEndpoint.url}`);
  }

  return recommendations;
}
