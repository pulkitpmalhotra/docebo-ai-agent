// lib/docebo.ts - Production version with real API calls
export class DoceboClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    // Check for required environment variables
    if (!process.env.DOCEBO_DOMAIN) {
      throw new Error('DOCEBO_DOMAIN environment variable is required');
    }
    if (!process.env.DOCEBO_CLIENT_ID) {
      throw new Error('DOCEBO_CLIENT_ID environment variable is required');
    }
    if (!process.env.DOCEBO_CLIENT_SECRET) {
      throw new Error('DOCEBO_CLIENT_SECRET environment variable is required');
    }
    
    this.baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    this.clientId = process.env.DOCEBO_CLIENT_ID;
    this.clientSecret = process.env.DOCEBO_CLIENT_SECRET;
    
    console.log('🔗 PRODUCTION Docebo Client initialized');
    console.log('🌐 Domain:', process.env.DOCEBO_DOMAIN);
    console.log('🔑 Client ID:', this.clientId.substring(0, 8) + '...');
    console.log('🚫 Mock mode: DISABLED');
  }
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Getting new access token from Docebo...');
    
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'api',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo auth failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Invalid access token received from Docebo API');
    }
    
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    
    console.log('✅ Access token obtained successfully');
    return data.access_token;
  }

  private async apiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    console.log(`📡 API Call: ${method} ${endpoint}`);
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText, errorText);
      throw new Error(`Docebo API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ API Success: ${endpoint}`);
    return result;
  }

  // User Management
  async getUsers(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/manage/v1/users?${queryParams}`);
  }

  async getUserById(userId: number) {
    return this.apiCall(`/manage/v1/users/${userId}`);
  }

  async getUserByEmail(email: string) {
    const users = await this.getUsers({ search: email });
    return users.data?.find((user: any) => user.email === email);
  }

  // Course Management
  async getCourses(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/learn/v1/courses?${queryParams}`);
  }

  async getCourseById(courseId: number) {
    return this.apiCall(`/learn/v1/courses/${courseId}`);
  }

  async searchCoursesByTitle(title: string) {
    return this.getCourses({ search: title });
  }

  // Learning Plans
  async getLearningPlans(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/learn/v1/learning-plans?${queryParams}`);
  }

  async getLearningPlanById(planId: number) {
    return this.apiCall(`/learn/v1/learning-plans/${planId}`);
  }

  // Enrollments
  async getEnrollments(userId: number) {
    return this.apiCall(`/learn/v1/enrollments?user_id=${userId}`);
  }

  async enrollUser(userId: number, courseId: number, dry_run: boolean = false) {
    if (dry_run) {
      console.log(`🧪 DRY RUN: Would enroll user ${userId} in course ${courseId}`);
      return { 
        message: 'Dry run - enrollment would be successful', 
        dry_run: true,
        user_id: userId,
        course_id: courseId 
      };
    }
    
    return this.apiCall('/learn/v1/enrollments', 'POST', {
      user_id: userId,
      course_id: courseId,
    });
  }

  async enrollUserInLearningPlan(userId: number, planId: number, dry_run: boolean = false) {
    if (dry_run) {
      console.log(`🧪 DRY RUN: Would enroll user ${userId} in learning plan ${planId}`);
      return { 
        message: 'Dry run - learning plan enrollment would be successful', 
        dry_run: true,
        user_id: userId,
        plan_id: planId 
      };
    }
    
    return this.apiCall(`/learn/v1/learning-plans/${planId}/enrollments`, 'POST', {
      user_id: userId,
    });
  }

  // Groups
  async getGroups(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/manage/v1/groups?${queryParams}`);
  }

  async getGroupById(groupId: number) {
    return this.apiCall(`/manage/v1/groups/${groupId}`);
  }

  async getGroupMembers(groupId: number) {
    return this.apiCall(`/manage/v1/groups/${groupId}/members`);
  }

  // Sessions (ILT)
  async getSessions(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/learn/v1/sessions?${queryParams}`);
  }

  async enrollUserInSession(userId: number, sessionId: number, dry_run: boolean = false) {
    if (dry_run) {
      console.log(`🧪 DRY RUN: Would enroll user ${userId} in session ${sessionId}`);
      return { 
        message: 'Dry run - session enrollment would be successful', 
        dry_run: true,
        user_id: userId,
        session_id: sessionId 
      };
    }
    
    return this.apiCall(`/learn/v1/sessions/${sessionId}/enrollments`, 'POST', {
      user_id: userId,
    });
  }

  // Analytics and Reports
  async getCourseCompletions(courseId: number) {
    return this.apiCall(`/analytics/v1/courses/${courseId}/completions`);
  }

  async getLearningPlanCompletions(planId: number) {
    return this.apiCall(`/analytics/v1/learning-plans/${planId}/completions`);
  }

  async getUserProgress(userId: number, courseId: number) {
    return this.apiCall(`/learn/v1/enrollments/${userId}/${courseId}/progress`);
  }

  // Course Settings
  async updateCourseSettings(courseId: number, settings: any, dry_run: boolean = false) {
    if (dry_run) {
      console.log(`🧪 DRY RUN: Would update course ${courseId} settings:`, settings);
      return { 
        message: 'Dry run - course settings would be updated', 
        dry_run: true,
        course_id: courseId,
        settings 
      };
    }
    
    return this.apiCall(`/learn/v1/courses/${courseId}`, 'PUT', settings);
  }

  // Learning Plan Settings
  async updateLearningPlanSettings(planId: number, settings: any, dry_run: boolean = false) {
    if (dry_run) {
      console.log(`🧪 DRY RUN: Would update learning plan ${planId} settings:`, settings);
      return { 
        message: 'Dry run - learning plan settings would be updated', 
        dry_run: true,
        plan_id: planId,
        settings 
      };
    }
    
    return this.apiCall(`/learn/v1/learning-plans/${planId}`, 'PUT', settings);
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.apiCall('/manage/v1/users?limit=1');
      return { 
        status: 'healthy', 
        timestamp: new Date(),
        mode: 'production',
        api_version: 'v1',
        users_available: result.data?.length || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        status: 'unhealthy', 
        error: errorMessage, 
        timestamp: new Date(),
        mode: 'production'
      };
    }
  }
}
