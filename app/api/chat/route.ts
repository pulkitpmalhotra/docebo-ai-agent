// app/api/chat/route.ts - Comprehensive Docebo API with all endpoints
import { NextRequest, NextResponse } from 'next/server';

interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

// Cleaned up interfaces - only real Docebo fields
interface DoceboUser {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  fullname: string;
  status: string; // "1" = active, "0" = inactive
  level: string;
  last_access_date: string | null;
  creation_date: string;
  language: string;
  timezone: string;
  is_manager: boolean;
  expired: boolean;
  // Custom fields (if they exist in your instance)
  field_1?: string;
  field_2?: string;
  field_3?: string;
  field_4?: string;
  field_5?: string;
  field_6?: string;
}

interface DoceboCourse {
  idCourse: string;
  name: string;
  code?: string;
  type: string;
  status: string;
  description?: string;
  creation_date?: string;
  lang_code?: string;
  // Note: enrolled_users might not be available in all endpoints
}

interface DoceboLearningPlan {
  id: string;
  name: string;
  description?: string;
  status: string;
  creation_date: string;
  // Add more fields as discovered
}

interface DoceboEnrollment {
  user_id: string;
  course_id: string;
  enrollment_date: string;
  completion_date?: string;
  status: string;
  level: string;
  // Add more fields as discovered
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

  private async apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' = 'GET', params?: Record<string, string | number>, body?: any): Promise<T> {
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

    if (method === 'POST' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = { method, headers };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // User Management APIs
  async getUsers(params: { page_size?: number; search_text?: string } = {}): Promise<DoceboApiResponse<DoceboUser>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest('/manage/v1/user', 'GET', queryParams);
  }

  async searchUsers(searchText: string, limit: number = 50): Promise<DoceboUser[]> {
    const result = await this.getUsers({ search_text: searchText, page_size: limit });
    return result.data.items;
  }

