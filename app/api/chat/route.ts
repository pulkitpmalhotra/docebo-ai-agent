// app/api/chat/route.ts - Self-contained version for Vercel deployment
import { NextRequest, NextResponse } from 'next/server';

// Environment configuration - inline to avoid import issues
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

// Inline Docebo API client
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth failed: ${response.status} - ${errorText}`);
    }

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
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  async searchUsers(searchText: string, limit: number = 25): Promise<any[]> {
    try {
      const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      return result.data?.items || [];
    } catch (error) {
      console.error('Search users failed:', error);
      return [];
    }
  }

  async searchCourses(searchText: string, limit: number = 25): Promise<any[]> {
    try {
      const result = await this.apiRequest('/learn/v1/courses', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      return result.data?.items || [];
    } catch (error) {
      console.error('Search courses failed:', error);
      return [];
    }
  }

  async getUserEnrollments(userId: string): Promise<any[]> {
    try {
      const result = await this.apiRequest(`/learn/v1/enrollments/users/${userId}`);
      return result.data?.items || [];
    } catch (error) {
      console.error('Get user enrollments failed:', error);
      return [];
    }
  }

  async getCourseEnrollments(courseId: string): Promise<any[]> {
    try {
      const result = await this.apiRequest(`/learn/v1/enrollments/courses/${courseId}`);
      return result.data?.items || [];
    } catch (error) {
      console.error('Get course enrollments failed:', error);
      return [];
    }
  }

  async enrollUser(userId: string, courseId: string, options: any = {}): Promise<any> {
    try {
      const enrollmentBody: any = {
        course_ids: [String(courseId)],
        user_ids: [String(userId)],
        level: options.level || "3",
        date_expire_validity: options.dueDate,
        send_notification: false
      };

      if (options.assignmentType && options.assignmentType !== "none") {
        enrollmentBody.assignment_type = options.assignmentType;
      }

      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
      
      const enrolledUsers = result.data?.enrolled || [];
      const errors = result.data?.errors || {};
      
      if (enrolledUsers.length > 0) {
        return { success: true, message: 'Successfully enrolled user in course' };
      } else {
        let specificError = "Unknown enrollment restriction";
        
        if (errors.existing_enrollments && errors.existing_enrollments.length > 0) {
          specificError = "User is already enrolled in this course";
        } else if (errors.invalid_users && errors.invalid_users.length > 0) {
          specificError = "User ID is invalid or user doesn't exist";
        } else if (errors.invalid_courses && errors.invalid_courses.length > 0) {
          specificError = "Course ID is invalid or course doesn't exist";
        }
        
        return { success: false, message: specificError };
      }
    } catch (error) {
      return { success: false, message: `Enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  getCourseId(course: any): string | null {
    return course.id_course || course.course_id || course.idCourse || course.id || null;
  }
}

// Command patterns
const PATTERNS = {
  enroll: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('enroll ') || lower.includes('add ')) && !lower.includes('unenroll');
  },
  userCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('what courses') || (lower.includes('courses') && lower.includes('enrolled'));
  },
  courseUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('who is enrolled');
  },
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('find user') || lower.includes('search user');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('find') && lower.includes('course');
  }
};

// Simple parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractCourse(message: string): string | null {
  // Try quoted strings first
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try "in [course]" pattern
  const inMatch = message.match(/\bin\s+([^(as|due|level)]+?)(?:\s+(?:as|due|level)|$)/i);
  if (inMatch) return inMatch[1].trim();
  
  // Try "enrolled in [course]" pattern
  const enrolledMatch = message.match(/enrolled\s+in\s+(.+?)(?:\?|$)/i);
  if (enrolledMatch) return enrolledMatch[1].trim();
  
  return null;
}

// Initialize API
let api: SimpleDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    // Initialize API if needed
    if (!api) {
      const config = getConfig();
      api = new SimpleDoceboAPI(config);
    }

    const body = await request.json();
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: 'Please provide a valid message',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`Processing: "${message}"`);
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    
    // Route to appropriate handler
    if (PATTERNS.enroll(message)) {
      if (!email || !course) {
        return NextResponse.json({
          response: 'For enrollment, I need both an email address and course name.\n\nExample: "Enroll john@company.com in Python Programming"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Find user and course
      const users = await api.searchUsers(email, 5);
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `User not found: ${email}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courses = await api.searchCourses(course, 10);
      const courseObj = courses.find(c => 
        (c.course_name || c.name || '').toLowerCase().includes(course.toLowerCase())
      );
      
      if (!courseObj) {
        return NextResponse.json({
          response: `Course not found: ${course}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseId = api.getCourseId(courseObj);
      if (!courseId) {
        return NextResponse.json({
          response: 'Course found but missing ID',
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const result = await api.enrollUser(user.user_id, courseId);
      
      return NextResponse.json({
        response: result.success 
          ? `✅ Successfully enrolled ${user.fullname} in ${courseObj.course_name || courseObj.name}`
          : `❌ Enrollment failed: ${result.message}`,
        success: result.success,
        timestamp: new Date().toISOString()
      });
      
    } else if (PATTERNS.userCourses(message)) {
      if (!email) {
        return NextResponse.json({
          response: 'I need an email address to check enrollments.\n\nExample: "What courses is john@company.com enrolled in?"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const users = await api.searchUsers(email, 5);
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `User not found: ${email}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const enrollments = await api.getUserEnrollments(user.user_id);
      
      if (enrollments.length === 0) {
        return NextResponse.json({
          response: `${user.fullname} is not enrolled in any courses.`,
          success: true,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseList = enrollments.slice(0, 10).map((e, i) => 
        `${i + 1}. ${e.course_name || e.name || 'Unknown Course'}`
      ).join('\n');
      
      return NextResponse.json({
        response: `${user.fullname}'s Courses (${enrollments.length} total):\n\n${courseList}`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } else if (PATTERNS.courseUsers(message)) {
      if (!course) {
        return NextResponse.json({
          response: 'I need a course name to check enrollments.\n\nExample: "Who is enrolled in Python Programming?"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courses = await api.searchCourses(course, 10);
      const courseObj = courses.find(c => 
        (c.course_name || c.name || '').toLowerCase().includes(course.toLowerCase())
      );
      
      if (!courseObj) {
        return NextResponse.json({
          response: `Course not found: ${course}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseId = api.getCourseId(courseObj);
      if (!courseId) {
        return NextResponse.json({
          response: 'Course found but missing ID',
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const enrollments = await api.getCourseEnrollments(courseId);
      
      return NextResponse.json({
        response: `"${courseObj.course_name || courseObj.name}" has ${enrollments.length} enrolled users`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } else {
      return NextResponse.json({
        response: `I can help you with:

• Enroll users: "Enroll john@company.com in Python Programming"
• Check user courses: "What courses is sarah@test.com enrolled in?"
• Check course enrollments: "Who is enrolled in Excel Training?"
• Find users: "Find user mike@company.com"
• Find courses: "Find Python courses"

What would you like to do?`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    
    return NextResponse.json({
      response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Docebo Chat API - Ready',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}
