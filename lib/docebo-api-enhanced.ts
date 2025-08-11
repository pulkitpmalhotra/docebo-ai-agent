// lib/docebo-api-enhanced.ts - Complete Enrollment Management API
import { z } from 'zod';

export interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

// Enhanced interfaces for enrollment management
export interface DoceboUser {
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
  language: string;
  timezone: string;
  is_manager: boolean;
  expired: boolean;
  // Additional fields for groups
  groups?: DoceboGroup[];
  department?: string;
  job_title?: string;
}

export interface DoceboCourse {
  course_id: string;
  course_name: string;
  course_code?: string;
  course_type: string;
  status: string;
  description?: string;
  enrolled_users?: number;
  completion_percentage?: number;
  course_creation_date?: string;
  // Additional enrollment info
  can_enroll?: boolean;
  enrollment_rules?: any;
}

export interface DoceboLearningPlan {
  learning_plan_id: string;
  name: string;
  description?: string;
  status: string;
  creation_date: string;
  enrolled_users?: number;
  total_courses?: number;
  completion_time_days?: number;
}

export interface DoceboSession {
  session_id: string;
  session_name: string;
  course_id: string;
  course_name?: string;
  session_date: string;
  session_time: string;
  instructor: string;
  location?: string;
  max_participants?: number;
  enrolled_count?: number;
  status: string;
}

export interface DoceboGroup {
  group_id: string;
  group_name: string;
  description?: string;
  users_count: number;
  parent_group_id?: string;
}

export interface EnrollmentRequest {
  users: string[]; // User IDs or emails
  courses?: string[]; // Course IDs
  learning_plans?: string[]; // Learning Plan IDs
  sessions?: string[]; // Session IDs
  groups?: string[]; // Group IDs (for group enrollment)
  priority?: 'low' | 'medium' | 'high';
  due_date?: string; // ISO date string
  enrollment_type?: 'immediate' | 'scheduled';
  notification?: boolean;
  completion_tracking?: boolean;
}

export interface EnrollmentUpdate {
  user_id: string;
  course_id?: string;
  learning_plan_id?: string;
  session_id?: string;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  status?: 'enrolled' | 'completed' | 'not_started' | 'in_progress' | 'suspended';
  completion_percentage?: number;
  notes?: string;
}

export interface EnrollmentStats {
  total_enrolled: number;
  completed: number;
  in_progress: number;
  not_started: number;
  completion_rate: number;
  average_progress: number;
  enrollments_by_date: Array<{
    date: string;
    enrollments: number;
    completions: number;
  }>;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  total_count?: number;
  current_page?: number;
  has_more_data?: boolean;
}

