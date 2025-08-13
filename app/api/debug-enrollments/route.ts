// Debug version to see what data we're actually getting
// Add this as a temporary endpoint: app/api/debug-enrollments/route.ts

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
      throw new Error(`Docebo API error: ${response.status}`);
    }

    return await response.json();
  }

  async debugEnrollments(email: string): Promise<any> {
    console.log(`🔍 DEBUG: Starting enrollment check for ${email}`);

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

    let debugInfo: {
      user: any;
      pages: any[];
      totalEnrollments: number;
      apiResponses: any[];
    } = {
      user: user,
      pages: [],
      totalEnrollments: 0,
      apiResponses: []
    };

    // Get first 3 pages to debug
    for (let page = 1; page <= 3; page++) {
      console.log(`📄 DEBUG: Fetching page ${page}...`);
      
      try {
        const result = await this.apiRequest('/course/v1/courses/enrollments', {
          'user_ids[]': user.user_id,
          page_size: 200,
          page: page
        });
        
        debugInfo.apiResponses.push({
          page: page,
          url: `/course/v1/courses/enrollments?user_ids[]=${user.user_id}&page_size=200&page=${page}`,
          itemsReturned: result.data?.items?.length || 0,
          hasMoreData: result.data?.has_more_data,
          totalItems: result.data?.total_count,
          metadata: result.data
        });
        
        const pageEnrollments = result.data?.items || [];
        console.log(`📄 Page ${page}: API returned ${pageEnrollments.length} items`);
        
        // Filter for the specific user
        const userEnrollments = pageEnrollments.filter((enrollment: any) => {
          return enrollment.user_id === Number(user.user_id);
        });
        
        console.log(`📄 Page ${page}: Found ${userEnrollments.length} enrollments for user ${user.user_id}`);
        
        debugInfo.pages.push({
          page: page,
          apiItemsReturned: pageEnrollments.length,
          userEnrollments: userEnrollments.length,
          hasMoreData: result.data?.has_more_data === true
        });
        
        debugInfo.totalEnrollments += userEnrollments.length;
        
        // Log some sample enrollments
        if (userEnrollments.length > 0) {
          console.log(`📋 Sample enrollments from page ${page}:`, 
            userEnrollments.slice(0, 3).map((e: any) => ({
              courseName: e.course_name,
              status: e.enrollment_status,
              userId: e.user_id
            }))
          );
        }
        
        // Check if there's more data
        const hasMoreData = result.data?.has_more_data === true;
        
        if (!hasMoreData || pageEnrollments.length === 0) {
          console.log(`✅ DEBUG: No more data available after page ${page}`);
          break;
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (pageError) {
        console.error(`❌ DEBUG: Error fetching page ${page}:`, pageError);
        debugInfo.pages.push({
          page: page,
          error: pageError instanceof Error ? pageError.message : 'Unknown error'
        });
        break;
      }
    }
    
    console.log(`🎯 DEBUG SUMMARY: Found ${debugInfo.totalEnrollments} total enrollments across ${debugInfo.pages.length} pages`);
    
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

    console.log(`🔍 DEBUG: Starting debug for ${email}`);
    
    const debugInfo = await debugApi.debugEnrollments(email);
    
    return NextResponse.json({
      message: `Debug completed for ${email}`,
      debugInfo: debugInfo,
      summary: {
        userFound: !!debugInfo.user,
        userName: debugInfo.user?.fullname,
        userId: debugInfo.user?.user_id,
        totalEnrollments: debugInfo.totalEnrollments,
        pagesChecked: debugInfo.pages.length,
        apiCalls: debugInfo.apiResponses.length
      },
      recommendations: {
        shouldShowLoadMore: debugInfo.totalEnrollments > 20 && debugInfo.totalEnrollments <= 100,
        shouldShowCSV: debugInfo.totalEnrollments > 100 || debugInfo.totalEnrollments > 20,
        currentLogic: `totalCount=${debugInfo.totalEnrollments}, hasMore=${debugInfo.totalEnrollments > 20}, showCSV=${debugInfo.totalEnrollments > 100}`
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
    message: 'Debug endpoint for enrollment checking',
    usage: 'POST with {"email": "user@domain.com"}'
  });
}
