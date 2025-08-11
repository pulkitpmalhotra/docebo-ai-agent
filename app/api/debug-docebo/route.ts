// app/api/debug-docebo/route.ts - Debug actual Docebo API response structure
import { NextRequest, NextResponse } from 'next/server';

class DoceboAPI {
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

    console.log('🔑 Getting Docebo access token...');
    
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'api',
        username: this.config.username,
        password: this.config.password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo OAuth failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token received from Docebo');
    }
    
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    console.log('✅ Docebo access token obtained');
    
    if (!this.accessToken) {
      throw new Error('Failed to store access token');
    }
    
    return this.accessToken;
  }

  private async apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' = 'GET', params?: Record<string, string | number>): Promise<T> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value.toString());
      });
      url += `?${queryParams}`;
    }
    
    console.log(`📡 Docebo API Request: ${method} ${endpoint}`);
    console.log(`📡 Full URL: ${url}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    const response = await fetch(url, { method, headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Docebo API Error: ${response.status} - ${errorText}`);
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Docebo API Success: ${method} ${endpoint}`);
    
    // LOG THE ACTUAL RESPONSE STRUCTURE
    console.log('🔍 RAW RESPONSE STRUCTURE:', JSON.stringify(result, null, 2));
    
    return result;
  }

  async debugUsers() {
    console.log('🔍 DEBUGGING USERS API...');
    const result = await this.apiRequest('/manage/v1/user', 'GET', { page_size: 3 });
    console.log('🔍 USERS RESPONSE STRUCTURE:', JSON.stringify(result, null, 2));
    return result;
  }

  async debugCourses() {
    console.log('🔍 DEBUGGING COURSES API...');
    const result = await this.apiRequest('/learn/v1/courses', 'GET', { page_size: 3 });
    console.log('🔍 COURSES RESPONSE STRUCTURE:', JSON.stringify(result, null, 2));
    return result;
  }

  async debugSpecificCourse(searchTerm: string) {
    console.log(`🔍 DEBUGGING SPECIFIC COURSE SEARCH: ${searchTerm}`);
    const result = await this.apiRequest('/learn/v1/courses', 'GET', { 
      page_size: 5,
      search_text: searchTerm
    });
    console.log('🔍 COURSE SEARCH RESPONSE:', JSON.stringify(result, null, 2));
    return result;
  }

  async debugUserSearch(searchTerm: string) {
    console.log(`🔍 DEBUGGING USER SEARCH: ${searchTerm}`);
    const result = await this.apiRequest('/manage/v1/user', 'GET', { 
      page_size: 5,
      search_text: searchTerm
    });
    console.log('🔍 USER SEARCH RESPONSE:', JSON.stringify(result, null, 2));
    return result;
  }
}

// Initialize debug client
const debugAPI = new DoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const search = searchParams.get('search') || '';

    let result: any = {};

    switch (action) {
      case 'users':
        result.users = await debugAPI.debugUsers();
        break;
        
      case 'courses':
        result.courses = await debugAPI.debugCourses();
        break;
        
      case 'search_course':
        if (!search) {
          return NextResponse.json({ error: 'search parameter required for search_course' }, { status: 400 });
        }
        result.course_search = await debugAPI.debugSpecificCourse(search);
        break;
        
      case 'search_user':
        if (!search) {
          return NextResponse.json({ error: 'search parameter required for search_user' }, { status: 400 });
        }
        result.user_search = await debugAPI.debugUserSearch(search);
        break;
        
      case 'overview':
      default:
        result.users = await debugAPI.debugUsers();
        result.courses = await debugAPI.debugCourses();
        break;
    }

    return NextResponse.json({
      action,
      timestamp: new Date().toISOString(),
      debug_info: 'Check server console for detailed response structures',
      data: result,
      instructions: {
        test_endpoints: [
          'GET /api/debug-docebo?action=users',
          'GET /api/debug-docebo?action=courses', 
          'GET /api/debug-docebo?action=search_course&search=Content Administration',
          'GET /api/debug-docebo?action=search_user&search=admin'
        ],
        note: 'Check server console logs to see the actual response structure from Docebo'
      }
    });

  } catch (error) {
    console.error('❌ Debug API Error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, search } = body;

    let result: any = {};

    switch (action) {
      case 'test_search_course':
        result = await debugAPI.debugSpecificCourse(search || 'Content Administration');
        break;
        
      case 'test_search_user':
        result = await debugAPI.debugUserSearch(search || 'admin');
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      action,
      search,
      timestamp: new Date().toISOString(),
      data: result
    });

  } catch (error) {
    console.error('❌ Debug POST Error:', error);
    return NextResponse.json({
      error: 'Debug POST failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