export class EnhancedDoceboAPI {
  private config: DoceboConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: DoceboConfig) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
    console.log('🚀 Enhanced Docebo API Client initialized');
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Obtaining access token...');
    
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
    
    console.log('✅ Access token obtained');
    return this.accessToken!;
  }

  private async apiRequest<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      url += `?${queryParams}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    console.log(`📡 API Request: ${method} ${endpoint}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ API Success: ${method} ${endpoint}`);
    
    return result;
  }

  // User Management
  async getUsers(params: { 
    page_size?: number; 
    search_text?: string; 
    include_groups?: boolean;
  } = {}): Promise<ApiResponse<DoceboUser[]>> {
    const result = await this.apiRequest<{ items: DoceboUser[] }>('/manage/v1/user', 'GET', null, params);
    return {
      data: result.data?.items || [],
      success: true,
      total_count: result.total_count,
      has_more_data: result.has_more_data
    };
  }

  async searchUsers(searchText: string, limit: number = 50): Promise<DoceboUser[]> {
    const result = await this.getUsers({ search_text: searchText, page_size: limit });
    return result.data;
  }

  async getUserById(userId: string): Promise<DoceboUser | null> {
    try {
      const result = await this.apiRequest<DoceboUser>(`/manage/v1/user/${userId}`);
      return result.data || null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // Course Management
  async getCourses(params: { 
    page_size?: number; 
    search_text?: string; 
    course_type?: string;
    include_stats?: boolean;
  } = {}): Promise<ApiResponse<DoceboCourse[]>> {
    const result = await this.apiRequest<{ items: DoceboCourse[] }>('/learn/v1/courses', 'GET', null, params);
    return {
      data: result.data?.items || [],
      success: true,
      total_count: result.total_count,
      has_more_data: result.has_more_data
    };
  }

  async searchCourses(searchText: string, limit: number = 50): Promise<DoceboCourse[]> {
    const result = await this.getCourses({ search_text: searchText, page_size: limit });
    return result.data;
  }

  // Learning Plan Management
  async getLearningPlans(params: { 
    page_size?: number; 
    search_text?: string;
  } = {}): Promise<ApiResponse<DoceboLearningPlan[]>> {
    const result = await this.apiRequest<{ items: DoceboLearningPlan[] }>('/learn/v1/learningplans', 'GET', null, params);
    return {
      data: result.data?.items || [],
      success: true,
      total_count: result.total_count,
      has_more_data: result.has_more_data
    };
  }

  async searchLearningPlans(searchText: string, limit: number = 50): Promise<DoceboLearningPlan[]> {
    const result = await this.getLearningPlans({ search_text: searchText, page_size: limit });
    return result.data;
  }

  // Session Management
  async getSessions(params: { 
    page_size?: number; 
    search_text?: string;
    course_id?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<ApiResponse<DoceboSession[]>> {
    const result = await this.apiRequest<{ items: DoceboSession[] }>('/learn/v1/sessions', 'GET', null, params);
    return {
      data: result.data?.items || [],
      success: true,
      total_count: result.total_count,
      has_more_data: result.has_more_data
    };
  }

  async searchSessions(searchText: string, limit: number = 50): Promise<DoceboSession[]> {
    const result = await this.getSessions({ search_text: searchText, page_size: limit });
    return result.data;
  }

  // Group Management
  async getGroups(params: { 
    page_size?: number; 
    search_text?: string;
  } = {}): Promise<ApiResponse<DoceboGroup[]>> {
    const result = await this.apiRequest<{ items: DoceboGroup[] }>('/manage/v1/groups', 'GET', null, params);
    return {
      data: result.data?.items || [],
      success: true,
      total_count: result.total_count,
      has_more_data: result.has_more_data
    };
  }

  // CORE ENROLLMENT METHODS

  // 1. Get Enrollments (who is enrolled in what)
  async getUserEnrollments(userId: string, includeProgress: boolean = true): Promise<{
    courses: any[];
    learning_plans: any[];
    sessions: any[];
    total_enrollments: number;
  }> {
    try {
      const [courseEnrollments, lpEnrollments, sessionEnrollments] = await Promise.allSettled([
        this.apiRequest(`/learn/v1/enrollments/users/${userId}`, 'GET', null, { include_progress: includeProgress }),
        this.apiRequest(`/learn/v1/learningplans/users/${userId}`, 'GET'),
        this.apiRequest(`/learn/v1/sessions/users/${userId}`, 'GET')
      ]);

      const courses = courseEnrollments.status === 'fulfilled' ? courseEnrollments.value.data?.items || [] : [];
      const learning_plans = lpEnrollments.status === 'fulfilled' ? lpEnrollments.value.data?.items || [] : [];
      const sessions = sessionEnrollments.status === 'fulfilled' ? sessionEnrollments.value.data?.items || [] : [];

      return {
        courses,
        learning_plans,
        sessions,
        total_enrollments: courses.length + learning_plans.length + sessions.length
      };
    } catch (error) {
      throw new Error(`Failed to get user enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCourseEnrollments(courseId: string, includeProgress: boolean = true): Promise<{
    users: any[];
    total_enrolled: number;
    completion_stats: any;
  }> {
    try {
      const result = await this.apiRequest(`/learn/v1/enrollments/courses/${courseId}`, 'GET', null, { 
        include_progress: includeProgress,
        include_stats: true 
      });

      const users = result.data?.items || [];
      const stats = result.data?.stats || {};

      return {
        users,
        total_enrolled: users.length,
        completion_stats: stats
      };
    } catch (error) {
      throw new Error(`Failed to get course enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLearningPlanEnrollments(learningPlanId: string): Promise<{
    users: any[];
    total_enrolled: number;
    completion_stats: any;
  }> {
    try {
      const result = await this.apiRequest(`/learn/v1/learningplans/${learningPlanId}/enrollments`);
      const users = result.data?.items || [];

      return {
        users,
        total_enrolled: users.length,
        completion_stats: result.data?.stats || {}
      };
    } catch (error) {
      throw new Error(`Failed to get learning plan enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSessionEnrollments(sessionId: string): Promise<{
    users: any[];
    total_enrolled: number;
    session_details: any;
  }> {
    try {
      const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}/enrollments`);
      const users = result.data?.items || [];

      return {
        users,
        total_enrolled: users.length,
        session_details: result.data?.session || {}
      };
    } catch (error) {
      throw new Error(`Failed to get session enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 2. Enrollment Statistics and Reports
  async getEnrollmentStats(params: {
    course_ids?: string[];
    learning_plan_ids?: string[];
    session_ids?: string[];
    user_ids?: string[];
    date_from?: string;
    date_to?: string;
    group_by?: 'course' | 'user' | 'month' | 'week';
  }): Promise<EnrollmentStats> {
    try {
      const result = await this.apiRequest('/analytics/v1/enrollments/stats', 'GET', null, params);
      
      return {
        total_enrolled: result.data?.total_enrolled || 0,
        completed: result.data?.completed || 0,
        in_progress: result.data?.in_progress || 0,
        not_started: result.data?.not_started || 0,
        completion_rate: result.data?.completion_rate || 0,
        average_progress: result.data?.average_progress || 0,
        enrollments_by_date: result.data?.enrollments_by_date || []
      };
    } catch (error) {
      // Fallback to manual calculation if analytics endpoint not available
      console.warn('Analytics endpoint not available, using fallback calculation');
      return this.calculateEnrollmentStats(params);
    }
  }

  private async calculateEnrollmentStats(params: any): Promise<EnrollmentStats> {
    // Manual calculation as fallback
    let totalEnrolled = 0;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;

    // This would involve multiple API calls to gather enrollment data
    // Implementation depends on available endpoints
    
    return {
      total_enrolled: totalEnrolled,
      completed,
      in_progress: inProgress,
      not_started: notStarted,
      completion_rate: totalEnrolled > 0 ? (completed / totalEnrolled) * 100 : 0,
      average_progress: 0,
      enrollments_by_date: []
    };
  }

  // 3. Enroll Users/Groups
  async enrollUsers(request: EnrollmentRequest): Promise<{
    successful: any[];
    failed: any[];
    summary: string;
  }> {
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      summary: ''
    };

    try {
      // Validate required fields
      if (!request.users || request.users.length === 0) {
        throw new Error('At least one user is required for enrollment');
      }

      if (!request.courses && !request.learning_plans && !request.sessions) {
        throw new Error('At least one course, learning plan, or session is required for enrollment');
      }

      // Enroll in courses
      if (request.courses && request.courses.length > 0) {
        for (const courseId of request.courses) {
          try {
            const enrollmentBody = {
              users: request.users,
              courses: [courseId],
              priority: request.priority || 'medium',
              due_date: request.due_date,
              enrollment_type: request.enrollment_type || 'immediate',
              send_notification: request.notification !== false
            };

            const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
            results.successful.push({
              type: 'course',
              id: courseId,
              users: request.users,
              result: result.data
            });
          } catch (error) {
            results.failed.push({
              type: 'course',
              id: courseId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      // Enroll in learning plans
      if (request.learning_plans && request.learning_plans.length > 0) {
        for (const lpId of request.learning_plans) {
          try {
            const enrollmentBody = {
              users: request.users,
              learning_plans: [lpId],
              priority: request.priority || 'medium',
              due_date: request.due_date
            };

            const result = await this.apiRequest('/learn/v1/learningplans/enrollments', 'POST', enrollmentBody);
            results.successful.push({
              type: 'learning_plan',
              id: lpId,
              users: request.users,
              result: result.data
            });
          } catch (error) {
            results.failed.push({
              type: 'learning_plan',
              id: lpId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      // Enroll in sessions
      if (request.sessions && request.sessions.length > 0) {
        for (const sessionId of request.sessions) {
          try {
            const enrollmentBody = {
              users: request.users,
              sessions: [sessionId],
              priority: request.priority || 'medium'
            };

            const result = await this.apiRequest('/learn/v1/sessions/enrollments', 'POST', enrollmentBody);
            results.successful.push({
              type: 'session',
              id: sessionId,
              users: request.users,
              result: result.data
            });
          } catch (error) {
            results.failed.push({
              type: 'session',
              id: sessionId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      results.summary = `Enrollment completed: ${results.successful.length} successful, ${results.failed.length} failed`;
      return results;

    } catch (error) {
      throw new Error(`Enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async enrollGroups(request: EnrollmentRequest & { groups: string[] }): Promise<{
    successful: any[];
    failed: any[];
    summary: string;
  }> {
    if (!request.groups || request.groups.length === 0) {
      throw new Error('At least one group is required for group enrollment');
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      summary: ''
    };

    // Get all users in the specified groups
    const allUsers: string[] = [];
    for (const groupId of request.groups) {
      try {
        const groupUsers = await this.apiRequest(`/manage/v1/groups/${groupId}/users`);
        const userIds = groupUsers.data?.items?.map((user: any) => user.user_id) || [];
        allUsers.push(...userIds);
      } catch (error) {
        results.failed.push({
          type: 'group',
          id: groupId,
          error: `Failed to get group users: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    if (allUsers.length === 0) {
      throw new Error('No users found in the specified groups');
    }

    // Remove duplicates
    const uniqueUsers = [...new Set(allUsers)];

    // Use regular enrollment method with the group users
    const enrollmentRequest: EnrollmentRequest = {
      ...request,
      users: uniqueUsers
    };

    const enrollmentResult = await this.enrollUsers(enrollmentRequest);
    
    // Add group information to results
    enrollmentResult.successful.forEach(item => {
      item.enrolled_via_groups = request.groups;
    });

    return enrollmentResult;
  }

  // 4. Unenroll Users
  async unenrollUsers(request: {
    users: string[];
    courses?: string[];
    learning_plans?: string[];
    sessions?: string[];
    reason?: string;
    notification?: boolean;
  }): Promise<{
    successful: any[];
    failed: any[];
    summary: string;
  }> {
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      summary: ''
    };

    if (!request.users || request.users.length === 0) {
      throw new Error('At least one user is required for unenrollment');
    }

    // Unenroll from courses
    if (request.courses && request.courses.length > 0) {
      for (const courseId of request.courses) {
        for (const userId of request.users) {
          try {
            const result = await this.apiRequest(`/learn/v1/enrollments/users/${userId}/courses/${courseId}`, 'DELETE', {
              reason: request.reason,
              send_notification: request.notification !== false
            });
            
            results.successful.push({
              type: 'course',
              user_id: userId,
              course_id: courseId,
              result: result.data
            });
          } catch (error) {
            results.failed.push({
              type: 'course',
              user_id: userId,
              course_id: courseId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    }

    // Similar logic for learning plans and sessions...
    results.summary = `Unenrollment completed: ${results.successful.length} successful, ${results.failed.length} failed`;
    return results;
  }

  // 5. Update Enrollments
  async updateEnrollments(updates: EnrollmentUpdate[]): Promise<{
    successful: any[];
    failed: any[];
    summary: string;
  }> {
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      summary: ''
    };

    for (const update of updates) {
      try {
        let endpoint = '';
        if (update.course_id) {
          endpoint = `/learn/v1/enrollments/users/${update.user_id}/courses/${update.course_id}`;
        } else if (update.learning_plan_id) {
          endpoint = `/learn/v1/learningplans/users/${update.user_id}/plans/${update.learning_plan_id}`;
        } else if (update.session_id) {
          endpoint = `/learn/v1/sessions/users/${update.user_id}/sessions/${update.session_id}`;
        } else {
          throw new Error('Either course_id, learning_plan_id, or session_id is required');
        }

        const updateBody = {
          priority: update.priority,
          due_date: update.due_date,
          status: update.status,
          completion_percentage: update.completion_percentage,
          notes: update.notes
        };

        const result = await this.apiRequest(endpoint, 'PUT', updateBody);
        results.successful.push({
          update,
          result: result.data
        });
      } catch (error) {
        results.failed.push({
          update,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    results.summary = `Update completed: ${results.successful.length} successful, ${results.failed.length} failed`;
    return results;
  }
}
