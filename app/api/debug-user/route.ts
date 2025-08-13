// app/api/debug-user/route.ts - Debug version to see exactly what data we get
import { NextRequest, NextResponse } from 'next/server';

function getConfig() {
  return {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  };
}

class DebugDoceboAPI {
  private config: any;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: any) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'api',
        username: this.config.username,
        password: this.config.password,
      }),
    });

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    return this.accessToken!;
  }

  private async apiRequest(endpoint: string, params?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      if (queryParams.toString()) {
        url += `?${queryParams}`;
      }
    }

    console.log(`🔍 API Request: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} - ${response.statusText}`);
      const errorText = await response.text();
      console.log(`❌ Error response: ${errorText}`);
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ API Response for ${endpoint}:`, JSON.stringify(data, null, 2));
    return data;
  }

  async debugUserDetails(email: string): Promise<any> {
    console.log(`🔍 DEBUG: Starting detailed user analysis for ${email}`);

    // Find user first
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    console.log(`✅ User found: ${user.fullname} (ID: ${user.user_id})`);
    console.log(`📋 Complete user object:`, JSON.stringify(user, null, 2));

    let debugInfo: any = {
      user: user,
      userFields: Object.keys(user),
      apiCalls: [],
      branchData: {},
      managerData: {},
      groupData: {},
      orgData: {}
    };

    // List of API endpoints to try
    const endpointsToTry = [
      // User specific endpoints
      `/manage/v1/user/${user.user_id}`,
      `/manage/v1/user/${user.user_id}/branches`,
      `/manage/v1/user/${user.user_id}/groups`,
      `/manage/v1/user/${user.user_id}/manager`,
      `/manage/v1/user/${user.user_id}/profile`,
      `/manage/v1/user/${user.user_id}/additional_fields`,
      
      // Organizational endpoints
      `/manage/v1/orgchart/user/${user.user_id}`,
      `/manage/v1/orgchart/branches`,
      `/manage/v1/branches`,
      
      // Group endpoints
      '/manage/v1/group',
      
      // Alternative manager endpoints
      `/manage/v1/user/${user.user_id}/supervisor`,
      `/manage/v1/user/${user.user_id}/reports`,
    ];

    // Try each endpoint and collect results
    for (const endpoint of endpointsToTry) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint}`);
        
        const params = endpoint.includes('/group') && !endpoint.includes(user.user_id) ? 
          { user_id: user.user_id } : undefined;
        
        const result = await this.apiRequest(endpoint, params);
        
        debugInfo.apiCalls.push({
          endpoint: endpoint,
          success: true,
          dataKeys: result.data ? Object.keys(result.data) : Object.keys(result),
          hasData: !!(result.data?.items?.length || result.data || result.length),
          itemCount: result.data?.items?.length || (Array.isArray(result.data) ? result.data.length : 0)
        });

        // Store specific data
        if (endpoint.includes('branches')) {
          debugInfo.branchData[endpoint] = result;
        } else if (endpoint.includes('manager') || endpoint.includes('supervisor')) {
          debugInfo.managerData[endpoint] = result;
        } else if (endpoint.includes('group')) {
          debugInfo.groupData[endpoint] = result;
        } else if (endpoint.includes('orgchart')) {
          debugInfo.orgData[endpoint] = result;
        }
        
      } catch (error) {
        console.log(`❌ Endpoint ${endpoint} failed:`, error);
        debugInfo.apiCalls.push({
          endpoint: endpoint,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check if user object has any fields that might contain manager/branch info
    const userFieldAnalysis = {
      branchRelatedFields: {},
      managerRelatedFields: {},
      allFields: {}
    };

    Object.keys(user).forEach(key => {
      const value = user[key];
      userFieldAnalysis.allFields[key] = {
        type: typeof value,
        value: typeof value === 'object' ? '[object]' : value
      };

      if (key.toLowerCase().includes('branch') || 
          key.toLowerCase().includes('office') || 
          key.toLowerCase().includes('location') ||
          key.toLowerCase().includes('dept')) {
        userFieldAnalysis.branchRelatedFields[key] = value;
      }

      if (key.toLowerCase().includes('manager') || 
          key.toLowerCase().includes('supervisor') || 
          key.toLowerCase().includes('report') ||
          key.toLowerCase().includes('boss')) {
        userFieldAnalysis.managerRelatedFields[key] = value;
      }
    });

    debugInfo.userFieldAnalysis = userFieldAnalysis;

    console.log(`🎯 DEBUG SUMMARY:`);
    console.log(`📊 Total API calls attempted: ${debugInfo.apiCalls.length}`);
    console.log(`✅ Successful calls: ${debugInfo.apiCalls.filter((c: any) => c.success).length}`);
    console.log(`❌ Failed calls: ${debugInfo.apiCalls.filter((c: any) => !c.success).length}`);
    console.log(`🏛️ Branch-related fields in user object: ${Object.keys(userFieldAnalysis.branchRelatedFields).length}`);
    console.log(`👔 Manager-related fields in user object: ${Object.keys(userFieldAnalysis.managerRelatedFields).length}`);
    
    return debugInfo;
  }
}

let debugApi: DebugDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    if (!debugApi) {
      debugApi = new DebugDoceboAPI(getConfig());
    }

    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json({
        error: 'Email is required'
      }, { status: 400 });
    }

    console.log(`🔍 DEBUG: Starting comprehensive user debug for ${email}`);
    
    const debugInfo = await debugApi.debugUserDetails(email);
    
    // Create a readable summary
    const summary = {
      userFound: !!debugInfo.user,
      userName: debugInfo.user?.fullname,
      userId: debugInfo.user?.user_id,
      totalApiCalls: debugInfo.apiCalls.length,
      successfulCalls: debugInfo.apiCalls.filter((c: any) => c.success).length,
      failedCalls: debugInfo.apiCalls.filter((c: any) => !c.success).length,
      branchRelatedFields: Object.keys(debugInfo.userFieldAnalysis.branchRelatedFields),
      managerRelatedFields: Object.keys(debugInfo.userFieldAnalysis.managerRelatedFields),
      potentialBranchData: debugInfo.userFieldAnalysis.branchRelatedFields,
      potentialManagerData: debugInfo.userFieldAnalysis.managerRelatedFields
    };

    return NextResponse.json({
      message: `Comprehensive debug completed for ${email}`,
      summary: summary,
      fullDebugInfo: debugInfo,
      recommendations: {
        branchDataSources: Object.keys(debugInfo.branchData),
        managerDataSources: Object.keys(debugInfo.managerData),
        groupDataSources: Object.keys(debugInfo.groupData),
        orgDataSources: Object.keys(debugInfo.orgData),
        nextSteps: [
          'Check if any successful API calls returned branch/manager data',
          'Look for branch/manager info in user object fields',
          'Verify if this Docebo instance has branch/manager functionality enabled',
          'Check if user permissions allow access to organizational data'
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Debug failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Debug endpoint for comprehensive user analysis',
    usage: 'POST with {"email": "user@domain.com"}',
    purpose: 'Find out exactly what user data is available from Docebo API'
  });
}
