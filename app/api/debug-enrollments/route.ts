// app/api/debug-enrollments/route.ts - Debug enrollment endpoints
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo OAuth failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    if (!this.accessToken) {
      throw new Error('Failed to store access token');
    }
    
    return this.accessToken;
  }

  private async apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' = 'GET', params?: Record<string, string | number>, body?: any): Promise<T> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value.toString());
      });
      url += `?${queryParams}`;
    }
    
    console.log(`📡 Testing endpoint: ${method} ${url}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method === 'POST' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = { method, headers };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();
    
    console.log(`📡 Response status: ${response.status}`);
    console.log(`📡 Response body: ${responseText}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} - ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  // Test various enrollment endpoints
  async testEnrollmentEndpoints(userId: string, courseId: string) {
    const endpoints = [
      // Common enrollment endpoints to test
      { path: '/learn/v1/enrollments', method: 'POST' as const, body: { users: [userId], courses: [courseId] } },
      { path: '/learn/v1/enrollments', method: 'POST' as const, body: { user_id: userId, course_id: courseId } },
      { path: '/manage/v1/enrollments', method: 'POST' as const, body: { users: [userId], courses: [courseId] } },
      { path: `/learn/v1/courses/${courseId}/enrollments`, method: 'POST' as const, body: { users: [userId] } },
      { path: `/manage/v1/users/${userId}/enrollments`, method: 'POST' as const, body: { courses: [courseId] } },
      { path: '/enroll/v1/users', method: 'POST' as const, body: { user_id: userId, course_id: courseId } },
      { path: '/api/v1/enroll', method: 'POST' as const, body: { user_id: userId, course_id: courseId } },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔍 Testing: ${endpoint.method} ${endpoint.path}`);
        const result = await this.apiRequest(endpoint.path, endpoint.method, {}, endpoint.body);
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'success',
          response: result
        });
        console.log(`✅ Success: ${endpoint.path}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'error',
          error: errorMessage
        });
        console.log(`❌ Failed: ${endpoint.path} - ${errorMessage}`);
      }
    }

    return results;
  }

  // Test getting enrollments (read operations)
  async testGetEnrollments(userId: string, courseId: string) {
    const endpoints = [
      { path: `/learn/v1/enrollments/users/${userId}`, method: 'GET' as const },
      { path: `/learn/v1/enrollments/courses/${courseId}`, method: 'GET' as const },
      { path: `/manage/v1/users/${userId}/enrollments`, method: 'GET' as const },
      { path: `/learn/v1/courses/${courseId}/enrollments`, method: 'GET' as const },
      { path: '/learn/v1/enrollments', method: 'GET' as const, params: { user_id: userId } },
      { path: '/learn/v1/enrollments', method: 'GET' as const, params: { course_id: courseId } },
      { path: '/manage/v1/enrollments', method: 'GET' as const },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔍 Testing GET: ${endpoint.path}`);
        const result = await this.apiRequest(endpoint.path, endpoint.method, endpoint.params || {});
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'success',
          response: result,
          count: result.data?.items?.length || 'unknown'
        });
        console.log(`✅ Success: ${endpoint.path} - Found ${result.data?.items?.length || 'unknown'} items`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'error',
          error: errorMessage
        });
        console.log(`❌ Failed: ${endpoint.path} - ${errorMessage}`);
      }
    }

    return results;
  }

  // Discover available API endpoints
  async discoverEndpoints() {
    const baseEndpoints = [
      '/learn/v1',
      '/manage/v1', 
      '/analytics/v1',
      '/api/v1',
      '/enroll/v1'
    ];

    const results = [];

    for (const endpoint of baseEndpoints) {
      try {
        console.log(`\n🔍 Discovering: ${endpoint}`);
        const result = await this.apiRequest(endpoint);
        results.push({
          endpoint,
          status: 'success',
          response: result
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          endpoint,
          status: 'error',
          error: errorMessage
        });
      }
    }

    return results;
  }
}

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
    const action = searchParams.get('action') || 'discover';
    const userId = searchParams.get('userId') || '51158'; // Use a real user ID from your system
    const courseId = searchParams.get('courseId') || '1'; // Use a real course ID

    let result: any = {};

    switch (action) {
      case 'discover':
        result.discovery = await debugAPI.discoverEndpoints();
        break;
        
      case 'test_get_enrollments':
        result.get_enrollments = await debugAPI.testGetEnrollments(userId, courseId);
        break;
        
      case 'test_post_enrollments':
        result.post_enrollments = await debugAPI.testEnrollmentEndpoints(userId, courseId);
        break;
        
      case 'all':
        result.discovery = await debugAPI.discoverEndpoints();
        result.get_enrollments = await debugAPI.testGetEnrollments(userId, courseId);
        // Note: Commenting out POST tests to avoid actually enrolling users during debug
        // result.post_enrollments = await debugAPI.testEnrollmentEndpoints(userId, courseId);
        break;
    }

    return NextResponse.json({
      action,
      userId,
      courseId,
      timestamp: new Date().toISOString(),
      results: result,
      instructions: {
        test_endpoints: [
          'GET /api/debug-enrollments?action=discover',
          'GET /api/debug-enrollments?action=test_get_enrollments&userId=51158&courseId=1',
          'GET /api/debug-enrollments?action=test_post_enrollments&userId=51158&courseId=1',
          'GET /api/debug-enrollments?action=all&userId=51158&courseId=1'
        ],
        note: 'Check server console for detailed endpoint testing logs. Use real user and course IDs from your system.'
      }
    });

  } catch (error) {
    console.error('❌ Debug Enrollment Error:', error);
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
    const { action, userId, courseId } = body;

    let result: any = {};

    switch (action) {
      case 'test_enrollment':
        // Test specific enrollment endpoint
        result = await debugAPI.testEnrollmentEndpoints(userId || '51158', courseId || '1');
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      action,
      userId,
      courseId,
      timestamp: new Date().toISOString(),
      results: result
    });

  } catch (error) {
    console.error('❌ Debug Enrollment POST Error:', error);
    return NextResponse.json({
      error: 'Debug POST failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
