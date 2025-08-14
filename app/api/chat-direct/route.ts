// app/api/chat-direct/route.ts - Direct processing without background jobs
import { NextRequest, NextResponse } from 'next/server';

// Simple cache for repeated requests (will persist during function lifetime)
const enrollmentCache = new Map();

interface CachedResult {
  data: any[];
  timestamp: number;
  totalCount: number;
  userInfo: any;
}

class DirectDoceboAPI {
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

    console.log('🔑 Getting new access token...');
    
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
      throw new Error(`Token request failed: ${response.status}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    console.log('✅ Access token obtained');
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

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }

  async findUserByEmail(email: string): Promise<any> {
    console.log(`🔍 Searching for user: ${email}`);
    
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      console.log(`✅ User found: ${user.fullname} (ID: ${user.user_id})`);
    } else {
      console.log(`❌ User not found: ${email}`);
    }
    
    return user;
  }

  async getUserEnrollments(userId: string): Promise<any> {
    console.log(`📚 Getting enrollments for user: ${userId}`);
    
    let allEnrollments: any[] = [];
    let currentPage = 1;
    const maxPages = 10; // Limit to prevent timeouts
    
    // Get multiple pages to ensure we get all enrollments
    while (currentPage <= maxPages) {
      console.log(`📄 Fetching page ${currentPage}...`);
      
      try {
        const result = await this.apiRequest('/course/v1/courses/enrollments', {
          'user_ids[]': userId,
          page_size: 200,
          page: currentPage
        });
        
        const pageEnrollments = result.data?.items || [];
        
        // Filter for the specific user
        const userEnrollments = pageEnrollments.filter((enrollment: any) => {
          return enrollment.user_id === Number(userId);
        });
        
        allEnrollments.push(...userEnrollments);
        
        console.log(`📄 Page ${currentPage}: Found ${userEnrollments.length} enrollments (Total: ${allEnrollments.length})`);
        
        // Check if there's more data
        const hasMoreData = result.data?.has_more_data === true;
        
        if (!hasMoreData || pageEnrollments.length === 0) {
          console.log(`✅ No more data available after page ${currentPage}`);
          break;
        }
        
        currentPage++;
        
        // Small delay to be API-friendly
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (pageError) {
        console.error(`❌ Error fetching page ${currentPage}:`, pageError);
        
        // If first page fails, throw error; otherwise continue with what we have
        if (currentPage === 1) {
          throw pageError;
        } else {
          console.log(`⚠️ Continuing with ${allEnrollments.length} enrollments from previous pages`);
          break;
        }
      }
    }
    
    // Format enrollments
    const processedEnrollments = allEnrollments.map(e => ({
      courseName: e.course_name || 'Unknown Course',
      courseType: e.course_type || 'unknown',
      enrollmentStatus: e.enrollment_status || 'unknown',
      enrollmentDate: e.enrollment_created_at,
      score: e.enrollment_score || 0,
      assignmentType: e.assignment_type,
      courseId: e.course_id
    }));
    
    console.log(`✅ Total enrollments processed: ${processedEnrollments.length}`);
    
    return {
      enrollments: processedEnrollments,
      totalCount: processedEnrollments.length,
      pagesProcessed: currentPage - 1
    };
  }

  async searchUsers(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
  }

  async searchLearningPlans(searchText: string, limit: number = 25): Promise<any[]> {
    console.log(`🔍 Searching learning plans: "${searchText}"`);
    
    try {
      const result = await this.apiRequest('/learningplan/v1/learningplans', {
        search_text: searchText,
        page_size: Math.min(limit, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (result.data?.items?.length > 0) {
        return result.data.items;
      }
      
      // Fallback: get all and filter manually
      const allResult = await this.apiRequest('/learningplan/v1/learningplans', {
        page_size: Math.min(limit * 2, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (allResult.data?.items?.length > 0) {
        const filteredPlans = allResult.data.items.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          return name.includes(searchText.toLowerCase()) || 
                 description.includes(searchText.toLowerCase());
        });
        
        return filteredPlans.slice(0, limit);
      }
      
    } catch (error) {
      console.error('Learning plan search failed:', error);
    }
    
    return [];
  }

  getLearningPlanName(lp: any): string {
    return lp.title || 
           lp.name || 
           lp.learning_plan_name || 
           lp.lp_name || 
           lp.learningplan_name ||
           lp.plan_name ||
           'Unknown Learning Plan';
  }
}

// Initialize API
let api: DirectDoceboAPI;

function getConfig() {
  return {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    if (!api) {
      console.log('🔧 Initializing Direct API...');
      api = new DirectDoceboAPI(getConfig());
    }

    const body = await request.json();
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: '❌ Please provide a valid message',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🤖 Direct processing: "${message}"`);
    
