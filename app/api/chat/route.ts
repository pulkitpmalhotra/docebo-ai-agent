// app/api/chat/route.ts - Simple & Reliable - No Large Data Processing
import { NextRequest, NextResponse } from 'next/server';

// Environment configuration
function validateEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getConfig() {
  return {
    domain: validateEnvironmentVariable('DOCEBO_DOMAIN', process.env.DOCEBO_DOMAIN),
    clientId: validateEnvironmentVariable('DOCEBO_CLIENT_ID', process.env.DOCEBO_CLIENT_ID),
    clientSecret: validateEnvironmentVariable('DOCEBO_CLIENT_SECRET', process.env.DOCEBO_CLIENT_SECRET),
    username: validateEnvironmentVariable('DOCEBO_USERNAME', process.env.DOCEBO_USERNAME),
    password: validateEnvironmentVariable('DOCEBO_PASSWORD', process.env.DOCEBO_PASSWORD),
  };
}

// Simple patterns for basic operations
const PATTERNS = {
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  },
  quickEnrollmentCheck: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('what courses') || 
           (lower.includes('courses') && lower.includes('enrolled'));
  }
};

// Parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractCourse(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}

// Simple Docebo API client
class SimpleDoceboAPI {
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

  async searchUsers(searchText: string, limit: number = 10): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 10): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
  }

  async getQuickEnrollments(email: string): Promise<any> {
    // Find user first
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    // Get ONLY first page of enrollments (quick sample)
    const result = await this.apiRequest('/course/v1/courses/enrollments', {
      'user_ids[]': user.user_id,
      page_size: 20,
      page: 1
    });
    
    const pageEnrollments = result.data?.items || [];
    const userEnrollments = pageEnrollments.filter((enrollment: any) => {
      return enrollment.user_id === Number(user.user_id);
    });

    return {
      user: user,
      enrollments: userEnrollments.map((e: any) => ({
        courseName: e.course_name || 'Unknown Course',
        courseType: e.course_type || 'unknown',
        enrollmentStatus: e.enrollment_status || 'unknown',
        enrollmentDate: e.enrollment_created_at,
        score: e.enrollment_score || 0
      })),
      sampleSize: userEnrollments.length,
      hasMoreData: result.data?.has_more_data === true
    };
  }

  getCourseId(course: any): number | null {
    return course.id || course.course_id || course.idCourse || null;
  }

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
  }
}

let api: SimpleDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    if (!api) {
      const config = getConfig();
      api = new SimpleDoceboAPI(config);
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

    console.log(`🤖 Processing: "${message}"`);
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}`);
    
    // 1. SEARCH USERS
    if (PATTERNS.searchUsers(message)) {
      const searchTerm = email || message.replace(/find|user|search/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a name or email to search for.

**Example**: "Find user mike@company.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const users = await api.searchUsers(searchTerm, 10);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `👥 **No Users Found**: No users match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const userList = users.slice(0, 5).map((user, i) => {
        const statusIcon = user.status === '1' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users

${userList}${users.length > 5 ? `\n\n... and ${users.length - 5} more users` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. SEARCH COURSES
    if (PATTERNS.searchCourses(message)) {
      const searchTerm = course || message.replace(/find|search|course/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a course name to search for.

**Example**: "Find Python courses"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courses = await api.searchCourses(searchTerm, 10);
      
      if (courses.length === 0) {
        return NextResponse.json({
          response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseList = courses.slice(0, 5).map((course, i) => {
        const courseName = api.getCourseName(course);
        const courseId = api.getCourseId(course);
        return `${i + 1}. **${courseName}** (ID: ${courseId})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 5 ? `\n\n... and ${courses.length - 5} more courses` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. QUICK ENROLLMENT CHECK (Sample Only)
    if (PATTERNS.quickEnrollmentCheck(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to check enrollments.

**Example**: "What courses is john@company.com enrolled in?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const enrollmentData = await api.getQuickEnrollments(email);
        
        return NextResponse.json({
          response: `📚 **${email}'s Courses** (Sample)

👤 **User**: ${enrollmentData.user.fullname}

**📋 Sample Enrollments** (${enrollmentData.sampleSize} shown):

${enrollmentData.enrollments.map((course: any, i: number) => {
  let statusIcon = '📚';
  if (course.enrollmentStatus === 'completed') statusIcon = '✅';
  else if (course.enrollmentStatus === 'in_progress') statusIcon = '🔄';
  else if (course.enrollmentStatus === 'suspended') statusIcon = '🚫';
  
  return `${i + 1}. ${statusIcon} **${course.enrollmentStatus.toUpperCase()}** - ${course.courseName}${course.score ? ` (Score: ${course.score})` : ''}`;
}).join('\n')}

${enrollmentData.hasMoreData ? `\n⚠️ **Note**: This user has additional enrollments not shown. This is a sample of the first 20 enrollments.` : ''}

💡 **This is a quick sample view.** For complete enrollment data, consider upgrading to a plan with longer processing limits.`,
          success: true,
          limitedData: enrollmentData.hasMoreData,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        return NextResponse.json({
          response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // DEFAULT - Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Simple & Reliable*

I can help you with these **quick operations**:

• **👥 Find users**: "Find user mike@company.com"

• **📖 Find courses**: "Find Python courses"

• **📚 Sample enrollments**: "What courses is sarah@test.com enrolled in?" 
  *(Shows first 20 enrollments only)*

**Your message**: "${message}"

💡 **Current Limitations**: 
- Enrollment queries show sample data only (first 20 courses)
- For complete data, consider upgrading processing limits

**Examples:**
- "Find user pulkitpmalhotra@gmail.com"
- "Find Python courses"
- "What courses is pulkitpmalhotra@gmail.com enrolled in?" (sample)`,
      success: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Simple Docebo Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search (up to 10 results)',
      'Course search (up to 10 results)', 
      'Sample enrollment check (first 20 only)',
      'Fast & reliable within 30-second limit',
      'No background processing complexity'
    ],
    limitations: [
      'Enrollment data is sampled (first 20 courses)',
      'No complete enrollment processing',
      'Designed for quick operations only'
    ]
  });
}
