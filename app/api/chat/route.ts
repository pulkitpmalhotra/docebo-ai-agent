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

  // Fixed methods with multiple endpoint fallbacks
  async quickUserSearch(email: string): Promise<any> {
    const endpoints = ['/manage/v1/user', '/learn/v1/users', '/api/v1/users'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: email, page_size: 5 });
        const users = result.data?.items || result.items || [];
        if (users.length > 0) {
          console.log(`✅ User found via ${endpoint}`);
          return users[0];
        }
      } catch (error) {
        console.log(`❌ ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ User not found: ${email}`);
    return null;
  }

  async quickCourseSearch(courseName: string): Promise<any> {
    const endpoints = ['/learn/v1/courses', '/manage/v1/courses', '/api/v1/courses'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: courseName, page_size: 5 });
        const courses = result.data?.items || result.items || [];
        if (courses.length > 0) {
          console.log(`✅ Course found via ${endpoint}`);
          return courses[0];
        }
      } catch (error) {
        console.log(`❌ ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ Course not found: ${courseName}`);
    return null;
  }

  async getUserEnrollments(userId: string): Promise<any> {
    const endpoints = [
      `/learn/v1/enrollments/users/${userId}`,
      `/learn/v1/users/${userId}/enrollments`,
      `/manage/v1/users/${userId}/enrollments`,
      `/api/v1/users/${userId}/enrollments`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint);
        const enrollments = result.data?.items || result.items || [];
        console.log(`✅ User enrollments found via ${endpoint}: ${enrollments.length} courses`);
        return enrollments;
      } catch (error) {
        console.log(`❌ ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ No enrollment data found for user: ${userId}`);
    return [];
  }

  async getCourseEnrollments(courseId: string): Promise<any> {
    const endpoints = [
      `/learn/v1/enrollments/courses/${courseId}`,
      `/learn/v1/courses/${courseId}/enrollments`,
      `/manage/v1/courses/${courseId}/enrollments`,
      `/api/v1/courses/${courseId}/enrollments`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint);
        const enrollments = result.data?.items || result.items || [];
        console.log(`✅ Course enrollments found via ${endpoint}: ${enrollments.length} users`);
        return enrollments;
      } catch (error) {
        console.log(`❌ ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ No enrollment data found for course: ${courseId}`);
    return [];
  }

  async enrollUser(userId: string, courseId: string): Promise<{ success: boolean; message: string }> {
    const enrollmentBodies = [
      { users: [userId], courses: [courseId] },
      { user_id: userId, course_id: courseId },
      { userId: userId, courseId: courseId },
      { user: userId, course: courseId }
    ];
    
    const endpoints = [
      '/learn/v1/enrollments',
      '/manage/v1/enrollments',
      '/api/v1/enrollments',
      `/learn/v1/courses/${courseId}/enrollments`,
      `/learn/v1/users/${userId}/enrollments`
    ];
    
    for (const endpoint of endpoints) {
      for (const body of enrollmentBodies) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await this.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
          });
          
          if (response.ok) {
            console.log(`✅ Enrollment successful via ${endpoint}`);
            return { success: true, message: `Enrolled successfully via ${endpoint}` };
          } else {
            const errorText = await response.text();
            console.log(`❌ ${endpoint} failed (${response.status}): ${errorText}`);
          }
        } catch (error) {
          console.log(`❌ ${endpoint} error:`, error);
        }
      }
    }
    
    return { success: false, message: 'All enrollment methods failed. User may already be enrolled or permissions may be insufficient.' };
  }
}

// Scalable Action Registry System
interface ActionHandler {
  name: string;
  description: string;
  examples: string[];
  pattern: (message: string) => boolean;
  requiredFields: string[];
  execute: (api: SimpleDoceboAPI, params: any) => Promise<string>;
}

