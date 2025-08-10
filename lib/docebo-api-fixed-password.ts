// lib/docebo-api-fixed-password.ts - Working with Password Authentication
export interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username: string;  // Required for password auth
  password: string;  // Required for password auth
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

export interface DoceboApiListResponse<T = any> {
  items: T[];
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
    
    console.log('🔗 Docebo API Client initialized with Password Authentication');
    console.log('🌐 Domain:', config.domain);
    console.log('🔑 Client ID:', config.clientId.substring(0, 8) + '...');
    console.log('👤 Username:', config.username);
  }

  // FIXED: Use password authentication instead of client credentials
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Getting access token with password authentication...');
    
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',  // CHANGED: Use password instead of client_credentials
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'api',
        username: this.config.username,  // ADDED: Username
        password: this.config.password,  // ADDED: Password
      }),
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
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    console.log('✅ Access token obtained with user permissions');
    
    if (!this.accessToken) {
      throw new Error('Failed to store access token');
    }
    return this.accessToken;
  }

  // FIXED: Remove Content-Type from GET requests
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
    
    // FIXED: Only send minimal headers for GET requests
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    // Only add Content-Type for POST/PUT requests with body
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

    const result = await this.apiRequest<DoceboApiListResponse<DoceboUser>>('/manage/v1/user', 'GET', null, queryParams);
    
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

  async searchUsers(searchText: string, limit: number = 50): Promise<DoceboUser[]> {
    const result = await this.getUsers({
      search_text: searchText,
      page_size: limit
    });
    return result.data;
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

    const result = await this.apiRequest<DoceboApiListResponse<DoceboCourse>>('/learn/v1/courses', 'GET', null, queryParams);
    
    return {
      data: result.data.items || [],
      success: true,
      has_more_data: result.data?.has_more_data,
      total_count: result.data?.total_count,
      current_page: result.data?.current_page,
      total_page_count: result.data?.total_page_count
    };
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
