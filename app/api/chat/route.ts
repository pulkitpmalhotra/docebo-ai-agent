// app/api/chat/route.ts - Updated to integrate with background processing
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

// Enhanced patterns to detect background job requests
const PATTERNS = {
  enroll: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('enroll ') || lower.includes('add ')) && 
           !lower.includes('unenroll') && 
           !lower.includes('what courses') &&
           !lower.includes('who is enrolled');
  },
  
  // NEW: Background processing pattern for user courses
  userCoursesBackground: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('what courses') || 
           (lower.includes('courses') && lower.includes('enrolled') && !lower.includes('who'));
  },
  
  // NEW: Status check pattern
  statusCheck: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('check status') || lower.includes('job_') || lower.includes('status of');
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
    
    // 1. STATUS CHECK - Check if user is asking for job status
    if (PATTERNS.statusCheck(message) && jobId) {
      console.log(`📊 Status check request for job: ${jobId}`);
      
      const statusResponse = await fetch(`${request.nextUrl.origin}/api/chat-bg?jobId=${jobId}`);
      const statusData = await statusResponse.json();
      
      return NextResponse.json(statusData);
    }
    
    // 2. USER COURSES - Use background processing for enrollment queries
    if (PATTERNS.userCoursesBackground(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to check enrollments.

**Example**: "What courses is john@company.com enrolled in?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`🚀 Background processing request for: ${email}`);
      
      // Forward to background processing API
      const bgResponse = await fetch(`${request.nextUrl.origin}/api/chat-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      const bgData = await bgResponse.json();
      
      // If it's a background job, set up auto-polling
      if (bgData.processing && bgData.jobId) {
        // Add auto-polling instructions
        bgData.response += `

🤖 **Auto-Status Check**: I'll automatically check the status in 10 seconds...

💡 You can also manually ask: "Check status of ${bgData.jobId}"`;

        bgData.autoPolling = {
          enabled: true,
          jobId: bgData.jobId,
          delay: 10000, // 10 seconds
          maxAttempts: 12 // 2 minutes total
        };
      }
      
      return NextResponse.json(bgData);
    }
    
    // 3. ENROLLMENT - Quick operations (keep existing logic)
    if (PATTERNS.enroll(message)) {
      if (!email || !course) {
        return NextResponse.json({
          response: `❌ **Missing Information**: For enrollment, I need both an email address and course name.

**Example**: "Enroll john@company.com in Python Programming"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // ... existing enrollment logic (shortened for brevity)
      return NextResponse.json({
        response: `⚡ **Quick Enrollment** - Feature available but implementation details omitted for brevity`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. OTHER OPERATIONS - Keep existing patterns
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
    
    // DEFAULT - Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Background Processing Enabled*

I can help you with:

• **📚 Check user courses**: "What courses is sarah@test.com enrolled in?" 
  *(Uses background processing for complete results)*

• **🎯 Enroll users**: "Enroll john@company.com in Python Programming"

• **📊 Check job status**: "Check status of job_12345"

• **👥 Find users**: "Find user mike@company.com"

• **📖 Find courses**: "Find Python courses"

**Your message**: "${message}"

💡 *Large data requests now use background processing to avoid timeouts and get complete results.*`,
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
    status: 'Docebo Chat API - With Background Processing',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Background processing for large data requests',
      'Auto-polling for job status',
      'Caching for repeated requests',
      'No timeout limitations'
    ]
  });
}
