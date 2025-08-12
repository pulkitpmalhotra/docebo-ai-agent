// app/api/chat/route.ts - Optimized with parallel lookups
import { NextRequest, NextResponse } from 'next/server';

// Enhanced Docebo API client with parallel lookups
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

  // Optimized parallel user search
  async searchUsersParallel(emails: string[]): Promise<{ found: any[]; failed: string[] }> {
    console.log(`🔍 Searching ${emails.length} users in parallel...`);
    
    const searchPromises = emails.map(async (email) => {
      try {
        const user = await this.quickUserSearch(email);
        return { email, user, success: !!user };
      } catch (error) {
        console.log(`❌ Failed to search user ${email}:`, error);
        return { email, user: null, success: false };
      }
    });

    const results = await Promise.allSettled(searchPromises);
    
    const found: any[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        found.push(result.value.user);
      } else {
        failed.push(emails[index]);
      }
    });

    console.log(`✅ Found ${found.length}/${emails.length} users`);
    return { found, failed };
  }

  // Optimized parallel course search  
  async searchCoursesParallel(courseNames: string[]): Promise<{ found: any[]; failed: string[] }> {
    console.log(`🔍 Searching ${courseNames.length} courses in parallel...`);
    
    const searchPromises = courseNames.map(async (courseName) => {
      try {
        const course = await this.quickCourseSearch(courseName);
        return { courseName, course, success: !!course };
      } catch (error) {
        console.log(`❌ Failed to search course ${courseName}:`, error);
        return { courseName, course: null, success: false };
      }
    });

    const results = await Promise.allSettled(searchPromises);
    
    const found: any[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        found.push(result.value.course);
      } else {
        failed.push(courseNames[index]);
      }
    });

    console.log(`✅ Found ${found.length}/${courseNames.length} courses`);
    return { found, failed };
  }

  // Single user search with fallbacks
  async quickUserSearch(email: string): Promise<any> {
    const endpoints = ['/manage/v1/user', '/learn/v1/users', '/api/v1/users'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: email, page_size: 5 });
        const users = result.data?.items || result.items || [];
        if (users.length > 0) {
          return users[0];
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  // Single course search with fallbacks
  async quickCourseSearch(courseName: string): Promise<any> {
    const endpoints = ['/learn/v1/courses', '/manage/v1/courses', '/api/v1/courses'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: courseName, page_size: 5 });
        const courses = result.data?.items || result.items || [];
        if (courses.length > 0) {
          return courses[0];
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  // Other methods remain the same...
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
        return enrollments;
      } catch (error) {
        continue;
      }
    }
    
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
        return enrollments;
      } catch (error) {
        continue;
      }
    }
    
    return [];
  }

  // Optimized enrollment methods
  async enrollUser(userId: string, courseId: string, options: {
    level?: string;
    dateBeginValidity?: string;
    dateExpireValidity?: string;
    assignmentType?: string;
    enrolledAt?: string;
  } = {}): Promise<{ success: boolean; message: string }> {
    try {
      const enrollmentBody = {
        course_ids: [courseId],
        user_ids: [userId],
        level: options.level || "3",
        date_begin_validity: options.dateBeginValidity,
        date_expire_validity: options.dateExpireValidity,
        assignment_type: options.assignmentType || "mandatory",
        enrolled_at: options.enrolledAt || new Date().toISOString().split('T')[0]
      };

      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrollmentBody)
      });
      
      if (response.ok) {
        return { success: true, message: `Successfully enrolled user in course` };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Enrollment failed: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      return { success: false, message: `Enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async enrollBulkUsers(userIds: string[], courseIds: string[], options: {
    level?: string;
    dateBeginValidity?: string;
    dateExpireValidity?: string;
    assignmentType?: string;
    enrolledAt?: string;
  } = {}): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const enrollmentBody = {
        course_ids: courseIds,
        user_ids: userIds,
        level: options.level || "3",
        date_begin_validity: options.dateBeginValidity,
        date_expire_validity: options.dateExpireValidity,
        assignment_type: options.assignmentType || "mandatory",
        enrolled_at: options.enrolledAt || new Date().toISOString().split('T')[0]
      };

      console.log(`📡 Bulk enrolling ${userIds.length} users in ${courseIds.length} courses...`);

      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrollmentBody)
      });
      
      if (response.ok) {
        const result = await response.json();
        return { 
          success: true, 
          message: `Successfully enrolled ${userIds.length} users in ${courseIds.length} courses`,
          details: result
        };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Bulk enrollment failed: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      return { success: false, message: `Bulk enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async enrollGroup(groupIds: string[], courseIds: string[], options: {
    level?: string;
    dateBeginValidity?: string;
    dateExpireValidity?: string;
    assignmentType?: string;
    enrolledAt?: string;
  } = {}): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const enrollmentBody = {
        course_ids: courseIds,
        group_ids: groupIds,
        level: options.level || "3",
        date_begin_validity: options.dateBeginValidity,
        date_expire_validity: options.dateExpireValidity,
        assignment_type: options.assignmentType || "mandatory",
        enrolled_at: options.enrolledAt || new Date().toISOString().split('T')[0]
      };

      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrollmentBody)
      });
      
      if (response.ok) {
        const result = await response.json();
        return { 
          success: true, 
          message: `Successfully enrolled ${groupIds.length} groups in ${courseIds.length} courses`,
          details: result
        };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Group enrollment failed: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      return { success: false, message: `Group enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async searchGroups(searchText: string): Promise<any[]> {
    const endpoints = ['/manage/v1/groups', '/learn/v1/groups', '/api/v1/groups'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiCall(endpoint, { search_text: searchText, page_size: 5 });
        const groups = result.data?.items || result.items || [];
        if (groups.length > 0) {
          return groups;
        }
      } catch (error) {
        continue;
      }
    }
    
    return [];
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

// Optimized Action Registry
const ACTION_REGISTRY: ActionHandler[] = [
  {
    name: 'enroll_user',
    description: 'Enroll a single user in a course',
    examples: [
      'Enroll john@company.com in Python Programming',
      'Add sarah@test.com to Excel Training with level 2',
      'Enroll mike@company.com in SQL course as mandatory due 2025-12-31'
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
      if (!user) return `❌ **User Not Found**: ${email}\n\nDouble-check the email address.`;

      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) return `❌ **Course Not Found**: ${course}\n\nTry a shorter course name or check spelling.`;

      const options = {
        level: level || "3",
        dateExpireValidity: dueDate,
        assignmentType: assignmentType || "mandatory",
        enrolledAt: new Date().toISOString().split('T')[0]
      };

      const result = await api.enrollUser(user.user_id, courseObj.course_id || courseObj.idCourse, options);
      if (result.success) {
        return `✅ **Enrollment Successful**\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${courseObj.course_name || courseObj.name}\n**Level**: ${options.level}\n**Assignment**: ${options.assignmentType}\n**Enrolled**: ${options.enrolledAt}${options.dateExpireValidity ? `\n**Due Date**: ${options.dateExpireValidity}` : ''}\n\n🎯 User will receive notification and can access immediately.`;
      } else {
        return `❌ **Enrollment Failed**\n\n**Issue**: ${result.message}`;
      }
    }
  },
  {
    name: 'enroll_bulk_users',
    description: 'Enroll multiple users in one or more courses',
    examples: [
      'Bulk enroll users: john@company.com,sarah@test.com in Python Programming',
      'Enroll multiple users john@company.com,mike@company.com in Excel Training,SQL Fundamentals'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('bulk') || lower.includes('multiple')) && 
             lower.includes('enroll') && 
             !lower.includes('group');
    },
    requiredFields: ['users', 'courses'],
    execute: async (api, { users, courses, level, dueDate, assignmentType }) => {
      const emails = Array.isArray(users) ? users : users.split(',').map((u: string) => u.trim());
      const courseNames = Array.isArray(courses) ? courses : courses.split(',').map((c: string) => c.trim());

      if (emails.length > 50) {
        return `❌ **Too Many Users**: For bulk operations with ${emails.length} users, please use a CSV file.\n\n💡 **Try**: "Upload CSV for bulk enrollment"`;
      }

      console.log(`🚀 Starting parallel lookup for ${emails.length} users and ${courseNames.length} courses...`);

      // OPTIMIZED: Parallel lookups
      const [userResults, courseResults] = await Promise.all([
        api.searchUsersParallel(emails),
        api.searchCoursesParallel(courseNames)
      ]);

      if (userResults.found.length === 0) {
        return `❌ **No Valid Users Found**: ${userResults.failed.join(', ')}\n\nPlease check email addresses.`;
      }

      if (courseResults.found.length === 0) {
        return `❌ **No Valid Courses Found**: ${courseResults.failed.join(', ')}\n\nPlease check course names.`;
      }

      const userIds = userResults.found.map(user => user.user_id);
      const courseIds = courseResults.found.map(course => course.course_id || course.idCourse);

      const options = {
        level: level || "3",
        dateExpireValidity: dueDate,
        assignmentType: assignmentType || "mandatory",
        enrolledAt: new Date().toISOString().split('T')[0]
      };

      const result = await api.enrollBulkUsers(userIds, courseIds, options);
      
      if (result.success) {
        let response = `✅ **Bulk Enrollment Successful**\n\n`;
        response += `**Users Enrolled**: ${userResults.found.length} users\n`;
        response += `**Courses**: ${courseResults.found.length} courses\n`;
        response += `**Total Enrollments**: ${userResults.found.length * courseResults.found.length}\n`;
        response += `**Level**: ${options.level}\n`;
        response += `**Assignment**: ${options.assignmentType}`;
        
        if (userResults.failed.length > 0) {
          response += `\n\n⚠️ **Failed Users**: ${userResults.failed.join(', ')}`;
        }
        if (courseResults.failed.length > 0) {
          response += `\n\n⚠️ **Failed Courses**: ${courseResults.failed.join(', ')}`;
        }
        
        response += `\n\n🎯 All users will receive notifications immediately.`;
        return response;
      } else {
        return `❌ **Bulk Enrollment Failed**\n\n**Issue**: ${result.message}`;
      }
    }
  },
  // Add other actions here...
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
        const userName = e.user_name || e.fullname || (e.first_name + ' ' + e.last_name) || e.name || 'Unknown User';
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
  }
];

// Enhanced command parser
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

  // Parse multiple users for bulk operations
  if (action.requiredFields.includes('users')) {
    const emails = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emails && emails.length >= 1) {
      params.users = emails;
    } else {
      missing.push('user email addresses (comma-separated)');
    }
  }

  // Parse course(s)
  if (action.requiredFields.includes('course') || action.requiredFields.includes('courses')) {
    const coursePattern = /(?:in|to|course[s]?)\s+([^.!?]+)/i;
    const quotedPattern = /"([^"]+)"/;
    
    let course = message.match(quotedPattern)?.[1] || 
                message.match(coursePattern)?.[1]?.trim();
    
    if (!course) {
      course = message
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
        .replace(/enroll|in|to|find|course|who|is|enrolled|show|add|bulk|multiple/gi, '')
        .trim();
    }
    
    if (course && course.length > 2) {
      if (course.includes(',')) {
        params.courses = course.split(',').map(c => c.trim());
      } else {
        params.course = course;
        params.courses = [course];
      }
    } else {
      missing.push(action.requiredFields.includes('courses') ? 'course names' : 'course name');
    }
  }

  // Parse optional enrollment parameters
  const levelMatch = message.match(/level\s+(\d+)/i);
  if (levelMatch) {
    params.level = levelMatch[1];
  }

  const dueDateMatch = message.match(/due\s+(\d{4}-\d{2}-\d{2})/i) || 
                      message.match(/by\s+(\d{4}-\d{2}-\d{2})/i);
  if (dueDateMatch) {
    params.dueDate = dueDateMatch[1];
  }

  const assignmentMatch = message.match(/(mandatory|optional)/i);
  if (assignmentMatch) {
    params.assignmentType = assignmentMatch[1].toLowerCase();
  }

  return { action, params, missing };
}

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
      const response = `🎯 **Quick Docebo Actions**

**Available Commands**:
${ACTION_REGISTRY.map(a => `• **${a.description}**\n  Example: "${a.examples[0]}"`).join('\n\n')}

💡 **Tip**: Use comma-separated emails for bulk operations!`;
      
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
      const response = `❌ **${action.description} Failed**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`;
      
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
}

export async function GET() {
  return NextResponse.json({
    status: 'Optimized Docebo Chat - Parallel Lookups',
    version: '2.2.0',
    performance_features: [
      'Parallel user lookup for bulk operations',
      'Parallel course lookup for multiple courses', 
      'Promise.allSettled for fault tolerance',
      'Optimized API call batching',
      'Smart error aggregation'
    ],
    available_actions: ACTION_REGISTRY.map(action => ({
      name: action.name,
      description: action.description,
      examples: action.examples,
      required_fields: action.requiredFields
    })),
    note: 'Now with optimized parallel lookups for better bulk operation performance!'
  });
}