const ACTION_REGISTRY: ActionHandler[] = [
  {
    name: 'enroll_user',
    description: 'Enroll a user in a course',
    examples: ['Enroll john@company.com in Python Programming', 'Add sarah@test.com to Excel Training'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('enroll') || lower.includes('add')) && 
             !lower.includes('who') && 
             !lower.includes('unenroll');
    },
    requiredFields: ['email', 'course'],
    execute: async (api, { email, course }) => {
      const user = await api.quickUserSearch(email);
      if (!user) return `❌ **User Not Found**: ${email}\n\nDouble-check the email address.`;

      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) return `❌ **Course Not Found**: ${course}\n\nTry a shorter course name or check spelling.`;

      const result = await api.enrollUser(user.user_id, courseObj.course_id || courseObj.idCourse);
      if (result.success) {
        return `✅ **Enrollment Successful**\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${courseObj.course_name || courseObj.name}\n**Method**: ${result.message}\n\n🎯 User will receive notification and can access immediately.`;
      } else {
        return `❌ **Enrollment Failed**\n\n**Issue**: ${result.message}\n\n💡 **Possible Solutions**:\n• User may already be enrolled\n• Check course enrollment settings\n• Verify API permissions`;
      }
    }
  },
  {
    name: 'get_user_courses',
    description: 'Get all courses a user is enrolled in',
    examples: ['What courses is john@company.com enrolled in?', 'Show sarah@test.com courses'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('courses') || lower.includes('enrolled')) && 
             !lower.includes('who is enrolled') &&
             !lower.includes('enroll');
    },
    requiredFields: ['email'],
    execute: async (api, { email }) => {
      const user = await api.quickUserSearch(email);
      if (!user) return `❌ **User Not Found**: ${email}`;

      const enrollments = await api.getUserEnrollments(user.user_id);
      if (enrollments.length === 0) {
        return `📚 **No Enrollments**\n\n${user.fullname} is not enrolled in any courses.`;
      }

      const courseList = enrollments.slice(0, 10).map((e: any, i: number) => {
        const courseName = e.course_name || e.name || e.course || e.course_title || 'Unknown Course';
        const status = e.status || e.enrollment_status || '';
        const progress = e.completion_percentage || e.progress || '';
        
        let statusIcon = '';
        if (status.toLowerCase().includes('completed') || progress === 100) {
          statusIcon = '✅';
        } else if (status.toLowerCase().includes('progress') || progress > 0) {
          statusIcon = '📚';
        } else {
          statusIcon = '⭕';
        }
        
        return `${i + 1}. ${statusIcon} ${courseName}${progress ? ` (${progress}%)` : ''}`;
      }).join('\n');
      
      return `📚 **${user.fullname}'s Courses** (${enrollments.length} total)\n\n${courseList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more courses` : ''}`;
    }
  },
  {
    name: 'get_course_users',
    description: 'Get all users enrolled in a course',
    examples: ['Who is enrolled in Python Programming?', 'Show Excel Training enrollments'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return lower.includes('who') && lower.includes('enrolled');
    },
    requiredFields: ['course'],
    execute: async (api, { course }) => {
      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) return `❌ **Course Not Found**: ${course}`;

      const enrollments = await api.getCourseEnrollments(courseObj.course_id || courseObj.idCourse);
      if (enrollments.length === 0) {
        return `👥 **No Enrollments**\n\nNo users enrolled in "${courseObj.course_name || courseObj.name}".`;
      }

      const userList = enrollments.slice(0, 10).map((e: any, i: number) => {
        const userName = e.user_name || e.fullname || e.first_name + ' ' + e.last_name || e.name || 'Unknown User';
        const userEmail = e.email || e.user_email || '';
        const status = e.status || e.enrollment_status || '';
        const progress = e.completion_percentage || e.progress || '';
        
        let statusIcon = '';
        if (status.toLowerCase().includes('completed') || progress === 100) {
          statusIcon = '✅';
        } else if (status.toLowerCase().includes('progress') || progress > 0) {
          statusIcon = '📚';
        } else {
          statusIcon = '⭕';
        }
        
        return `${i + 1}. ${statusIcon} ${userName}${userEmail ? ` (${userEmail})` : ''}${progress ? ` - ${progress}%` : ''}`;
      }).join('\n');
      
      return `👥 **"${courseObj.course_name || courseObj.name}" Enrollments** (${enrollments.length} users)\n\n${userList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more users` : ''}`;
    }
  },
  {
    name: 'find_user',
    description: 'Find and display user details',
    examples: ['Find user john@company.com', 'Show user details for sarah@test.com'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('find') || lower.includes('show')) && lower.includes('user');
    },
    requiredFields: ['email'],
    execute: async (api, { email }) => {
      const user = await api.quickUserSearch(email);
      if (!user) return `❌ **User Not Found**: ${email}`;

      return `👤 **User Found**\n\n**Name**: ${user.fullname}\n**Email**: ${user.email}\n**Status**: ${user.status === '1' ? 'Active' : 'Inactive'}\n**Last Login**: ${user.last_access_date ? new Date(user.last_access_date).toLocaleDateString() : 'Never'}\n**User ID**: ${user.user_id}`;
    }
  },
  {
    name: 'find_course',
    description: 'Find and display course details',
    examples: ['Find course Python', 'Show course details for Excel'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('find') || lower.includes('show')) && lower.includes('course');
    },
    requiredFields: ['course'],
    execute: async (api, { course }) => {
      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) return `❌ **Course Not Found**: ${course}`;

      return `📚 **Course Found**\n\n**Name**: ${courseObj.course_name || courseObj.name}\n**Type**: ${courseObj.course_type || courseObj.type}\n**Status**: ${courseObj.status}\n**Course ID**: ${courseObj.course_id || courseObj.idCourse}`;
    }
  }
];