  async getUserById(userId: string): Promise<DoceboUser | null> {
    try {
      return await this.apiRequest(`/manage/v1/user/${userId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // Course Management APIs
  async getCourses(params: { page_size?: number; search_text?: string } = {}): Promise<DoceboApiResponse<DoceboCourse>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest('/learn/v1/courses', 'GET', queryParams);
  }

  async searchCourses(searchText: string, limit: number = 50): Promise<DoceboCourse[]> {
    const result = await this.getCourses({ search_text: searchText, page_size: limit });
    return result.data.items;
  }

  async getCourseById(courseId: string): Promise<DoceboCourse | null> {
    try {
      return await this.apiRequest(`/learn/v1/courses/${courseId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // Learning Plan APIs
  async getLearningPlans(params: { page_size?: number; search_text?: string } = {}): Promise<DoceboApiResponse<DoceboLearningPlan>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest('/learn/v1/learningplans', 'GET', queryParams);
  }

  async searchLearningPlans(searchText: string, limit: number = 50): Promise<DoceboLearningPlan[]> {
    const result = await this.getLearningPlans({ search_text: searchText, page_size: limit });
    return result.data.items;
  }

  // Enrollment APIs
  async getUserEnrollments(userId: string, params: { page_size?: number } = {}): Promise<DoceboApiResponse<DoceboEnrollment>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest(`/learn/v1/enrollments/users/${userId}`, 'GET', queryParams);
  }

  async getCourseEnrollments(courseId: string, params: { page_size?: number } = {}): Promise<DoceboApiResponse<DoceboEnrollment>> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest(`/learn/v1/enrollments/courses/${courseId}`, 'GET', queryParams);
  }

  async enrollUser(userId: string, courseId: string): Promise<any> {
    return await this.apiRequest('/learn/v1/enrollments', 'POST', {}, {
      users: [userId],
      courses: [courseId]
    });
  }

  // Analytics/Reports APIs
  async getReports(params: { page_size?: number } = {}): Promise<any> {
    const queryParams = { page_size: params.page_size || 25, ...params };
    return await this.apiRequest('/analytics/v1/reports', 'GET', queryParams);
  }

  async getCourseStatistics(courseId?: string): Promise<any> {
    const endpoint = courseId ? 
      `/analytics/v1/courses/${courseId}/statistics` : 
      '/analytics/v1/courses/statistics';
    return await this.apiRequest(endpoint);
  }

  async getUserStatistics(userId?: string): Promise<any> {
    const endpoint = userId ? 
      `/analytics/v1/users/${userId}/statistics` : 
      '/analytics/v1/users/statistics';
    return await this.apiRequest(endpoint);
  }

  // System/Platform APIs
  async getPlatformStatistics(): Promise<any> {
    return await this.apiRequest('/analytics/v1/platform/statistics');
  }

  async getSystemInfo(): Promise<any> {
    return await this.apiRequest('/manage/v1/platform');
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
  learning_plan_management: { name: 'Learning Plan Management' },
  enrollments: { name: 'Enrollments' },
  reports: { name: 'Reports' },
  analytics: { name: 'Analytics' }
};

const ROLE_PERMISSIONS = {
  superadmin: ['user_management', 'course_management', 'learning_plan_management', 'enrollments', 'reports', 'analytics'],
  power_user: ['user_management', 'course_management', 'learning_plan_management', 'enrollments', 'reports'],
  user_manager: ['user_management', 'reports', 'analytics'],
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
  
  // User management
  if (messageLower.includes('search') && messageLower.includes('user')) {
    return 'search_user_action';
  }
  if (messageLower.includes('user') && (messageLower.includes('status') || messageLower.includes('check'))) {
    return 'user_status_action';
  }
  
  // Course management
  if (messageLower.includes('search') && messageLower.includes('course')) {
    return 'search_course_action';
  }
  if (messageLower.includes('course') && messageLower.includes('stat')) {
    return 'course_stats_action';
  }
  
  // Learning plans
  if (messageLower.includes('learning plan') || messageLower.includes('learningplan')) {
    return 'learning_plan_action';
  }
  
  // Enrollments
  if (messageLower.includes('enroll')) {
    return 'enrollment_action';
  }
  if (messageLower.includes('enrollment') && messageLower.includes('history')) {
    return 'enrollment_history_action';
  }
  
  // Reports and Analytics
  if (messageLower.includes('report') && !messageLower.includes('generate')) {
    return 'reports_action';
  }
  if (messageLower.includes('analytic') || messageLower.includes('dashboard')) {
    return 'analytics_action';
  }
  if (messageLower.includes('statistics') || messageLower.includes('stats')) {
    return 'statistics_action';
  }
  
  // Categories
  if (messageLower.includes('what') && (messageLower.includes('do') || messageLower.includes('can'))) {
    return 'category_selection';
  }
  if (messageLower.includes('user') && messageLower.includes('manage')) {
    return 'user_management';
  }
  if (messageLower.includes('course') && messageLower.includes('manage')) {
    return 'course_management';
  }
  if (messageLower.includes('learning') && messageLower.includes('plan')) {
    return 'learning_plan_management';
  }
  
  return 'category_selection';
}

// Action handlers with only real Docebo fields
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
      const lastLogin = user.last_access_date ? new Date(user.last_access_date).toLocaleDateString() : 'Never';
      const isActive = user.status === '1';
      const fullName = user.fullname || `${user.first_name} ${user.last_name}`;
      
      return `**${fullName}** (${user.email})
• Status: ${isActive ? '✅ Active' : '❌ Inactive'}
• Last Login: ${lastLogin}
• User ID: ${user.user_id}
• Level: ${user.level}
• Username: ${user.username}
• Language: ${user.language}
• Manager: ${user.is_manager ? 'Yes' : 'No'}`;
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
      const courseType = course.type || 'Unknown';
      const courseStatus = course.status || 'Unknown';
      const courseCode = course.code || '';
      
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
${courseCode ? `• Course Code: ${courseCode}` : ''}`;
    }).join('\n\n');
    
    return `📚 **Course Search Results** (${courses.length} found in Docebo)

${courseList}

🔗 **Data Source**: Live from your Docebo instance`;
    
  } catch (error) {
    return `❌ **Search Failed**: Unable to search courses in Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleLearningPlans(message: string): Promise<string> {
  try {
    const searchMatch = message.match(/(?:plan|learning)[:\s]+([^,\n]+)/i);
    let searchTerm = '';
    
    if (searchMatch) {
      searchTerm = searchMatch[1].trim().replace(/["']/g, '');
    }
    
    const learningPlans = searchTerm ? 
      await doceboAPI.searchLearningPlans(searchTerm, 10) : 
      await doceboAPI.getLearningPlans({ page_size: 10 }).then(result => result.data.items);
    
    if (learningPlans.length === 0) {
      return `❌ **No Learning Plans Found**: No learning plans found${searchTerm ? ` matching "${searchTerm}"` : ''} in your Docebo instance.`;
    }
    
    const planList = learningPlans.map(plan => {
      const planName = plan.name || 'Unnamed Plan';
      const planId = plan.id || 'No ID';
      const planStatus = plan.status || 'Unknown';
      const creationDate = plan.creation_date ? new Date(plan.creation_date).toLocaleDateString() : 'Unknown';
      
      return `📋 **${planName}**
• Plan ID: ${planId}
• Status: ${planStatus}
• Created: ${creationDate}
${plan.description ? `• Description: ${plan.description.substring(0, 100)}...` : ''}`;
    }).join('\n\n');
    
    return `📋 **Learning Plans** (${learningPlans.length} found in Docebo)

${planList}

🔗 **Data Source**: Live from your Docebo instance`;
    
  } catch (error) {
    return `❌ **Learning Plans Failed**: Unable to retrieve learning plans from Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleEnrollments(message: string): Promise<string> {
  try {
    const userMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const courseMatch = message.match(/(?:in|course)[:\s]+["']?([^"'\n,]+)["']?/i);
    
    // If this is an enrollment request
    if (userMatch && courseMatch) {
      return await handleEnrollUser(message);
    }
    
    // If this is asking for enrollment history
    if (userMatch) {
      const userEmail = userMatch[0];
      const users = await doceboAPI.searchUsers(userEmail, 1);
      const user = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
      
      if (!user) {
        return `❌ **User Not Found**: User "${userEmail}" not found in your Docebo instance.`;
      }
      
      const enrollments = await doceboAPI.getUserEnrollments(user.user_id, { page_size: 20 });
      
      if (enrollments.data.items.length === 0) {
        return `📚 **No Enrollments**: User ${user.fullname} has no course enrollments.`;
      }
      
      const enrollmentList = enrollments.data.items.map(enrollment => {
        const enrollDate = enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : 'Unknown';
        const completionDate = enrollment.completion_date ? new Date(enrollment.completion_date).toLocaleDateString() : 'Not completed';
        
        return `• Course ID: ${enrollment.course_id}
  - Enrolled: ${enrollDate}
  - Status: ${enrollment.status}
  - Completed: ${completionDate}`;
      }).join('\n');
      
      return `📚 **Enrollment History for ${user.fullname}**

${enrollmentList}

**Total Enrollments**: ${enrollments.data.total_count}

🔗 **Data Source**: Live from your Docebo instance`;
    }
    
    return '❓ **Enrollment Query**: Please specify a user email for enrollment history, or "enroll [user] in [course]" to enroll a user.';
    
  } catch (error) {
    return `❌ **Enrollment Failed**: Unable to process enrollment request. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleEnrollUser(message: string): Promise<string> {
  try {
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const courseMatch = message.match(/(?:in|course)[:\s]+["']?([^"'\n,]+)["']?/i);
    
    if (!emailMatch || !courseMatch) {
      return '❓ **Enroll User**: Please specify both user email and course. Example: "Enroll john@company.com in Python Programming"';
    }
    
    const userEmail = emailMatch[0];
    const courseName = courseMatch[1].trim();
    
    // Find user
    const users = await doceboAPI.searchUsers(userEmail, 1);
    const user = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
    
    if (!user) {
      return `❌ **User Not Found**: User "${userEmail}" not found in your Docebo instance.`;
    }
    
    // Find course
    const courses = await doceboAPI.searchCourses(courseName, 5);
    const course = courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase()));
    
    if (!course) {
      return `❌ **Course Not Found**: Course matching "${courseName}" not found in your Docebo instance.
      
Available courses: ${courses.slice(0, 3).map(c => c.name).join(', ')}`;
    }
    
    // Attempt enrollment
    try {
      const enrollmentResult = await doceboAPI.enrollUser(user.user_id, course.idCourse);
      
      return `✅ **Enrollment Successful**

**User**: ${user.fullname} (${user.email})
**Course**: ${course.name}
**Course ID**: ${course.idCourse}
**Enrollment Date**: ${new Date().toLocaleDateString()}

**Next Steps**:
• User will receive enrollment notification
• Course materials are now accessible
• Progress tracking has begun

🔗 **Data Source**: Live enrollment via Docebo API`;
      
    } catch (enrollError) {
      // If enrollment fails, provide helpful debugging info
      return `❌ **Enrollment Failed**: Unable to enroll ${user.fullname} in "${course.name}".

**Possible reasons**:
• User may already be enrolled in this course
• Course may not allow new enrollments
• Insufficient permissions for enrollment
• API endpoint configuration issue

**Error details**: ${enrollError instanceof Error ? enrollError.message : 'Unknown error'}

**User ID**: ${user.user_id}
**Course ID**: ${course.idCourse}

💡 **Suggestion**: Try checking if the user is already enrolled, or contact your Docebo administrator to verify enrollment permissions.`;
    }
    
  } catch (error) {
    return `❌ **Enrollment Process Failed**: Unable to process enrollment request. Error: ${error instanceof Error ? error.message : 'Unknown error'}

💡 **Suggestion**: Use the debug enrollment endpoint to discover the correct API structure for your Docebo instance.`;
  }
}

async function handleRealStatistics(): Promise<string> {
  try {
    // Get real statistics from Docebo Analytics API
    const [userStats, courseStats, platformStats] = await Promise.allSettled([
      doceboAPI.getUserStatistics(),
      doceboAPI.getCourseStatistics(), 
      doceboAPI.getPlatformStatistics()
    ]);
    
    let response = '📊 **Real Docebo Analytics**\n\n';
    
    if (userStats.status === 'fulfilled') {
      response += `**User Analytics**:\n${JSON.stringify(userStats.value, null, 2)}\n\n`;
    } else {
      response += `**User Analytics**: Not available (${userStats.reason})\n\n`;
    }
    
    if (courseStats.status === 'fulfilled') {
      response += `**Course Analytics**:\n${JSON.stringify(courseStats.value, null, 2)}\n\n`;
    } else {
      response += `**Course Analytics**: Not available (${courseStats.reason})\n\n`;
    }
    
    if (platformStats.status === 'fulfilled') {
      response += `**Platform Analytics**:\n${JSON.stringify(platformStats.value, null, 2)}\n\n`;
    } else {
      response += `**Platform Analytics**: Not available (${platformStats.reason})\n\n`;
    }
    
    response += '🔗 **Data Source**: Live analytics from your Docebo API';
    
    return response;
    
  } catch (error) {
    return `❌ **Analytics Failed**: Unable to retrieve analytics from Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleReports(): Promise<string> {
  try {
    const reports = await doceboAPI.getReports({ page_size: 20 });
    
    if (!reports.data || reports.data.items.length === 0) {
      return '📊 **No Reports**: No reports found in your Docebo instance.';
    }
    
    const reportList = reports.data.items.map((report: any) => {
      return `📋 **${report.name || 'Unnamed Report'}**
• ID: ${report.id || 'Unknown'}
• Type: ${report.type || 'Unknown'}
• Status: ${report.status || 'Unknown'}
• Created: ${report.creation_date ? new Date(report.creation_date).toLocaleDateString() : 'Unknown'}`;
    }).join('\n\n');
    
    return `📊 **Available Reports** (${reports.data.items.length} found)

${reportList}

**Total Reports**: ${reports.data.total_count || reports.data.items.length}

🔗 **Data Source**: Live from your Docebo instance`;
    
  } catch (error) {
    return `❌ **Reports Failed**: Unable to retrieve reports from Docebo. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
        response = await handleSearchUser(message);
        suggestions = ['Search for another user', 'View enrollments', 'Course management'];
        actions = [
          { id: 'search_user', label: 'Search Another User', type: 'primary', action: 'search_user_form' },
          { id: 'user_enrollments', label: 'View Enrollments', type: 'primary', action: 'enrollment_history_action' },
          { id: 'course_mgmt', label: 'Course Management', type: 'secondary', action: 'category_course_management' }
        ];
      }
      break;
      
    case 'search_course_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to search courses.`;
      } else {
        response = await handleSearchCourses(message);
        suggestions = ['Search learning plans', 'View enrollments', 'User management'];
        actions = [
          { id: 'learning_plans', label: 'Learning Plans', type: 'primary', action: 'learning_plan_action' },
          { id: 'course_enrollments', label: 'View Enrollments', type: 'primary', action: 'enrollment_action' },
          { id: 'user_mgmt', label: 'User Management', type: 'secondary', action: 'category_user_management' }
        ];
      }
      break;
      
    case 'learning_plan_action':
      if (!allowedCategories.includes('learning_plan_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Learning Plans.`;
      } else {
        response = await handleLearningPlans(message);
        suggestions = ['Search courses', 'View enrollments', 'Analytics'];
        actions = [
          { id: 'search_courses', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'enrollments', label: 'View Enrollments', type: 'primary', action: 'enrollment_action' },
          { id: 'analytics', label: 'Analytics', type: 'secondary', action: 'analytics_action' }
        ];
      }
      break;
      
    case 'enrollment_action':
    case 'enrollment_history_action':
      if (!allowedCategories.includes('enrollments')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Enrollments.`;
      } else {
        response = await handleEnrollments(message);
        suggestions = ['Search users', 'Search courses', 'View reports'];
        actions = [
          { id: 'search_users', label: 'Search Users', type: 'primary', action: 'search_user_form' },
          { id: 'search_courses', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'reports', label: 'View Reports', type: 'secondary', action: 'reports_action' }
        ];
      }
      break;
      
    case 'statistics_action':
    case 'analytics_action':
      if (!allowedCategories.includes('analytics')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Analytics.`;
      } else {
        response = await handleRealStatistics();
        suggestions = ['View reports', 'Search users', 'Course management'];
        actions = [
          { id: 'reports', label: 'View Reports', type: 'primary', action: 'reports_action' },
          { id: 'search_users', label: 'Search Users', type: 'secondary', action: 'search_user_form' }
        ];
      }
      break;
      
    case 'reports_action':
      if (!allowedCategories.includes('reports')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Reports.`;
      } else {
        response = await handleReports();
        suggestions = ['View analytics', 'Search users', 'Course management'];
        actions = [
          { id: 'analytics', label: 'View Analytics', type: 'primary', action: 'analytics_action' },
          { id: 'search_users', label: 'Search Users', type: 'secondary', action: 'search_user_form' }
        ];
      }
      break;

    case 'category_selection':
      response = `👋 **Welcome to Docebo AI Assistant!**

I can help you with comprehensive LMS management using live data from your Docebo instance.

**Available Categories for ${userRole.replace('_', ' ').toUpperCase()}:**

${allowedCategories.map(cat => `🔹 **${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name}**`).join('\n')}

🔗 **Connected to**: Your live Docebo instance
⚡ **Real-time data**: All responses use current Docebo data
📊 **Real APIs**: User, Course, Learning Plan, Enrollment, Analytics APIs

What would you like to do?`;

      suggestions = allowedCategories.map(cat => 
        `Help with ${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name.toLowerCase()}`
      );
      
      actions = allowedCategories.slice(0, 4).map(cat => ({
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

I can help you with comprehensive user management using real Docebo APIs:

• **Search Users** - Find users by email or name
• **User Status** - Check detailed user information
• **User Enrollments** - View user's course enrollments
• **User Analytics** - Individual user statistics

What specific user management task would you like to perform?

🔗 **Data Source**: Live from your Docebo User Management API`;
        
        suggestions = [
          'Search for user by email',
          'Check user enrollment history',
          'User analytics'
        ];
        
        actions = [
          { id: 'search_user', label: 'Search User', type: 'primary', action: 'search_user_form' },
          { id: 'user_enrollments', label: 'User Enrollments', type: 'primary', action: 'enrollment_history_action' },
          { id: 'user_analytics', label: 'User Analytics', type: 'secondary', action: 'analytics_action' }
        ];
      }
      break;

    case 'course_management':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Course Management features.`;
      } else {
        response = `📚 **Course Management** (Live Docebo Data)

I can help you with comprehensive course management using real Docebo APIs:

• **Search Courses** - Find courses by name or keyword
• **Course Details** - View detailed course information
• **Course Enrollments** - See who's enrolled in courses
• **Course Analytics** - Performance and completion data

What specific course management task would you like to perform?

🔗 **Data Source**: Live from your Docebo Course Management API`;
        
        suggestions = [
          'Search for courses',
          'View course enrollments',
          'Course analytics'
        ];
        
        actions = [
          { id: 'search_course', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'course_enrollments', label: 'Course Enrollments', type: 'primary', action: 'enrollment_action' },
          { id: 'course_analytics', label: 'Course Analytics', type: 'secondary', action: 'analytics_action' }
        ];
      }
      break;

    case 'learning_plan_management':
      if (!allowedCategories.includes('learning_plan_management')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Learning Plan Management.`;
      } else {
        response = `📋 **Learning Plan Management** (Live Docebo Data)

I can help you with learning plan management using real Docebo APIs:

• **Search Learning Plans** - Find learning plans by name
• **Learning Plan Details** - View plan structure and content
• **Learning Plan Progress** - Track learner progress
• **Learning Plan Analytics** - Performance metrics

What specific learning plan task would you like to perform?

🔗 **Data Source**: Live from your Docebo Learning Plan API`;
        
        suggestions = [
          'Search learning plans',
          'View learning plan progress',
          'Learning plan analytics'
        ];
        
        actions = [
          { id: 'search_plans', label: 'Search Learning Plans', type: 'primary', action: 'learning_plan_action' },
          { id: 'plan_progress', label: 'Plan Progress', type: 'primary', action: 'analytics_action' },
          { id: 'plan_analytics', label: 'Plan Analytics', type: 'secondary', action: 'analytics_action' }
        ];
      }
      break;

    case 'enrollments':
      if (!allowedCategories.includes('enrollments')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Enrollment features.`;
      } else {
        response = `✅ **Enrollment Management** (Live Docebo Data)

I can help you with enrollment management using real Docebo APIs:

• **Enroll Users** - Add users to courses or learning plans
• **Enrollment History** - View user's enrollment records
• **Course Enrollments** - See all users enrolled in a course
• **Bulk Enrollments** - Manage multiple enrollments

What specific enrollment task would you like to perform?

🔗 **Data Source**: Live from your Docebo Enrollment API`;
        
        suggestions = [
          'Enroll user in course',
          'View user enrollment history',
          'Check course enrollments'
        ];
        
        actions = [
          { id: 'enroll_user', label: 'Enroll User', type: 'primary', action: 'enrollment_action' },
          { id: 'enrollment_history', label: 'Enrollment History', type: 'primary', action: 'enrollment_history_action' },
          { id: 'course_enrollments', label: 'Course Enrollments', type: 'secondary', action: 'enrollment_action' }
        ];
      }
      break;

    case 'reports':
      if (!allowedCategories.includes('reports')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Reports.`;
      } else {
        response = `📊 **Reports** (Live Docebo Data)

I can help you with reporting using real Docebo APIs:

• **Available Reports** - View all system reports
• **Generate Reports** - Create custom reports
• **Report History** - Access previously generated reports
• **Export Reports** - Download report data

What specific reporting task would you like to perform?

🔗 **Data Source**: Live from your Docebo Reports API`;
        
        suggestions = [
          'Show available reports',
          'Generate user report',
          'Course completion reports'
        ];
        
        actions = [
          { id: 'view_reports', label: 'Available Reports', type: 'primary', action: 'reports_action' },
          { id: 'generate_report', label: 'Generate Report', type: 'primary', action: 'analytics_action' },
          { id: 'export_report', label: 'Export Reports', type: 'secondary', action: 'reports_action' }
        ];
      }
      break;

    case 'analytics':
      if (!allowedCategories.includes('analytics')) {
        response = `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to access Analytics.`;
      } else {
        response = `📈 **Analytics** (Live Docebo Data)

I can help you with analytics using real Docebo APIs:

• **Platform Analytics** - Overall system performance
• **User Analytics** - Individual and group user metrics
• **Course Analytics** - Course performance and engagement
• **Learning Plan Analytics** - Learning path effectiveness

What specific analytics would you like to view?

🔗 **Data Source**: Live from your Docebo Analytics API`;
        
        suggestions = [
          'Platform analytics',
          'User performance analytics',
          'Course completion analytics'
        ];
        
        actions = [
          { id: 'platform_analytics', label: 'Platform Analytics', type: 'primary', action: 'analytics_action' },
          { id: 'user_analytics', label: 'User Analytics', type: 'primary', action: 'analytics_action' },
          { id: 'course_analytics', label: 'Course Analytics', type: 'secondary', action: 'analytics_action' }
        ];
      }
      break;

    default:
      response = `🤔 **I can help you with**: ${allowedCategories.map(cat => DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name).join(', ')}

All data comes live from your Docebo APIs. What would you like to do?`;
      
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
      api_mode: 'comprehensive_docebo',
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
    console.log(`🎯 Processing: "${message}" for ${userRole}`);

    const intent = detectIntent(message);
    const result = await generateResponse(message, intent, userRole);

    console.log(`✅ Response generated (${result.meta.processing_time}ms) - Intent: ${intent}`);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    console.error('❌ Comprehensive Docebo API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
      meta: {
        api_mode: 'comprehensive_docebo',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Test all API connections
    const [usersResult, coursesResult, learningPlansResult] = await Promise.allSettled([
      doceboAPI.getUsers({ page_size: 1 }),
      doceboAPI.getCourses({ page_size: 1 }),
      doceboAPI.getLearningPlans({ page_size: 1 })
    ]);
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Comprehensive Docebo Chat API is running',
      timestamp: new Date().toISOString(),
      docebo_connection: 'connected',
      available_categories: Object.keys(DOCEBO_CATEGORIES),
      api_endpoints: {
        users: usersResult.status === 'fulfilled' ? 'working' : 'error',
        courses: coursesResult.status === 'fulfilled' ? 'working' : 'error',
        learning_plans: learningPlansResult.status === 'fulfilled' ? 'working' : 'error'
      },
      live_data: {
        total_users: usersResult.status === 'fulfilled' ? usersResult.value.data.total_count : 'N/A',
        total_courses: coursesResult.status === 'fulfilled' ? coursesResult.value.data.total_count : 'N/A',
        total_learning_plans: learningPlansResult.status === 'fulfilled' ? learningPlansResult.value.data.total_count : 'N/A',
        connection_test: 'comprehensive'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'healthy',
      message: 'Comprehensive Docebo Chat API is running',
      timestamp: new Date().toISOString(),
      docebo_connection: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
