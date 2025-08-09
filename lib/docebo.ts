import { z } from 'zod';

export class DoceboClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    this.baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    this.clientId = process.env.DOCEBO_CLIENT_ID!;
    this.clientSecret = process.env.DOCEBO_CLIENT_SECRET!;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

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
      throw new Error(`Docebo auth failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
    
    return this.accessToken;
  }

  private async apiCall(endpoint: string, method: string = 'GET', body?: any) {
    const token = await this.getAccessToken();
    
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
      throw new Error(`Docebo API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Enhanced search with better filtering
  async getUsers(params: { 
    limit?: number; 
    search?: string; 
    department?: string;
    status?: 'active' | 'inactive';
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.department) queryParams.append('department', params.department);
    if (params.status) queryParams.append('status', params.status);
    
    return this.apiCall(`/manage/v1/users?${queryParams}`);
  }

  async getCourses(params: { 
    limit?: number; 
    search?: string;
    category?: string;
    status?: 'active' | 'inactive';
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.category) queryParams.append('category', params.category);
    if (params.status) queryParams.append('status', params.status);
    
    return this.apiCall(`/learn/v1/courses?${queryParams}`);
  }

  async getLearningPlans(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/learn/v1/learning-plans?${queryParams}`);
  }

  async getEnrollments(userId: number) {
    return this.apiCall(`/learn/v1/enrollments?user_id=${userId}`);
  }

  async getCourseStats(courseId: number) {
    return this.apiCall(`/analytics/v1/courses/${courseId}/stats`);
  }

  async getUserProgress(userId: number, courseId: number) {
    return this.apiCall(`/learn/v1/enrollments/${userId}/${courseId}/progress`);
  }

  // Write operations (require approval workflow)
  async enrollUser(userId: number, courseId: number, dry_run: boolean = true) {
    if (dry_run) {
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

  async createUser(userData: any, dry_run: boolean = true) {
    if (dry_run) {
      return { 
        message: 'Dry run - user would be created successfully', 
        dry_run: true,
        user_data: userData 
      };
    }
    
    return this.apiCall('/manage/v1/users', 'POST', userData);
  }

  async bulkEnrollUsers(userIds: number[], courseId: number, dry_run: boolean = true) {
    if (dry_run) {
      return {
        message: `Dry run - ${userIds.length} users would be enrolled in course ${courseId}`,
        dry_run: true,
        affected_users: userIds.length,
        course_id: courseId
      };
    }

    // Implement bulk enrollment logic
    const enrollments = userIds.map(userId => ({
      user_id: userId,
      course_id: courseId
    }));

    return this.apiCall('/learn/v1/enrollments/bulk', 'POST', { enrollments });
  }

  // Health check
  async healthCheck() {
    try {
      await this.apiCall('/manage/v1/user/me');
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }
}
