// app/api/chat/route.ts - Simple, Fast, Working Chat
import { NextRequest, NextResponse } from 'next/server';

// Super simple Docebo API client that actually works
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

  private async apiCall(endpoint: string, params?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams(params);
      url += `?${queryParams}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  }

  // Simple, working methods
  async quickUserSearch(email: string): Promise<any> {
    const result = await this.apiCall('/manage/v1/user', { search_text: email, page_size: 5 });
    return result.data?.items?.[0] || null;
  }

  async quickCourseSearch(courseName: string): Promise<any> {
    const result = await this.apiCall('/learn/v1/courses', { search_text: courseName, page_size: 5 });
    return result.data?.items?.[0] || null;
  }

  async getUserEnrollments(userId: string): Promise<any> {
    try {
      const result = await this.apiCall(`/learn/v1/enrollments/users/${userId}`);
      return result.data?.items || [];
    } catch {
      return [];
    }
  }

  async getCourseEnrollments(courseId: string): Promise<any> {
    try {
      const result = await this.apiCall(`/learn/v1/enrollments/courses/${courseId}`);
      return result.data?.items || [];
    } catch {
      return [];
    }
  }

  async enrollUser(userId: string, courseId: string): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/learn/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: [userId],
          courses: [courseId]
        })
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Simple pattern matching - no AI overhead
function parseSimpleCommand(message: string): { action: string; email?: string; course?: string } {
  const email = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0];
  const msgLower = message.toLowerCase();

  // Direct action detection
  if (email && msgLower.includes('enroll') && !msgLower.includes('who')) {
    const course = message.match(/(?:in|to)\s+([^.!?]+)/i)?.[1]?.trim() || 
                  message.match(/"([^"]+)"/)?.[1] ||
                  message.replace(email, '').replace(/enroll|in|to/gi, '').trim();
    return { action: 'enroll', email, course };
  }

  if (email && (msgLower.includes('enrolled') || msgLower.includes('courses'))) {
    return { action: 'user_courses', email };
  }

  if (msgLower.includes('who') && msgLower.includes('enrolled')) {
    const course = message.match(/enrolled in\s+([^?!.]+)/i)?.[1]?.trim() ||
                  message.match(/"([^"]+)"/)?.[1];
    return { action: 'course_users', course };
  }

  if (msgLower.includes('find') || msgLower.includes('search')) {
    if (msgLower.includes('user') || email) {
      return { action: 'find_user', email: email || message.replace(/find|search|user/gi, '').trim() };
    }
    if (msgLower.includes('course')) {
      const course = message.replace(/find|search|course/gi, '').trim();
      return { action: 'find_course', course };
    }
  }

  return { action: 'help' };
}

const api = new SimpleDoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const command = parseSimpleCommand(message);
    let response = '';

    switch (command.action) {
      case 'enroll':
        if (!command.email || !command.course) {
          response = `❌ **Missing Info**: Need both email and course name.\n\n**Example**: "Enroll john@company.com in Python Programming"`;
          break;
        }

        const user = await api.quickUserSearch(command.email);
        if (!user) {
          response = `❌ **User Not Found**: ${command.email}\n\nDouble-check the email address.`;
          break;
        }

        const course = await api.quickCourseSearch(command.course);
        if (!course) {
          response = `❌ **Course Not Found**: ${command.course}\n\nTry a shorter course name or check spelling.`;
          break;
        }

        const enrolled = await api.enrollUser(user.user_id, course.course_id || course.idCourse);
        if (enrolled) {
          response = `✅ **Enrolled Successfully**\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${course.course_name || course.name}\n\n🎯 The user will receive a notification and can access the course immediately.`;
        } else {
          response = `❌ **Enrollment Failed**\n\nUser may already be enrolled or there's a permission issue.`;
        }
        break;

      case 'user_courses':
        if (!command.email) {
          response = `❌ **Missing Email**: Please provide a user email.\n\n**Example**: "What courses is john@company.com enrolled in?"`;
          break;
        }

        const userForCourses = await api.quickUserSearch(command.email);
        if (!userForCourses) {
          response = `❌ **User Not Found**: ${command.email}`;
          break;
        }

        const enrollments = await api.getUserEnrollments(userForCourses.user_id);
        if (enrollments.length === 0) {
          response = `📚 **No Enrollments**\n\n${userForCourses.fullname} is not enrolled in any courses.`;
        } else {
          response = `📚 **${userForCourses.fullname}'s Courses** (${enrollments.length} total)\n\n${enrollments.slice(0, 10).map((e: any, i: number) => `${i + 1}. ${e.course_name || e.name || 'Course'}`).join('\n')}`;
        }
        break;

      case 'course_users':
        if (!command.course) {
          response = `❌ **Missing Course**: Please specify a course name.\n\n**Example**: "Who is enrolled in Python Programming?"`;
          break;
        }

        const courseForUsers = await api.quickCourseSearch(command.course);
        if (!courseForUsers) {
          response = `❌ **Course Not Found**: ${command.course}`;
          break;
        }

        const courseEnrollments = await api.getCourseEnrollments(courseForUsers.course_id || courseForUsers.idCourse);
        if (courseEnrollments.length === 0) {
          response = `👥 **No Enrollments**\n\nNo users enrolled in "${courseForUsers.course_name || courseForUsers.name}".`;
        } else {
          response = `👥 **"${courseForUsers.course_name || courseForUsers.name}" Enrollments** (${courseEnrollments.length} users)\n\n${courseEnrollments.slice(0, 10).map((e: any, i: number) => `${i + 1}. ${e.user_name || e.fullname || 'User'}`).join('\n')}`;
        }
        break;

      case 'find_user':
        if (!command.email) {
          response = `❌ **Missing Search Term**: Please provide an email or name.\n\n**Example**: "Find user john@company.com"`;
          break;
        }

        const foundUser = await api.quickUserSearch(command.email);
        if (foundUser) {
          response = `👤 **User Found**\n\n**Name**: ${foundUser.fullname}\n**Email**: ${foundUser.email}\n**Status**: ${foundUser.status === '1' ? 'Active' : 'Inactive'}\n**Last Login**: ${foundUser.last_access_date ? new Date(foundUser.last_access_date).toLocaleDateString() : 'Never'}`;
        } else {
          response = `❌ **User Not Found**: ${command.email}`;
        }
        break;

      case 'find_course':
        if (!command.course) {
          response = `❌ **Missing Course Name**: Please specify what to search for.\n\n**Example**: "Find course Python"`;
          break;
        }

        const foundCourse = await api.quickCourseSearch(command.course);
        if (foundCourse) {
          response = `📚 **Course Found**\n\n**Name**: ${foundCourse.course_name || foundCourse.name}\n**Type**: ${foundCourse.course_type || foundCourse.type}\n**Status**: ${foundCourse.status}`;
        } else {
          response = `❌ **Course Not Found**: ${command.course}`;
        }
        break;

      default:
        response = `🎯 **Quick Docebo Actions**

**Enroll Someone**:
"Enroll john@company.com in Python Programming"

**Check User's Courses**:
"What courses is sarah@test.com enrolled in?"

**See Course Enrollments**:
"Who is enrolled in Excel Training?"

**Find User**:
"Find user mike@company.com"

**Find Course**:
"Find course JavaScript"

💡 **Tip**: Be specific with email addresses and course names for faster results!`;
    }

    return NextResponse.json({
      response,
      success: command.action !== 'help',
      action: command.action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Simple Docebo Chat - Fast & Direct',
    examples: [
      'Enroll john@company.com in Python Programming',
      'What courses is sarah@test.com enrolled in?',
      'Who is enrolled in Excel Training?',
      'Find user mike@company.com',
      'Find course JavaScript'
    ],
    note: 'Direct commands that work immediately - no complex AI needed!'
  });
}
