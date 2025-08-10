// app/api/debug-zapier-style/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'susantha@google.com';
    
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    console.log('🎯 Testing Zapier-style API calls');
    console.log('🌐 Base URL:', baseUrl);
    
    // Step 1: Get OAuth token (this works)
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

    // Step 2: Test different header combinations like Zapier might use
    const zapierStyleTests = [
      {
        name: 'Zapier Standard Headers',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'Zapier',
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Minimal Headers (like curl)',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      },
      {
        name: 'Standard REST Headers',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      },
      {
        name: 'No Content-Type',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'Docebo-Integration/1.0'
        }
      },
      {
        name: 'Postman Style',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'PostmanRuntime/7.28.0',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      }
    ];

    const results: Record<string, any> = {};

    // Test the exact endpoint that works in Zapier
    const testUrl = `/manage/v1/user?search_text=${encodeURIComponent(email)}`;
    
    for (const test of zapierStyleTests) {
      try {
        console.log(`🧪 Testing: ${test.name}`);
        console.log(`📋 Headers:`, test.headers);
        
        const response = await fetch(`${baseUrl}${testUrl}`, {
          method: 'GET',
          headers: test.headers,
        });

        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log(`📊 Response (first 500 chars): ${responseText.substring(0, 500)}`);

        let parsedResponse;
        let isJson = false;
        let userFound = false;

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          try {
            parsedResponse = JSON.parse(responseText);
            isJson = true;
            
            // Check if user found
            if (parsedResponse?.data?.items) {
              userFound = parsedResponse.data.items.some((user: any) => 
                user.email?.toLowerCase().includes(email.toLowerCase()) ||
                user.first_name?.toLowerCase().includes('susantha')
              );
            }
          } catch (jsonError) {
            parsedResponse = `JSON parse error: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`;
          }
        } else {
          parsedResponse = responseText.substring(0, 1000);
        }

        results[test.name] = {
          status: response.status,
          statusText: response.statusText,
          success: response.status === 200 && isJson,
          contentType,
          isJson,
          isHtml: responseText.includes('<html>'),
          headersSent: test.headers,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          responsePreview: parsedResponse,
          userFound,
          itemCount: isJson && parsedResponse?.data?.items ? parsedResponse.data.items.length : 0,
          fullResponse: isJson ? parsedResponse : undefined
        };

        // If successful, try a few more variations
        if (response.status === 200 && isJson) {
          console.log(`🎉 SUCCESS with ${test.name}!`);
          
          // Test without search_text to get all users
          const allUsersResponse = await fetch(`${baseUrl}/manage/v1/user?page_size=5`, {
            method: 'GET',
            headers: test.headers,
          });
          
          if (allUsersResponse.ok) {
            const allUsersData = await allUsersResponse.json();
            results[`${test.name} - All Users`] = {
              status: allUsersResponse.status,
              success: true,
              itemCount: allUsersData?.data?.items?.length || 0,
              responsePreview: allUsersData
            };
          }
        }

      } catch (error) {
        console.error(`❌ Test failed: ${test.name}`, error);
        results[test.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          headersSent: test.headers
        };
      }
    }

    // Step 3: Also test the exact way the documentation shows
    console.log('📚 Testing documentation example...');
    try {
      const docExampleResponse = await fetch(`${baseUrl}/manage/v1/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });

      const docResponseText = await docExampleResponse.text();
      let docParsedResponse;
      
      if (docExampleResponse.headers.get('content-type')?.includes('application/json')) {
        try {
          docParsedResponse = JSON.parse(docResponseText);
        } catch {
          docParsedResponse = docResponseText.substring(0, 500);
        }
      } else {
        docParsedResponse = docResponseText.substring(0, 500);
      }

      results['Documentation Example (no params)'] = {
        status: docExampleResponse.status,
        success: docExampleResponse.status === 200,
        contentType: docExampleResponse.headers.get('content-type'),
        responsePreview: docParsedResponse
      };

    } catch (error) {
      results['Documentation Example (no params)'] = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json({
      step: 'complete',
      searchEmail: email,
      authSuccess: true,
      tokenPreview: token.substring(0, 20) + '...',
      testUrl,
      testResults: results,
      summary: {
        successfulTests: Object.entries(results).filter(([_, result]) => result.success),
        jsonResponses: Object.entries(results).filter(([_, result]) => result.isJson),
        htmlResponses: Object.entries(results).filter(([_, result]) => result.isHtml),
        userFoundInTests: Object.entries(results).filter(([_, result]) => result.userFound)
      },
      nextSteps: generateNextSteps(results),
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

function generateNextSteps(results: Record<string, any>): string[] {
  const steps: string[] = [];
  
  const successfulTests = Object.entries(results).filter(([_, result]) => result.success);
  const jsonResponses = Object.entries(results).filter(([_, result]) => result.isJson);
  
  if (successfulTests.length > 0) {
    const bestTest = successfulTests[0];
    steps.push(`✅ Found working configuration: "${bestTest[0]}"`);
    steps.push(`🔧 Use these headers: ${JSON.stringify(bestTest[1].headersSent, null, 2)}`);
    steps.push(`📋 This returned ${bestTest[1].itemCount} users`);
  } else {
    steps.push(`❌ No configurations worked. This suggests a deeper API issue.`);
  }
  
  if (jsonResponses.length === 0) {
    steps.push(`🚨 No JSON responses received. API might be completely down or misconfigured.`);
  }
  
  const userFoundTests = Object.entries(results).filter(([_, result]) => result.userFound);
  if (userFoundTests.length > 0) {
    steps.push(`👤 User found in ${userFoundTests.length} test(s)!`);
  } else {
    steps.push(`👤 User not found in any tests. User might not exist with that identifier.`);
  }
  
  return steps;
}
