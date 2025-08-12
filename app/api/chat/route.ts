// app/api/chat/route.ts - Clean production version
import { NextRequest, NextResponse } from 'next/server';

// Docebo API client
class OptimizedDoceboAPI {
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

  // User search
  async quickUserSearch(email: string): Promise<any> {
    const endpoints = ['/manage/v1/user', '/learn/v1/users', '/api/v1/users'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: email, page_size: 5 });
        const users = result.data?.items || result.items || [];
        
        if (users.length > 0) {
          // Find exact email match
          const exactMatch = users.find((user: any) => 
            user.email?.toLowerCase() === email.toLowerCase()
          ) || users[0];
          
          return exactMatch;
        }
      } catch (error) {
        continue; // Try next endpoint
      }
    }
    
    return null;
  }

  // Course search
  async quickCourseSearch(courseName: string): Promise<any> {
    const endpoints = ['/learn/v1/courses', '/manage/v1/courses', '/api/v1/courses'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: courseName, page_size: 10 });
        const courses = result.data?.items || result.items || [];
        
        if (courses.length > 0) {
          // Find best match for the course name
          const bestMatch = courses.find((course: any) => 
            (course.name || course.course_name)?.toLowerCase().includes(courseName.toLowerCase())
          ) || courses[0];
          
          return bestMatch;
        }
      } catch (error) {
        continue; // Try next endpoint
      }
    }
    
    return null;
  }

  // Main enrollment method
  async enrollUser(userId: string, courseId: string, options: {
    level?: string;
    dateBeginValidity?: string;
    dateExpireValidity?: string;
    assignmentType?: string;
  } = {}): Promise<{ success: boolean; message: string; details?: any }> {
    
    try {
      // Build enrollment request
      const enrollmentBody = {
        course_ids: [String(courseId)], // Ensure string format
        user_ids: [String(userId)],     // Ensure string format
        level: options.level || "3",
        date_begin_validity: options.dateBeginValidity,
        date_expire_validity: options.dateExpireValidity,
        assignment_type: options.assignmentType || "none",
        send_notification: false
      };

      // Remove undefined fields
      Object.keys(enrollmentBody).forEach(key => {
        if (enrollmentBody[key as keyof typeof enrollmentBody] === undefined) {
          delete enrollmentBody[key as keyof typeof enrollmentBody];
        }
      });

      // Make enrollment request
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(enrollmentBody)
      });
      
      const responseText = await response.text();
      
      if (response.ok) {
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          return { success: false, message: `Invalid JSON response: ${responseText}` };
        }
        
        const enrolledUsers = result.data?.enrolled || [];
        const errors = result.data?.errors || {};
        
        if (enrolledUsers.length > 0) {
          return { 
            success: true, 
            message: `Successfully enrolled user in course`,
            details: result
          };
        } else {
          // Handle specific error types
          let specificError = "";
          
          if (errors.existing_enrollments && errors.existing_enrollments.length > 0) {
            specificError = "User is already enrolled in this course";
          } else if (errors.invalid_users && errors.invalid_users.length > 0) {
            specificError = "User ID is invalid or user doesn't exist";
          } else if (errors.invalid_courses && errors.invalid_courses.length > 0) {
            specificError = "Course ID is invalid or course doesn't exist";
          } else if (errors.permission_denied && errors.permission_denied.length > 0) {
            specificError = "Permission denied - user cannot be enrolled in this course";
          } else {
            specificError = "Unknown enrollment restriction";
          }
          
          return { 
            success: false, 
            message: specificError,
            details: result
          };
        }
      } else {
        return { success: false, message: `HTTP ${response.status}: ${responseText}` };
      }
      
    } catch (error) {
      return { 
        success: false, 
        message: `Enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get user enrollments
  async getUserEnrollments(userId: string): Promise<any[]> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.items || [];
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  // Get course enrollments
  async getCourseEnrollments(courseId: string): Promise<any[]> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments/courses/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.items || [];
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }
}

// Action Handler Interface
interface ActionHandler {
  name: string;
  description: string;
  examples: string[];
  pattern: (message: string) => boolean;
  requiredFields: string[];
  execute: (api: OptimizedDoceboAPI, params: any) => Promise<string>;
}

// Action Registry
const ACTION_REGISTRY: ActionHandler[] = [
  {
    name: 'enroll_user',
    description: 'Enroll a single user in a course',
    examples: [
      'Enroll john@company.com in Python Programming',
      'Add sarah@test.com to Excel Training as mandatory',
      'Enroll mike@company.com in SQL course as optional due 2025-12-31',
      'Add user@company.com to Leadership Training as recommended'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('enroll') || lower.includes('add')) && 
             !lower.includes('bulk') &&
             !lower.includes('group') &&
             !lower.includes('multiple') &&
             !lower.includes('who') && 
             !lower.includes('unenroll');
    },
    requiredFields: ['email', 'course'],
    execute: async (api, { email, course, level, dueDate, assignmentType }) => {
      const user = await api.quickUserSearch(email);
      if (!user) {
        return `❌ **User Not Found**: ${email}\n\nDouble-check the email address.`;
      }

      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) {
        return `❌ **Course Not Found**: ${course}\n\nTry a shorter course name or check spelling.`;
      }

      const options = {
        level: level || "3",
        dateExpireValidity: dueDate,
        assignmentType: assignmentType || "none"
      };

      // Use the correct property name for course ID (id_course)
      const courseId = courseObj.id_course || courseObj.course_id || courseObj.idCourse || courseObj.id;
      
      if (!courseId) {
        return `❌ **Course ID Missing**: Found course "${courseObj.name || courseObj.course_name}" but no valid ID`;
      }
      
      const result = await api.enrollUser(user.user_id, courseId, options);
      
      if (result.success) {
        return `✅ **Enrollment Successful**\n\n**User**: ${user.fullname || user.first_name + ' ' + user.last_name} (${user.email})\n**Course**: ${courseObj.name || courseObj.course_name}\n**Level**: ${options.level}\n**Assignment**: ${options.assignmentType}${options.dateExpireValidity ? `\n**Due Date**: ${options.dateExpireValidity}` : ''}\n\n🎯 Successfully enrolled in Docebo!`;
      } else {
        return `❌ **Enrollment Failed**\n\n**Issue**: ${result.message}\n\n**User**: ${user.fullname || user.first_name + ' ' + user.last_name} (${user.email})\n**Course**: ${courseObj.name || courseObj.course_name}\n\n💡 ${result.message.includes('already enrolled') ? 'User is already enrolled in this course.' : 'Check course rules and user permissions in Docebo admin panel.'}`;
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
        return `📚 **No Enrollments**\n\n${user.fullname || user.first_name + ' ' + user.last_name} is not enrolled in any courses.`;
      }

      const courseList = enrollments.slice(0, 10).map((e: any, i: number) => {
        const courseName = e.course_name || e.name || 'Unknown Course';
        const status = e.status || '';
        const progress = e.completion_percentage || '';
        
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
      
      return `📚 **${user.fullname || user.first_name + ' ' + user.last_name}'s Courses** (${enrollments.length} total)\n\n${courseList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more courses` : ''}`;
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

      const courseId = courseObj.id_course || courseObj.course_id || courseObj.idCourse || courseObj.id;
      const enrollments = await api.getCourseEnrollments(courseId);
      
      if (enrollments.length === 0) {
        return `👥 **No Enrollments**\n\nNo users enrolled in "${courseObj.name || courseObj.course_name}".`;
      }

      const userList = enrollments.slice(0, 10).map((e: any, i: number) => {
        const userName = e.user_name || e.fullname || 'Unknown User';
        const userEmail = e.email || e.user_email || '';
        const status = e.status || '';
        const progress = e.completion_percentage || '';
        
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
      
      return `👥 **"${courseObj.name || courseObj.course_name}" Enrollments** (${enrollments.length} users)\n\n${userList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more users` : ''}`;
    }
  }
];

// Command parser
function parseCommand(message: string): { action: ActionHandler | null; params: any; missing: string[] } {
  const email = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0];
  
  const action = ACTION_REGISTRY.find(a => a.pattern(message));
  if (!action) {
    return { action: null, params: {}, missing: [] };
  }

  const params: any = {};
  const missing: string[] = [];

  // Parse email(s)
  if (action.requiredFields.includes('email')) {
    if (email) {
      params.email = email;
    } else {
      missing.push('email address');
    }
  }

  // Parse course name
  if (action.requiredFields.includes('course')) {
    let course = '';
    
    // Try different patterns to extract course name
    const patterns = [
      /(?:in|to)\s+([^(as|due|level|with)]+?)(?:\s+(?:as|due|level|with)|$)/i,
      /"([^"]+)"/,
      /(?:enroll|add).*?(?:in|to)\s+([^(as|due|level|with)]+?)(?:\s+(?:as|due|level|with)|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        course = match[1].trim();
        break;
      }
    }
    
    // Fallback extraction
    if (!course) {
      course = message
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
        .replace(/^(enroll|add|bulk|multiple)/gi, '')
        .replace(/\s+(as|due|level|with)\s+.*/gi, '')
        .replace(/\s+(in|to)\s+/gi, ' ')
        .trim();
    }
    
    if (course && course.length > 2) {
      params.course = course;
    } else {
      missing.push('course name');
    }
  }

  // Parse optional parameters
  const levelMatch = message.match(/level\s+(\d+)/i);
  if (levelMatch) {
    params.level = levelMatch[1];
  }

  const dueDateMatch = message.match(/due\s+(\d{4}-\d{2}-\d{2})/i) || 
                      message.match(/by\s+(\d{4}-\d{2}-\d{2})/i);
  if (dueDateMatch) {
    params.dueDate = dueDateMatch[1];
  }

  const assignmentMatch = message.match(/\bas\s+(mandatory|required|recommended|optional)/i);
  if (assignmentMatch) {
    params.assignmentType = assignmentMatch[1].toLowerCase();
  }

  return { action, params, missing };
}

// Initialize API client
const api = new OptimizedDoceboAPI({
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

    if (!action) {
      const response = `🎯 **Docebo Assistant**

**Available Commands**:
${ACTION_REGISTRY.map(a => `• **${a.description}**\n  Example: "${a.examples[0]}"`).join('\n\n')}

💡 **Tip**: Use natural language like the examples above!`;
      
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
      const response = `❌ **Missing Information**: I need the following to ${action.description}:\n\n${missing.map(m => `• ${m}`).join('\n')}\n\n**Example**: "${action.examples[0]}"`;
      
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
      const response = await action.execute(api, params);
      
      return NextResponse.json({
        response,
        success: !response.includes('❌'),
        action: action.name,
        params: params,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Action ${action.name} failed:`, error);
      
      const errorResponse = `❌ **${action.description} Failed**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`;
      
      return NextResponse.json({
        response: errorResponse,
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
}

export async function GET() {
  return NextResponse.json({
    status: 'Docebo Chat API - Production Ready',
    version: '1.0.0',
    features: [
      'Natural language enrollment management',
      'User and course search',
      'Enrollment status checking',
      'Real-time Docebo integration'
    ],
    available_actions: ACTION_REGISTRY.map(action => ({
      name: action.name,
      description: action.description,
      examples: action.examples,
      required_fields: action.requiredFields
    })),
    examples: [
      "Enroll john@company.com in Python Programming",
      "Enroll sarah@test.com in Excel Training as mandatory",
      "Add mike@company.com to SQL course as optional due 2025-12-31",
      "Enroll user@company.com in Leadership Training as recommended",
      "What courses is john@company.com enrolled in?",
      "Who is enrolled in Leadership Training?"
    ],
    note: 'Clean production version with working enrollment functionality!'
  });
}