    // Parse message to extract email
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    
    if (!emailMatch) {
      return NextResponse.json({
        response: '❌ Please provide a valid email address in your message.',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    const email = emailMatch[0];
    console.log(`📧 Email extracted: ${email}`);
    
    // Check cache first (5 minute cache)
    const cacheKey = `enrollments_${email}`;
    if (enrollmentCache.has(cacheKey)) {
      const cached: CachedResult = enrollmentCache.get(cacheKey);
      const cacheAge = Date.now() - cached.timestamp;
      
      if (cacheAge < 300000) { // 5 minutes
        const ageMinutes = Math.floor(cacheAge / 60000);
        console.log(`💾 Returning cached results for ${email} (${ageMinutes} minutes old)`);
        
        return NextResponse.json({
          response: `📚 **${email}'s Courses** (${cached.totalCount} total)

*⚡ Cached results from ${ageMinutes} minutes ago*

👤 **User**: ${cached.userInfo.fullname}

${cached.data.slice(0, 20).map((course: any, i: number) => {
  let statusIcon = '📚';
  if (course.enrollmentStatus === 'completed') statusIcon = '✅';
  else if (course.enrollmentStatus === 'in_progress') statusIcon = '🔄';
  else if (course.enrollmentStatus === 'suspended') statusIcon = '🚫';
  
  return `${i + 1}. ${statusIcon} **${course.enrollmentStatus.toUpperCase()}** - ${course.courseName}${course.score ? ` (Score: ${course.score})` : ''}`;
}).join('\n')}

${cached.totalCount > 20 ? `\n... and ${cached.totalCount - 20} more courses` : ''}

🔄 *Results refresh automatically every 5 minutes*`,
          success: true,
          cached: true,
          data: {
            enrollments: cached.data,
            totalCount: cached.totalCount,
            userInfo: cached.userInfo
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Find user
    const user = await api.findUserByEmail(email);
    
    if (!user) {
      return NextResponse.json({
        response: `❌ **User Not Found**: ${email}

No user found with that email address in the system.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get enrollments directly
    console.log(`📚 Getting enrollments for ${user.fullname}...`);
    const enrollmentResult = await api.getUserEnrollments(user.user_id.toString());
    
    // Cache the results
    enrollmentCache.set(cacheKey, {
      data: enrollmentResult.enrollments,
      timestamp: Date.now(),
      totalCount: enrollmentResult.totalCount,
      userInfo: user
    });
    
    const processingTime = Math.floor((Date.now() - startTime) / 1000);
    
    return NextResponse.json({
      response: `❌ **Processing Error**: ${error instanceof Error ? error.message : 'Unknown error'}

Processing took ${processingTime} seconds before failing.

Please try again. If the issue persists, the user might have a very large number of enrollments.`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Direct Docebo API - No Background Jobs',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    features: [
      'Direct processing within request timeout',
      '5-minute caching for repeated requests',
      'Multi-page enrollment fetching',
      'No persistent storage dependencies',
      'Updated learning plan endpoint: /learningplan/v1/learningplans'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans',
      'enrollments': '/course/v1/courses/enrollments'
    }
  });
}000);
    
    return NextResponse.json({
      response: `📚 **${email}'s Courses** (${enrollmentResult.totalCount} total)

👤 **User**: ${user.fullname}

${enrollmentResult.enrollments.slice(0, 20).map((course: any, i: number) => {
  let statusIcon = '📚';
  if (course.enrollmentStatus === 'completed') statusIcon = '✅';
  else if (course.enrollmentStatus === 'in_progress') statusIcon = '🔄';
  else if (course.enrollmentStatus === 'suspended') statusIcon = '🚫';
  
  return `${i + 1}. ${statusIcon} **${course.enrollmentStatus.toUpperCase()}** - ${course.courseName}${course.score ? ` (Score: ${course.score})` : ''}`;
}).join('\n')}

${enrollmentResult.totalCount > 20 ? `\n... and ${enrollmentResult.totalCount - 20} more courses` : ''}

📊 **Summary**: 
- **Total Enrollments**: ${enrollmentResult.totalCount}
- **Pages Processed**: ${enrollmentResult.pagesProcessed}
- **Processing Time**: ${processingTime} seconds
- **Method**: Direct API`,
      success: true,
      data: {
        enrollments: enrollmentResult.enrollments,
        totalCount: enrollmentResult.totalCount,
        userInfo: user,
        processingTime: processingTime
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Direct processing error:', error);
    const processingTime = Math.floor((Date.now() - startTime) / 1
