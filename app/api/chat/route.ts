// app/api/chat/route.ts - Complete corrected version
import { NextRequest, NextResponse } from 'next/server';

interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

interface DoceboUser {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  fullname: string;
  status: string;
  level: string;
  last_access_date: string | null;
  creation_date: string;
  field_1?: string;
  field_2?: string;
  language: string;
  timezone: string;
  is_manager: boolean;
  expired: boolean;
}

interface DoceboCourse {
  idCourse: string;
  name: string;
  code?: string;
  type: string;
  status: string;
  description?: string;
  enrolled_users?: number;
  creation_date?: string;
}

interface DoceboApiResponse<T> {
  data: {
    items: T[];
    count: number;
    current_page: number;
    current_page_size: number;
    has_more_data: boolean;
    total_count: number;
    total_page_count: number;
  };
  version: string;
}

class DoceboAPI {
  private config: DoceboConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: DoceboConfig) {
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
      throw new Error(`Docebo OAuth failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token received from Docebo');
    }
    
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    if (!this.accessToken) {
      throw new Error('Failed to store access token');
    }
    
    return this.accessToken;
  }

  private async apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' = 'GET', params?: Record<string, string | number>): Promise<T> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value.toString());
      });
      url += `?${queryParams}`;
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    const response = await fetch(url, { method, headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  async getUsers(params: { page_size?: number; search_text?: string } = {}): Promise<DoceboApiResponse<DoceboUser>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest('/manage/v1/user', 'GET', queryParams);
  }

  async searchUsers(searchText: string, limit: number = 50): Promise<DoceboUser[]> {
    const result = await this.getUsers({ search_text: searchText, page_size: limit });
    return result.data.items;
  }

  async getCourses(params: { page_size?: number; search_text?: string } = {}): Promise<DoceboApiResponse<DoceboCourse>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest('/learn/v1/courses', 'GET', queryParams);
  }

  async searchCourses(searchText: string, limit: number = 50): Promise<DoceboCourse[]> {
    const result = await this.getCourses({ search_text: searchText, page_size: limit });
    return result.data.items;
  }
}

const doceboAPI = new DoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
});

interface ChatRequest {
  message: string;
  userRole?: string;
  userId?: string;
}

interface ChatResponse {
  response: string;
  intent: string;
  userRole: string;
  suggestions?: string[];
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary';
    action: string;
  }>;
  meta: {
    api_mode: string;
    processing_time: number;
    timestamp: string;
  };
}

const DOCEBO_CATEGORIES = {
  user_management: { name: 'User Management' },
  course_management: { name: 'Course Management' },
  enrollments: { name: 'Enrollments' },
  reports: { name: 'Reports' },
  analytics: { name: 'Analytics' }
};

const ROLE_PERMISSIONS = {
  superadmin: ['user_management', 'course_management', 'enrollments', 'reports', 'analytics'],
  power_user: ['user_management', 'course_management', 'enrollments', 'reports'],
  user_manager: ['user_management', 'reports'],
  user: ['reports']
};

function validateRequest(body: any): { success: boolean; data?: ChatRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }
  if (!body.message || typeof body.message !== 'string') {
    return { success: false, error: 'Message is required' };
  }
  return {
    success: true,
    data: {
      message: body.message.trim(),
      userRole: body.userRole || 'user',
      userId: body.userId || 'anonymous'
    }
  };
}

function detectIntent(message: string): string {
  const messageLower = message.toLowerCase().trim();
  
  if (messageLower.includes('search') && messageLower.includes('user')) {
    return 'search_user_action';
  }
  if (messageLower.includes('search') && messageLower.includes('course')) {
    return 'search_course_action';
  }
  if (messageLower.includes('course') && messageLower.includes('stat')) {
    return 'course_stats_action';
  }
  if (messageLower.includes('user') && (messageLower.includes('status') || messageLower.includes('check'))) {
    return 'user_status_action';
  }
  if (messageLower.includes('what') && (messageLower.includes('do') || messageLower.includes('can'))) {
    return 'category_selection';
  }
  if (messageLower.includes('user') && messageLower.includes('manage')) {
    return 'user_management';
  }
  if (messageLower.includes('course') && messageLower.includes('manage')) {
    return 'course_management';
  }
  
  return 'category_selection';
}

async function handleSearchUser(message: string): Promise<string> {
  try {
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const nameMatch = message.match(/(?:user|name)[:\s]+([^,\n]+)/i);
    
    let searchTerm = '';
    if (emailMatch) {
      searchTerm = emailMatch[0];
    } else if (nameMatch) {
      searchTerm = nameMatch[1].trim();
    } else {
      return '❓ **Search User**: Please specify a user email or name. Example: "Search for user swathipunreddy@google.com"';
    }
    
    const users = await doceboAPI.searchUsers(searchTerm, 10);
    
    if (users.length === 0) {
      return `❌ **No Users Found**: No users found matching "${searchTerm}" in your Docebo instance.`;
    }
    
    const userList = users.slice(0, 5).map(user => {
      const department = user.field_2 || 'Not specified';
      const lastLogin = user.last_access_date ? new Date(user.last_access_date).toLocaleDateString() : 'Never';
      const isActive = user.status === '1';
      const fullName = user.fullname || `${user.first_name} ${user.last_name}`;
      
      return `**${fullName}** (${user.email})
• Status: ${isActive ? '✅ Active' : '❌ Inactive'}
• Department: ${department}
• Last Login: ${lastLogin}
• User ID: ${user.user_id}
• Level: ${user.level}`;
    }).join('\n\n');
    
    return `👥 **User Search Results** (${users.length} found in Docebo)

${userList}

🔗 **Data Source**: Live from your Docebo instance`;
    
  } catch (error) {
    return `❌ **Search Failed**: Unable to search users in Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleSearchCourses(message: string): Promise<string> {
  try {
    const courseMatch = message.match(/course[s]?[:\s]+([^,\n]+)/i) || message.match(/search[^:]*:?\s*([^\n,]+)/i);
    
    let searchTerm = '';
    if (courseMatch) {
      searchTerm = courseMatch[1].trim().replace(/["']/g, '');
    }
    
    const courses = searchTerm ? 
      await doceboAPI.searchCourses(searchTerm, 10) : 
      await doceboAPI.getCourses({ page_size: 10 }).then(result => result.data.items);
    
    if (courses.length === 0) {
      return `❌ **No Courses Found**: No courses found${searchTerm ? ` matching "${searchTerm}"` : ''} in your Docebo instance.`;
    }
    
    const courseList = courses.map(course => {
      const courseName = course.name || 'Unnamed Course';
      const courseId = course.idCourse || 'No ID';
      const enrolledUsers = course.enrolled_users || 0;
      const courseType = course.type || 'Unknown';
      const courseStatus = course.status || 'Unknown';
      
      let statusDisplay = courseStatus;
      if (courseStatus === '2' || courseStatus === 'published') {
        statusDisplay = '✅ Published';
      } else if (courseStatus === '1' || courseStatus === 'draft') {
        statusDisplay = '📝 Draft';
      } else if (courseStatus === '0' || courseStatus === 'inactive') {
        statusDisplay = '❌ Inactive';
      }
      
      return `📚 **${courseName}**
• Course ID: ${courseId}
• Type: ${courseType}
• Status: ${statusDisplay}
• Enrolled Users: ${enrolledUsers}`;
    }).join('\n\n');
    
    return `📚 **Course Search Results** (${courses.length} found in Docebo)

${courseList}

🔗 **Data Source**: Live from your Docebo instance`;
    
  } catch (error) {
    return `❌ **Search Failed**: Unable to search courses in Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleCourseStats(): Promise<string> {
  try {
    const coursesResult = await doceboAPI.getCourses({ page_size: 100 });
    const courses = coursesResult.data.items;
    
    if (courses.length === 0) {
      return '❌ **No Course Data**: No courses found in your Docebo instance.';
    }
    
    const totalCourses = coursesResult.data.total_count || courses.length;
    const totalEnrollments = courses.reduce((sum, c) => sum + (c.enrolled_users || 0), 0);
    
    const statusCounts = courses.reduce((acc, course) => {
      const status = course.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const courseTypes = courses.reduce((acc, course) => {
      const type = course.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const typeList = Object.entries(courseTypes)
      .map(([type, count]) => `• ${type}: ${count} courses`)
      .join('\n');
    
    const statusList = Object.entries(statusCounts)
      .map(([status, count]) => {
        let statusLabel = status;
        if (status === '2') statusLabel = 'Published';
        else if (status === '1') statusLabel = 'Draft';
        else if (status === '0') statusLabel = 'Inactive';
        return `• ${statusLabel}: ${count} courses`;
      })
      .join('\n');
    
    const topCourses = courses
      .filter(course => course.enrolled_users !== undefined)
      .sort((a, b) => (b.enrolled_users || 0) - (a.enrolled_users || 0))
      .slice(0, 5)
      .map((course, index) => 
        `${index + 1}. **${course.name || 'Unnamed Course'}** - ${course.enrolled_users || 0} enrollments`
      ).join('\n');
    
    return `📊 **Course Statistics** (Live from Docebo)

**Overall Metrics:**
• Total Courses: ${totalCourses}
• Total Enrollments: ${totalEnrollments} users

**Course Status:**
${statusList}

**Course Types:**
${typeList}

${topCourses ? `**Top Courses:**\n${topCourses}` : ''}

🔗 **Data Source**: Live from your Docebo instance
📅 **Generated**: ${new Date().toLocaleString()}`;
    
  } catch (error) {
    return `❌ **Stats Failed**: Unable to get course statistics from Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleUserStatus(message: string): Promise<string> {
  try {
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    
    if (!emailMatch) {
      return '❓ **Check User Status**: Please specify a user email. Example: "Check status of user swathipunreddy@google.com"';
    }
    
    const userEmail = emailMatch[0];
    const users = await doceboAPI.searchUsers(userEmail, 5);
    const user = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
    
    if (!user) {
      return `❌ **User Not Found**: User "${userEmail}" not found in your Docebo instance.`;
    }
    
    const department = user.field_2 || 'Not specified';
    const position = user.field_1 || 'Not specified';
    const lastLogin = user.last_access_date ? new Date(user.last_access_date).toLocaleDateString() : 'Never';
    const registerDate = user.creation_date ? new Date(user.creation_date).toLocaleDateString() : 'Unknown';
    const isActive = user.status === '1';
    const fullName = user.fullname || `${user.first_name} ${user.last_name}`;
    
    return `👤 **User Status** (Live from Docebo)

**${fullName}** (${user.email})

• **Status**: ${isActive ? '✅ Active' : '❌ Inactive'}
• **Department**: ${department}
• **Position**: ${position}
• **Last Login**: ${lastLogin}
• **Registration Date**: ${registerDate}
• **User ID**: ${user.user_id}
• **Level**: ${user.level}
• **Username**: ${user.username}
• **Language**: ${user.language}
• **Timezone**: ${user.timezone}
• **Is Manager**: ${user.is_manager ? 'Yes' : 'No'}

${isActive ? '🟢 User account is active and can access training.' : '🔴 User account is inactive. Contact admin to reactivate.'}

🔗 **Data Source**: Live from your Docebo instance`;
    
  } catch (error) {
    return `❌ **Status Check Failed**: Unable to check user status in Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function generateResponse(message: string, intent: string, userRole: string): Promise<ChatResponse> {
  const startTime = Date.now();
  const allowedCategories = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];
  
  let response = '';
  let suggestions: string[] = [];
  let actions: Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> = [];

  switch (intent) {
    case 'search_user_action':
    case 'user_status_action':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to search users.`;
      } else {
        response = intent === 'user_status_action' ? 
          await handleUserStatus(message) : 
          await handleSearchUser(message);
        suggestions = ['Search for another user', 'Check user status', 'View course management'];
        actions = [
          { id: 'search_user', label: 'Search Another User', type: 'primary', action: 'search_user_form' },
          { id: 'user_status', label: 'Check User Status', type: 'primary', action: 'user_status_form' },
          { id: 'course_mgmt', label: 'Course Management', type: 'secondary', action: 'category_course_management' }
        ];
      }
      break;
      
    case 'search_course_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to search courses.`;
      } else {
        response = await handleSearchCourses(message);
        suggestions = ['View course statistics', 'Search users', 'User management'];
        actions = [
          { id: 'course_stats', label: 'Course Statistics', type: 'primary', action: 'course_stats_query' },
          { id: 'search_users', label: 'Search Users', type: 'primary', action: 'search_user_form' },
          { id: 'user_mgmt', label: 'User Management', type: 'secondary', action: 'category_user_management' }
        ];
      }
      break;
      
    case 'course_stats_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to view course statistics.`;
      } else {
        response = await handleCourseStats();
        suggestions = ['Search specific courses', 'Search users', 'User management'];
        actions = [
          { id: 'search_courses', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'search_users', label: 'Search Users', type: 'secondary', action: 'search_user_form' }
        ];
      }
      break;

    case 'category_selection':
      response = `👋 **Welcome to Docebo AI Assistant!**

I can help you with various LMS management tasks using live data from your Docebo instance.

**Available Categories for ${userRole.replace('_', ' ').toUpperCase()}:**

${allowedCategories.map(cat => `🔹 **${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name}**`).join('\n')}

🔗 **Connected to**: Your live Docebo instance
⚡ **Real-time data**: All responses use current Docebo data

What would you like to do?`;

      suggestions = allowedCategories.map(cat => 
        `Help with ${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name.toLowerCase()}`
      );
      
      actions = allowedCategories.slice(0, 3).map(cat => ({
        id: cat,
        label: DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name,
        type: 'primary' as const,
        action: `category_${cat}`
      }));
      break;

    case 'user_management':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access User Management features.`;
      } else {
        response = `👥 **User Management** (Live Docebo Data)

I can help you with user management tasks using real-time data from your Docebo instance:

• Search for users by email or name
• Check user status and details
• View user profiles and activity

What specific user management task would you like to perform?

🔗 **Data Source**: Live from your Docebo instance`;
        
        suggestions = [
          'Search for user by email',
          'Check user status',
          'Help with course management'
        ];
        
        actions = [
          { id: 'search_user', label: 'Search User', type: 'primary', action: 'search_user_form' },
          { id: 'user_status', label: 'Check User Status', type: 'primary', action: 'user_status_form' },
          { id: 'course_mgmt', label: 'Course Management', type: 'secondary', action: 'category_course_management' }
        ];
      }
      break;

    case 'course_management':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Course Management features.`;
      } else {
        response = `📚 **Course Management** (Live Docebo Data)

I can help you with course management tasks using real-time data from your Docebo instance:

• Search for courses by name or keyword
• View course statistics and enrollment data
• Check course status and details

What specific course management task would you like to perform?

🔗 **Data Source**: Live from your Docebo instance`;
        
        suggestions = [
          'Search for courses',
          'Show course statistics',
          'Help with user management'
        ];
        
        actions = [
          { id: 'search_course', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'course_stats', label: 'Course Statistics', type: 'primary', action: 'course_stats_query' },
          { id: 'user_mgmt', label: 'User Management', type: 'secondary', action: 'category_user_management' }
        ];
      }
      break;

    default:
      response = `🤔 **I can help you with**: ${allowedCategories.map(cat => DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name).join(', ')}

All data comes live from your Docebo instance. What would you like to do?`;
      
      suggestions = ['What can you help me with?', 'Show user management', 'Show course management'];
      actions = [
        { id: 'help', label: 'Show All Options', type: 'primary', action: 'category_selection' }
      ];
  }

  const processingTime = Date.now() - startTime;

  return {
    response,
    intent,
    userRole,
    suggestions,
    actions,
    meta: {
      api_mode: 'real_docebo_corrected',
      processing_time: processingTime,
      timestamp: new Date().toISOString()
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => {
      throw new Error('Invalid JSON in request body');
    });

    const validation = validateRequest(body);
    if (!validation.success) {
      return NextResponse.json({
        error: validation.error,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const { message, userRole = 'user', userId } = validation.data!;

    const intent = detectIntent(message);
    const result = await generateResponse(message, intent, userRole);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
      meta: {
        api_mode: 'real_docebo_corrected',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const usersResult = await doceboAPI.getUsers({ page_size: 1 });
    const coursesResult = await doceboAPI.getCourses({ page_size: 1 });
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Corrected Docebo Chat API is running',
      timestamp: new Date().toISOString(),
      docebo_connection: 'connected',
      available_categories: Object.keys(DOCEBO_CATEGORIES),
      live_data: {
        total_users: usersResult.data.total_count,
        total_courses: coursesResult.data.total_count,
        connection_test: 'successful'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'healthy',
      message: 'Corrected Docebo Chat API is running',
      timestamp: new Date().toISOString(),
      docebo_connection: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