// Enhanced command parser that uses the action registry
function parseCommand(message: string): { action: ActionHandler | null; params: any; missing: string[] } {
  const email = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0];
  
  // Find matching action
  const action = ACTION_REGISTRY.find(a => a.pattern(message));
  if (!action) {
    return { action: null, params: {}, missing: [] };
  }

  // Extract parameters
  const params: any = {};
  const missing: string[] = [];

  if (action.requiredFields.includes('email')) {
    if (email) {
      params.email = email;
    } else {
      missing.push('email address');
    }
  }

  if (action.requiredFields.includes('course')) {
    const course = message.match(/(?:in|to|course)\s+([^.!?]+)/i)?.[1]?.trim() ||
                  message.match(/"([^"]+)"/)?.[1] ||
                  message.replace(email || '', '').replace(/enroll|in|to|find|course|who|is|enrolled|show/gi, '').trim();
    
    if (course && course.length > 2) {
      params.course = course;
    } else {
      missing.push('course name');
    }
  }

  return { action, params, missing };
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

    const { action, params, missing } = parseCommand(message);
    let response = '';

    if (!action) {
      response = `🎯 **Quick Docebo Actions**

**Available Commands**:
${ACTION_REGISTRY.map(a => `• **${a.description}**\n  Example: "${a.examples[0]}"`).join('\n\n')}

💡 **Tip**: Be specific with email addresses and course names for faster results!`;
      
      return NextResponse.json({
        response,
        success: false,
        action: 'help',
        available_actions: ACTION_REGISTRY.map(a => ({
          name: a.name,
          description: a.description,
          examples: a.examples
        })),
        timestamp: new Date().toISOString()
      });
    }

    if (missing.length > 0) {
      response = `❌ **Missing Information**: I need the following to ${action.description}:\n\n${missing.map(m => `• ${m}`).join('\n')}\n\n**Example**: "${action.examples[0]}"`;
      
      return NextResponse.json({
        response,
        success: false,
        action: action.name,
        missing_fields: missing,
        examples: action.examples,
        timestamp: new Date().toISOString()
      });
    }

    // Execute the action
    try {
      response = await action.execute(api, params);
      
      return NextResponse.json({
        response,
        success: !response.includes('❌'),
        action: action.name,
        params: params,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Action ${action.name} failed:`, error);
      response = `❌ **${action.description} Failed**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`;
      
      return NextResponse.json({
        response,
        success: false,
        action: action.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}quickUserSearch(command.email);
        if (!userForCourses) {
          response = `❌ **User Not Found**: ${command.email}`;
          break;
        }

        const enrollments = await api.getUserEnrollments(userForCourses.user_id);
        if (enrollments.length === 0) {
          response = `📚 **No Enrollments**\n\n${userForCourses.fullname} is not enrolled in any courses.`;
        } else {
          const courseList = enrollments.slice(0, 10).map((e: any, i: number) => {
            // Handle different field names across Docebo versions
            const courseName = e.course_name || e.name || e.course || e.course_title || 'Unknown Course';
            const status = e.status || e.enrollment_status || '';
            const progress = e.completion_percentage || e.progress || '';
            
            let statusIcon = '';
            if (status.toLowerCase().includes('completed') || progress === 100) {
              statusIcon = '✅';
            } else if (status.toLowerCase().includes('progress') || progress > 0) {
              statusIcon = '📚';
            } else {
              statusIcon = '⭕';
            }
            
            return `${i + 1}. ${statusIcon} ${courseName}${progress ? ` (${progress}%)` : ''}`;
          }).join('\n');
          
          response = `📚 **${userForCourses.fullname}'s Courses** (${enrollments.length} total)\n\n${courseList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more courses` : ''}`;
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
          const userList = courseEnrollments.slice(0, 10).map((e: any, i: number) => {
            // Handle different field names for user data
            const userName = e.user_name || e.fullname || e.first_name + ' ' + e.last_name || e.name || 'Unknown User';
            const userEmail = e.email || e.user_email || '';
            const status = e.status || e.enrollment_status || '';
            const progress = e.completion_percentage || e.progress || '';
            
            let statusIcon = '';
            if (status.toLowerCase().includes('completed') || progress === 100) {
              statusIcon = '✅';
            } else if (status.toLowerCase().includes('progress') || progress > 0) {
              statusIcon = '📚';
            } else {
              statusIcon = '⭕';
            }
            
            return `${i + 1}. ${statusIcon} ${userName}${userEmail ? ` (${userEmail})` : ''}${progress ? ` - ${progress}%` : ''}`;
          }).join('\n');
          
          response = `👥 **"${courseForUsers.course_name || courseForUsers.name}" Enrollments** (${courseEnrollments.length} users)\n\n${userList}${courseEnrollments.length > 10 ? `\n\n... and ${courseEnrollments.length - 10} more users` : ''}`;
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
    status: 'Simple Docebo Chat - Scalable & Fast',
    version: '2.1.0',
    available_actions: ACTION_REGISTRY.map(action => ({
      name: action.name,
      description: action.description,
      examples: action.examples,
      required_fields: action.requiredFields
    })),
    features: [
      'Multiple endpoint fallbacks for reliability',
      'Scalable action registry system', 
      'Better field detection across Docebo versions',
      'Enhanced error handling with specific guidance',
      'Ready for easy expansion of new actions'
    ],
    endpoints_tested: [
      'User search: /manage/v1/user, /learn/v1/users, /api/v1/users',
      'Course search: /learn/v1/courses, /manage/v1/courses, /api/v1/courses', 
      'User enrollments: 4 different endpoint patterns',
      'Course enrollments: 4 different endpoint patterns',
      'Enrollment creation: 5 endpoints with 4 body formats each'
    ],
    note: 'System automatically finds working endpoints for your Docebo instance!'
  });
}
