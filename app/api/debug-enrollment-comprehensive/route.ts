// app/api/debug-enrollment-comprehensive/route.ts
import { NextRequest, NextResponse } from 'next/server';

class DoceboEnrollmentDebugger {
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

  private async testEndpoint(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    console.log(`🔍 Testing: ${method} ${endpoint}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = { method, headers };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);
      const responseText = await response.text();
      
      let result = {
        endpoint,
        method,
        status: response.status,
        ok: response.ok,
        response: null as any,
        error: null as string | null
      };

      if (response.ok) {
        try {
          result.response = JSON.parse(responseText);
        } catch {
          result.response = responseText;
        }
      } else {
        result.error = responseText;
      }

      console.log(`${result.ok ? '✅' : '❌'} ${method} ${endpoint}: ${result.status}`);
      return result;
    } catch (error) {
      console.log(`💥 ${method} ${endpoint}: ${error}`);
      return {
        endpoint,
        method,
        status: 0,
        ok: false,
        response: null,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // Test all possible enrollment GET endpoints
  async testEnrollmentGetEndpoints(userId = '51158', courseId = '1', learningPlanId = '1', sessionId = '1') {
    console.log('\n📚 TESTING ENROLLMENT GET ENDPOINTS...\n');

    const endpoints = [
      // User-centric enrollment endpoints
      `/learn/v1/enrollments/users/${userId}`,
      `/learn/v1/enrollments/user/${userId}`,
      `/manage/v1/users/${userId}/enrollments`,
      `/manage/v1/user/${userId}/enrollments`,
      `/learn/v1/users/${userId}/enrollments`,
      `/learn/v1/user/${userId}/enrollments`,
      `/api/v1/users/${userId}/enrollments`,
      
      // Course-centric enrollment endpoints
      `/learn/v1/enrollments/courses/${courseId}`,
      `/learn/v1/enrollments/course/${courseId}`,
      `/learn/v1/courses/${courseId}/enrollments`,
      `/learn/v1/course/${courseId}/enrollments`,
      `/manage/v1/courses/${courseId}/enrollments`,
      `/api/v1/courses/${courseId}/enrollments`,
      
      // Learning Plan enrollments
      `/learn/v1/enrollments/learningplans/${learningPlanId}`,
      `/learn/v1/enrollments/learning-plans/${learningPlanId}`,
      `/learn/v1/learningplans/${learningPlanId}/enrollments`,
      `/learn/v1/learning-plans/${learningPlanId}/enrollments`,
      `/manage/v1/learningplans/${learningPlanId}/enrollments`,
      
      // Session enrollments (ILT)
      `/learn/v1/enrollments/sessions/${sessionId}`,
      `/learn/v1/sessions/${sessionId}/enrollments`,
      `/manage/v1/sessions/${sessionId}/enrollments`,
      `/learn/v1/ilt/${sessionId}/enrollments`,
      
      // General enrollment endpoints
      `/learn/v1/enrollments`,
      `/manage/v1/enrollments`,
      `/api/v1/enrollments`,
      `/learn/v1/enrollment`,
      `/manage/v1/enrollment`,
      
      // Progress and completion endpoints
      `/learn/v1/users/${userId}/progress`,
      `/learn/v1/users/${userId}/completions`,
      `/analytics/v1/users/${userId}/enrollments`,
      `/analytics/v1/enrollments/users/${userId}`,
      `/learn/v1/tracking/users/${userId}`,
      
      // Course progress
      `/learn/v1/courses/${courseId}/progress`,
      `/learn/v1/courses/${courseId}/completions`,
      `/analytics/v1/courses/${courseId}/enrollments`,
      `/learn/v1/tracking/courses/${courseId}`,
      
      // Reports
      `/analytics/v1/reports/enrollments`,
      `/manage/v1/reports/enrollments`,
      `/learn/v1/reports/enrollments`,
      `/analytics/v1/reports/progress`,
      `/analytics/v1/reports/completions`,
    ];

    const results = [];
    for (const endpoint of endpoints) {
      const result = await this.testEndpoint(endpoint);
      results.push(result);
    }

    return results;
  }

  // Test enrollment POST endpoints (creating enrollments)
  async testEnrollmentPostEndpoints(userId = '51158', courseId = '1', learningPlanId = '1') {
    console.log('\n✏️ TESTING ENROLLMENT POST ENDPOINTS...\n');

    const testBodies = [
      // Standard formats
      { users: [userId], courses: [courseId] },
      { user_id: userId, course_id: courseId },
      { userId: userId, courseId: courseId },
      { user: userId, course: courseId },
      
      // Learning plan formats
      { users: [userId], learning_plans: [learningPlanId] },
      { users: [userId], learningplans: [learningPlanId] },
      { user_id: userId, learning_plan_id: learningPlanId },
      
      // Extended formats
      { 
        enrollments: [
          { user_id: userId, course_id: courseId, enrollment_date: new Date().toISOString() }
        ]
      },
      {
        users: [{ id: userId }],
        courses: [{ id: courseId }]
      }
    ];

    const endpoints = [
      '/learn/v1/enrollments',
      '/manage/v1/enrollments',
      '/api/v1/enrollments',
      '/learn/v1/enrollment',
      '/manage/v1/enrollment',
      `/learn/v1/courses/${courseId}/enrollments`,
      `/manage/v1/courses/${courseId}/enrollments`,
      `/learn/v1/users/${userId}/enrollments`,
      `/manage/v1/users/${userId}/enrollments`,
      `/learn/v1/learningplans/${learningPlanId}/enrollments`,
      `/manage/v1/learningplans/${learningPlanId}/enrollments`,
      '/enroll/v1/users',
      '/enroll/v1/courses',
      '/api/v1/enroll'
    ];

    const results = [];
    for (const endpoint of endpoints) {
      for (const [index, body] of testBodies.entries()) {
        console.log(`\n🧪 Testing ${endpoint} with body format ${index + 1}...`);
        const result = await this.testEndpoint(endpoint, 'POST', body);
        result.bodyFormat = index + 1;
        result.bodyUsed = body;
        results.push(result);
        
        // Don't spam the API too much
        if (result.ok) {
          console.log(`✅ SUCCESS with body format ${index + 1} on ${endpoint}`);
          break; // Move to next endpoint if this one works
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // Test batch enrollment endpoints
  async testBatchEnrollmentEndpoints(userIds = ['51158', '51159'], courseIds = ['1', '2']) {
    console.log('\n📦 TESTING BATCH ENROLLMENT ENDPOINTS...\n');

    const batchBodies = [
      { users: userIds, courses: courseIds },
      { user_ids: userIds, course_ids: courseIds },
      { enrollments: userIds.flatMap(uid => courseIds.map(cid => ({ user_id: uid, course_id: cid }))) },
      { 
        bulk_enrollments: {
          users: userIds,
          courses: courseIds,
          enrollment_type: 'immediate'
        }
      }
    ];

    const endpoints = [
      '/learn/v1/enrollments/batch',
      '/learn/v1/enrollments/bulk',
      '/manage/v1/enrollments/batch',
      '/manage/v1/enrollments/bulk',
      '/api/v1/enrollments/batch',
      '/learn/v1/bulk-enrollments',
      '/manage/v1/bulk-enrollments'
    ];

    const results = [];
    for (const endpoint of endpoints) {
      for (const [index, body] of batchBodies.entries()) {
        const result = await this.testEndpoint(endpoint, 'POST', body);
        result.bodyFormat = `batch_${index + 1}`;
        result.bodyUsed = body;
        results.push(result);
        
        if (result.ok) break;
      }
    }

    return results;
  }

  // Test enrollment status and progress endpoints
  async testEnrollmentStatusEndpoints(userId = '51158', courseId = '1') {
    console.log('\n📊 TESTING ENROLLMENT STATUS & PROGRESS ENDPOINTS...\n');

    const endpoints = [
      `/learn/v1/users/${userId}/courses/${courseId}/progress`,
      `/learn/v1/users/${userId}/courses/${courseId}/status`,
      `/learn/v1/users/${userId}/courses/${courseId}/enrollment`,
      `/learn/v1/enrollments/${userId}/${courseId}`,
      `/learn/v1/enrollments/status?user_id=${userId}&course_id=${courseId}`,
      `/analytics/v1/users/${userId}/courses/${courseId}`,
      `/learn/v1/tracking/users/${userId}/courses/${courseId}`,
      `/manage/v1/users/${userId}/courses/${courseId}`,
    ];

    const results = [];
    for (const endpoint of endpoints) {
      const result = await this.testEndpoint(endpoint);
      results.push(result);
    }

    return results;
  }

  // Test enrollment deletion/unenrollment endpoints
  async testUnenrollmentEndpoints(userId = '51158', courseId = '1') {
    console.log('\n🗑️ TESTING UNENROLLMENT ENDPOINTS...\n');
    
    const endpoints = [
      `/learn/v1/enrollments/users/${userId}/courses/${courseId}`,
      `/learn/v1/enrollments/${userId}/${courseId}`,
      `/learn/v1/users/${userId}/enrollments/${courseId}`,
      `/manage/v1/enrollments/users/${userId}/courses/${courseId}`,
    ];

    const results = [];
    for (const endpoint of endpoints) {
      // Test DELETE method
      const result = await this.testEndpoint(endpoint, 'DELETE');
      results.push(result);
    }

    return results;
  }

  // Test enrollment reports
  async testEnrollmentReports() {
    console.log('\n📈 TESTING ENROLLMENT REPORT ENDPOINTS...\n');

    const endpoints = [
      '/analytics/v1/reports/enrollments',
      '/analytics/v1/reports/enrollment-summary',
      '/analytics/v1/reports/course-enrollments',
      '/analytics/v1/reports/user-enrollments',
      '/analytics/v1/reports/completion-rates',
      '/analytics/v1/reports/progress',
      '/manage/v1/reports/enrollments',
      '/learn/v1/reports/enrollments',
      '/analytics/v1/dashboard/enrollments',
      '/analytics/v1/statistics/enrollments',
    ];

    const results = [];
    for (const endpoint of endpoints) {
      const result = await this.testEndpoint(endpoint);
      results.push(result);
    }

    return results;
  }

  // Comprehensive test of ALL enrollment endpoints
  async runComprehensiveTest(userId = '51158', courseId = '1', learningPlanId = '1') {
    console.log('🚀 STARTING COMPREHENSIVE ENROLLMENT ENDPOINT DISCOVERY...\n');

    const results = {
      get_endpoints: await this.testEnrollmentGetEndpoints(userId, courseId, learningPlanId),
      post_endpoints: await this.testEnrollmentPostEndpoints(userId, courseId, learningPlanId),
      batch_endpoints: await this.testBatchEnrollmentEndpoints(),
      status_endpoints: await this.testEnrollmentStatusEndpoints(userId, courseId),
      reports: await this.testEnrollmentReports(),
      // Skip deletion tests to avoid actually removing enrollments
      // unenroll_endpoints: await this.testUnenrollmentEndpoints(userId, courseId),
    };

    // Analyze successful endpoints
    const successfulEndpoints = Object.values(results).flat().filter(r => r.ok);
    
    console.log(`\n🎉 DISCOVERY COMPLETE: Found ${successfulEndpoints.length} working endpoints!`);
    
    return {
      summary: {
        total_tested: Object.values(results).flat().length,
        successful: successfulEndpoints.length,
        success_rate: `${((successfulEndpoints.length / Object.values(results).flat().length) * 100).toFixed(1)}%`
      },
      successful_endpoints: successfulEndpoints.map(ep => ({
        endpoint: ep.endpoint,
        method: ep.method,
        status: ep.status,
        response_sample: JSON.stringify(ep.response).substring(0, 200) + '...'
      })),
      detailed_results: results
    };
  }
}

const debugger = new DoceboEnrollmentDebugger({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'comprehensive';
    const userId = searchParams.get('userId') || '51158';
    const courseId = searchParams.get('courseId') || '1';
    const learningPlanId = searchParams.get('learningPlanId') || '1';

    let results;

    switch (test) {
      case 'get':
        results = await debugger.testEnrollmentGetEndpoints(userId, courseId, learningPlanId);
        break;
      case 'post':
        results = await debugger.testEnrollmentPostEndpoints(userId, courseId, learningPlanId);
        break;
      case 'batch':
        results = await debugger.testBatchEnrollmentEndpoints();
        break;
      case 'status':
        results = await debugger.testEnrollmentStatusEndpoints(userId, courseId);
        break;
      case 'reports':
        results = await debugger.testEnrollmentReports();
        break;
      case 'comprehensive':
      default:
        results = await debugger.runComprehensiveTest(userId, courseId, learningPlanId);
        break;
    }

    return NextResponse.json({
      test_type: test,
      timestamp: new Date().toISOString(),
      parameters: { userId, courseId, learningPlanId },
      results,
      instructions: {
        endpoints: [
          'GET /api/debug-enrollment-comprehensive?test=comprehensive',
          'GET /api/debug-enrollment-comprehensive?test=get&userId=51158&courseId=1',
          'GET /api/debug-enrollment-comprehensive?test=post&userId=51158&courseId=1',
          'GET /api/debug-enrollment-comprehensive?test=batch',
          'GET /api/debug-enrollment-comprehensive?test=status&userId=51158&courseId=1',
          'GET /api/debug-enrollment-comprehensive?test=reports'
        ],
        note: 'Check server console for detailed logs of each endpoint test. Replace userId and courseId with real IDs from your system.'
      }
    });

  } catch (error) {
    console.error('❌ Comprehensive enrollment debug error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
