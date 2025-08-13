// app/api/chat/route.ts - Fixed routing to background API
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

// Enhanced patterns to detect requests
const PATTERNS = {
  enroll: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('enroll ') || lower.includes('add ')) && 
           !lower.includes('unenroll') && 
           !lower.includes('what courses') &&
           !lower.includes('who is enrolled');
  },
  
  // Background processing pattern for user courses
  userCoursesBackground: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('what courses') || 
           (lower.includes('courses') && lower.includes('enrolled') && !lower.includes('who'));
  },
  
  // Status check pattern - FIX: Make this more specific
  statusCheck: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('check status') || lower.includes('status of')) && 
           lower.includes('job_');
  },
  
  courseUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('who is enrolled') || lower.includes('who enrolled');
  },
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  }
};

// Parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractJobId(message: string): string | null {
  const match = message.match(/job_[a-zA-Z0-9_]+/);
  return match ? match[0] : null;
}

function extractCourse(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const inMatch = message.match(/\bin\s+(.+?)(?:\s+(?:as|due|level)\s|$)/i);
  if (inMatch) {
    let course = inMatch[1].trim();
    course = course.replace(/[.!?]+$/, '');
    return course;
  }
  
  const enrolledMatch = message.match(/enrolled\s+in\s+(.+?)(?:\?|$)/i);
  if (enrolledMatch) return enrolledMatch[1].trim();
  
  const findMatch = message.match(/find\s+(.+?)\s+course/i);
  if (findMatch) return findMatch[1].trim();
  
  return null;
}

// Simple API client for non-background operations
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

  private async apiRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, params?: any): Promise<any> {
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

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Docebo API error: ${response.status}`);
    }

    return await response.json();
  }

  async searchUsers(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', 'GET', null, {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
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
    const jobId = extractJobId(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}, JobId: ${jobId}`);
    
    // Route to appropriate handler
    
    // 1. STATUS CHECK - FIXED: Forward to background API properly
    if (PATTERNS.statusCheck(message) && jobId) {
      console.log(`📊 Status check request for job: ${jobId} - Forwarding to background API`);
      
      try {
        const statusResponse = await fetch(`${request.nextUrl.origin}/api/chat-bg?jobId=${jobId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!statusResponse.ok) {
          throw new Error(`Background API error: ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        console.log(`✅ Status check successful for job: ${jobId}`);
        
        return NextResponse.json(statusData);
      } catch (fetchError) {
        console.error(`❌ Status check failed for job: ${jobId}:`, fetchError);
        
        return NextResponse.json({
          response: `❌ **Status Check Failed**: ${jobId}

Error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}

This might indicate the background service is not responding. Try creating a new job.`,
          success: false,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }
    
    // 2. USER COURSES - Use direct processing (no background jobs)
    if (PATTERNS.userCoursesBackground(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to check enrollments.

**Example**: "What courses is john@company.com enrolled in?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`⚡ Direct processing request for: ${email} - Forwarding to direct API`);
      
      try {
        // Forward to direct processing API
        const directResponse = await fetch(`${request.nextUrl.origin}/api/chat-direct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        
        if (!directResponse.ok) {
          throw new Error(`Direct API error: ${directResponse.status}`);
        }
        
        const directData = await directResponse.json();
        
        console.log(`✅ Direct processing completed for: ${email}`);
        return NextResponse.json(directData);
        
      } catch (fetchError) {
        console.error(`❌ Direct processing failed for: ${email}:`, fetchError);
        
        return NextResponse.json({
          response: `❌ **Processing Failed**: ${email}

Error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}

Please try again. If you have many enrollments, this might take a moment.`,
          success: false,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }
    
    // 3. SEARCH USERS - Quick operations
    if (PATTERNS.searchUsers(message)) {
      const searchTerm = email || message.replace(/find|user|search/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a name or email to search for.`,
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
        return `${i + 1}. ${statusIcon} ${user.fullname} (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users

${userList}${users.length > 5 ? `\n\n... and ${users.length - 5} more users` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. SEARCH COURSES - Quick operations
    if (PATTERNS.searchCourses(message)) {
      const searchTerm = course || message.replace(/find|search|course/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a course name to search for.`,
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
        return `${i + 1}. ${courseName} (ID: ${courseId})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 5 ? `\n\n... and ${courses.length - 5} more courses` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // DEFAULT - Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Direct Processing*

I can help you with:

• **📚 Check user courses**: "What courses is sarah@test.com enrolled in?" 
  *(Direct processing with 5-minute caching)*

• **👥 Find users**: "Find user mike@company.com"

• **📖 Find courses**: "Find Python courses"

**Your message**: "${message}"

💡 *All requests are processed directly for immediate results.*

**Examples:**
- "What courses is pulkitpmalhotra@gmail.com enrolled in?"
- "Find user sarah@test.com"
- "Find Python courses"`,
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
    status: 'Docebo Chat API - Direct Processing',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Direct processing for immediate results',
      '5-minute caching for repeated requests', 
      'Multi-page enrollment fetching',
      'No background job dependencies'
    ]
  });
}
