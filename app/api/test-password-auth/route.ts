// app/api/test-password-auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    
    // Check if we have username/password in environment
    const hasCredentials = process.env.DOCEBO_USERNAME && process.env.DOCEBO_PASSWORD;
    
    console.log('🧪 Testing Password Authentication vs Client Credentials');
    console.log('Has username/password:', hasCredentials);
    
    const results: Record<string, any> = {};
    
    // Test 1: Client Credentials (what we've been using)
    console.log('🔑 Test 1: Client Credentials');
    try {
      const clientCredsResponse = await fetch(`${baseUrl}/oauth2/token`, {
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

      if (clientCredsResponse.ok) {
        const clientCredsData = await clientCredsResponse.json();
        const clientToken = clientCredsData.access_token;
        
        // Test API call with client credentials token
        const apiTestResponse = await fetch(`${baseUrl}/manage/v1/user?page_size=1`, {
          headers: {
            'Authorization': `Bearer ${clientToken}`,
            'Accept': 'application/json'
          }
        });
        
        const apiTestText = await apiTestResponse.text();
        
        results['Client Credentials'] = {
          auth_success: true,
          auth_token_preview: clientToken.substring(0, 20) + '...',
          api_status: apiTestResponse.status,
          api_content_type: apiTestResponse.headers.get('content-type'),
          api_success: apiTestResponse.status === 200 && apiTestResponse.headers.get('content-type')?.includes('application/json'),
          api_response_preview: apiTestText.substring(0, 200),
          token_scope: clientCredsData.scope
        };
      } else {
        const errorText = await clientCredsResponse.text();
        results['Client Credentials'] = {
          auth_success: false,
          error: `${clientCredsResponse.status}: ${errorText}`
        };
      }
    } catch (error) {
      results['Client Credentials'] = {
        auth_success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Password Credentials (if we have username/password)
    if (hasCredentials) {
      console.log('🔑 Test 2: Password Credentials');
      try {
        const passwordResponse = await fetch(`${baseUrl}/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: process.env.DOCEBO_CLIENT_ID!,
            client_secret: process.env.DOCEBO_CLIENT_SECRET!,
            scope: 'api',
            username: process.env.DOCEBO_USERNAME!,
            password: process.env.DOCEBO_PASSWORD!,
          }),
        });

        if (passwordResponse.ok) {
          const passwordData = await passwordResponse.json();
          const passwordToken = passwordData.access_token;
          
          // Test API call with password credentials token
          const apiTestResponse = await fetch(`${baseUrl}/manage/v1/user?page_size=1`, {
            headers: {
              'Authorization': `Bearer ${passwordToken}`,
              'Accept': 'application/json'
            }
          });
          
          const apiTestText = await apiTestResponse.text();
          
          results['Password Credentials'] = {
            auth_success: true,
            auth_token_preview: passwordToken.substring(0, 20) + '...',
            api_status: apiTestResponse.status,
            api_content_type: apiTestResponse.headers.get('content-type'),
            api_success: apiTestResponse.status === 200 && apiTestResponse.headers.get('content-type')?.includes('application/json'),
            api_response_preview: apiTestText.substring(0, 200),
            token_scope: passwordData.scope,
            token_different: passwordToken !== results['Client Credentials']?.auth_token_preview?.replace('...', '')
          };
          
          // If password auth works, test the user search
          if (apiTestResponse.status === 200) {
            const userSearchResponse = await fetch(`${baseUrl}/manage/v1/user?search_text=susantha@google.com`, {
              headers: {
                'Authorization': `Bearer ${passwordToken}`,
                'Accept': 'application/json'
              }
            });
            
            const userSearchText = await userSearchResponse.text();
            let userFound = false;
            
            if (userSearchResponse.headers.get('content-type')?.includes('application/json')) {
              try {
                const userSearchData = JSON.parse(userSearchText);
                userFound = userSearchData?.data?.items?.some((user: any) => 
                  user.email?.toLowerCase().includes('susantha')
                );
              } catch {}
            }
            
            results['Password Credentials - User Search'] = {
              status: userSearchResponse.status,
              content_type: userSearchResponse.headers.get('content-type'),
              success: userSearchResponse.status === 200 && userSearchResponse.headers.get('content-type')?.includes('application/json'),
              user_found: userFound,
              response_preview: userSearchText.substring(0, 300)
            };
          }
        } else {
          const errorText = await passwordResponse.text();
          results['Password Credentials'] = {
            auth_success: false,
            error: `${passwordResponse.status}: ${errorText}`
          };
        }
      } catch (error) {
        results['Password Credentials'] = {
          auth_success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      results['Password Credentials'] = {
        auth_success: false,
        error: 'DOCEBO_USERNAME and DOCEBO_PASSWORD environment variables not set'
      };
    }

    // Analysis
    const clientWorking = results['Client Credentials']?.api_success;
    const passwordWorking = results['Password Credentials']?.api_success;
    
    let analysis: string[] = [];
    
    if (passwordWorking && !clientWorking) {
      analysis.push('✅ PASSWORD CREDENTIALS WORK! This is likely why Zapier works.');
      analysis.push('🔧 Solution: Switch from client_credentials to password grant type');
      analysis.push('⚠️ You need username/password for your Docebo admin user');
    } else if (clientWorking && passwordWorking) {
      analysis.push('🤔 Both authentication methods work - issue might be elsewhere');
    } else if (!clientWorking && !passwordWorking) {
      analysis.push('❌ Neither authentication method works - deeper API issue');
    } else if (clientWorking && !passwordWorking) {
      analysis.push('✅ Client credentials work fine - original issue might be headers');
    }
    
    if (!hasCredentials) {
      analysis.push('📝 Add DOCEBO_USERNAME and DOCEBO_PASSWORD to your .env file to test password auth');
    }

    return NextResponse.json({
      message: 'Authentication method comparison',
      has_username_password: !!hasCredentials,
      test_results: results,
      analysis,
      next_steps: generateNextSteps(results, !!hasCredentials),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function generateNextSteps(results: Record<string, any>, hasCredentials: boolean): string[] {
  const steps: string[] = [];
  
  const clientWorking = results['Client Credentials']?.api_success;
  const passwordWorking = results['Password Credentials']?.api_success;
  
  if (passwordWorking) {
    steps.push('🎯 SOLUTION FOUND: Use password authentication in your API client');
    steps.push('📝 Update your DoceboAPI class to use grant_type: "password"');
    steps.push('🔧 Add username/password to the token request');
  } else if (!hasCredentials) {
    steps.push('📝 Add DOCEBO_USERNAME and DOCEBO_PASSWORD to your environment variables');
    steps.push('🔑 Use your Docebo admin username and password');
    steps.push('🧪 Re-run this test to see if password auth works');
  } else if (!clientWorking && !passwordWorking) {
    steps.push('🔍 Both auth methods failed - check your Docebo app configuration');
    steps.push('🎛️ Verify your OAuth2 app in Docebo admin panel');
    steps.push('📞 Contact Docebo support about API access in sandbox');
  }
  
  return steps;
}
