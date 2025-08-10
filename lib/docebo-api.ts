// lib/docebo-api.ts - Official Docebo API Implementation with Fixed Types
// Based on official Docebo documentation and best practices

export interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  has_more_data?: boolean;
  total_count?: number;
  current_page?: number;
  total_page_count?: number;
}

export interface DoceboUser {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  fullname: string;
  status: string;
  level: string;
  last_access_date: string;
  creation_date: string;
  last_update: string;
  field_1?: string;
  field_2?: string;
  field_3?: string;
  field_4?: string;
  field_5?: string;
  field_6?: string;
  language: string;
  timezone: string;
  is_manager: boolean;
  expired: boolean;
}

export interface DoceboCourse {
  course_id: string;
  course_name: string;
  course_code?: string;
  course_type: string;
  status: string;
  description?: string;
  enrolled_users?: number;
  course_creation_date?: string;
  course_last_edit?: string;
}

export interface DoceboEnrollment {
  user_id: string;
  course_id: string;
  enrollment_date: string;
  completion_date?: string;
  enrollment_status: string;
  completion_status: string;
  progress_percentage: number;
  first_access?: string;
  last_access?: string;
}

export class DoceboAPI {
  private config: DoceboConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: DoceboConfig) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
    
    console.log('🔗 Docebo API Client initialized');
    console.log('🌐 Domain:', config.domain);
    console.log('🔑 Client ID:', config.clientId.substring(0, 8) + '...');
  }

  // Authentication Methods
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Getting new access token from Docebo...');
    
    // Use client credentials flow by default
    const authData = {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'api'
    };

    // If username/password provided, use password credentials flow
    if (this.config.username && this.config.password) {
      Object.assign(authData, {
        grant_type: 'password',
        username: this.config.username,
        password: this.config.password
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(authData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      if (!tokenData.access_token || typeof tokenData.access_token !== 'string') {
        throw new Error('No valid access token received from Docebo');
      }
      
      this.accessToken = tokenData.access_token;
      // Tokens expire in 3600 seconds (1 hour) according to docs
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
      
      console.log('✅ Access token obtained successfully');
      
      // TypeScript-safe return - we know this.accessToken is now a string
      if (!this.accessToken) {
        throw new Error('Failed to store access token');
      }
      return this.accessToken;
      
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Core API Request Method
  private async apiRequest<T = any>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    params?: Record<string, string | number>
  ): Promise<ApiResponse<T>> {
    
    const token = await this.getAccessToken();
    
    // Build URL with query parameters
    let url = `${this.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value.toString());
      });
      url += `?${queryParams}`;
    }
    
    console.log(`📡 API Request: ${method} ${endpoint}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    // Add Content-Type for POST/PUT requests with body
    if ((method === 'POST' || method === 'PUT') && body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        console.error(`❌ Response: ${responseText}`);
        throw new Error(`Docebo API error: ${response.status} ${response.statusText} - ${responseText}`);
      }

      // Parse JSON response
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', responseText);
        throw new Error('Invalid JSON response from Docebo API');
      }

      console.log(`✅ API Success: ${method} ${endpoint}`);
      return result;

    } catch (error) {
      console.error(`❌ API Request failed:`, error);
      throw error;
    }
  }

  // User Management Methods
  async getUsers(params: {
    page?: number;
    page_size?: number;
    search_text?: string;
    sort_attr?: string;
    sort_dir?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<DoceboUser[]>> {
    
    const queryParams: Record<string, string | number> = {
      page_size: params.page_size || 25,
      ...params
    };

    const result = await this.apiRequest<{items: DoceboUser[]}>('/manage/v1/user', 'GET', null, queryParams);
    
    return {
      data: result.data.items || [],
      success: true,
      has_more_data: result.data?.has_more_data,
      total_count: result.data?.total_count,
      current_page: result.data?.current_page,
      total_page_count: result.data?.total_page_count
    };
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

  async createUser(userData: Partial<DoceboUser> & {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  }): Promise<DoceboUser> {
    const result = await this.apiRequest<DoceboUser>('/manage/v1/user', 'POST', userData);
    return result.data;
  }

  async updateUser(userId: string, userData: Partial<DoceboUser>): Promise<DoceboUser> {
    const result = await this.apiRequest<DoceboUser>(`/manage/v1/user/${userId}`, 'PUT', userData);
    return result.data;
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.apiRequest(`/manage/v1/user/${userId}`, 'DELETE');
    return true;
  }

  // Course Management Methods
  async getCourses(params: {
    page?: number;
    page_size?: number;
    search_text?: string;
    sort_attr?: string;
    sort_dir?: 'asc' | 'desc';
    course_type?: string;
  } = {}): Promise<ApiResponse<DoceboCourse[]>> {
    
    const queryParams: Record<string, string | number> = {
      page_size: params.page_size || 25,
      ...params
    };

    const result = await this.apiRequest<{items: DoceboCourse[]}>('/learn/v1/courses', 'GET', null, queryParams);
    
    return {
      data: result.data.items || [],
      success: true,
      has_more_data: result.data?.has_more_data,
      total_count: result.data?.total_count,
      current_page: result.data?.current_page,
      total_page_count: result.data?.total_page_count
    };
  }

  async getCourseById(courseId: string): Promise<DoceboCourse | null> {
    try {
      const result = await this.apiRequest<DoceboCourse>(`/learn/v1/courses/${courseId}`);
      return result.data || null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createCourse(courseData: Partial<DoceboCourse> & {
    course_name: string;
    course_type: string;
  }): Promise<DoceboCourse> {
    const result = await this.apiRequest<DoceboCourse>('/learn/v1/courses', 'POST', courseData);
    return result.data;
  }

  async updateCourse(courseId: string, courseData: Partial<DoceboCourse>): Promise<DoceboCourse> {
    const result = await this.apiRequest<DoceboCourse>(`/learn/v1/courses/${courseId}`, 'PUT', courseData);
    return result.data;
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    await this.apiRequest(`/learn/v1/courses/${courseId}`, 'DELETE');
    return true;
  }

  // Enrollment Management Methods
  async getEnrollments(params: {
    user_id?: string;
    course_id?: string;
    page?: number;
    page_size?: number;
    enrollment_status?: string;
  } = {}): Promise<ApiResponse<DoceboEnrollment[]>> {
    
    const queryParams: Record<string, string | number> = {
      page_size: params.page_size || 25,
      ...params
    };

    const result = await this.apiRequest<{items: DoceboEnrollment[]}>('/learn/v1/enrollments', 'GET', null, queryParams);
    
    return {
      data: result.data.items || [],
      success: true,
      has_more_data: result.data?.has_more_data,
      total_count: result.data?.total_count
    };
  }

  async enrollUser(userId: string, courseId: string, enrollmentData?: {
    enrollment_date?: string;
    completion_date?: string;
    enrollment_status?: string;
  }): Promise<DoceboEnrollment> {
    const body = {
      user_id: userId,
      course_id: courseId,
      ...enrollmentData
    };

    const result = await this.apiRequest<DoceboEnrollment>('/learn/v1/enrollments', 'POST', body);
    return result.data;
  }

  async updateEnrollment(userId: string, courseId: string, enrollmentData: {
    completion_date?: string;
    enrollment_status?: string;
    completion_status?: string;
  }): Promise<DoceboEnrollment> {
    const result = await this.apiRequest<DoceboEnrollment>(
      `/learn/v1/enrollments/${userId}/${courseId}`, 
      'PUT', 
      enrollmentData
    );
    return result.data;
  }

  async unenrollUser(userId: string, courseId: string): Promise<boolean> {
    await this.apiRequest(`/learn/v1/enrollments/${userId}/${courseId}`, 'DELETE');
    return true;
  }

  // Bulk Operations
  async bulkEnrollUsers(enrollments: {user_id: string, course_id: string}[]): Promise<any> {
    // Docebo has limits on bulk operations - split into batches of 300
    const batchSize = 300;
    const results = [];

    for (let i = 0; i < enrollments.length; i += batchSize) {
      const batch = enrollments.slice(i, i + batchSize);
      const result = await this.apiRequest('/learn/v1/enrollments/batch', 'POST', batch);
      results.push(result);
    }

    return results;
  }

  async bulkCreateUsers(users: Partial<DoceboUser>[]): Promise<any> {
    // Split into batches for bulk user creation
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const result = await this.apiRequest('/manage/v1/user/batch', 'POST', batch);
      results.push(result);
    }

    return results;
  }

  // Search Methods
  async searchUsers(searchText: string, limit: number = 50): Promise<DoceboUser[]> {
    const result = await this.getUsers({
      search_text: searchText,
      page_size: limit
    });
    return result.data;
  }

  async searchCourses(searchText: string, limit: number = 50): Promise<DoceboCourse[]> {
    const result = await this.getCourses({
      search_text: searchText,
      page_size: limit
    });
    return result.data;
  }

  // Health Check
  async healthCheck(): Promise<{status: string, timestamp: Date, api_version?: string}> {
    try {
      const result = await this.getUsers({ page_size: 1 });
      return {
        status: 'healthy',
        timestamp: new Date(),
        api_version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date()
      };
    }
  }
}
