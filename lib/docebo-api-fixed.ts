// lib/docebo-api-fixed.ts - Production-ready Docebo API Client
import { config } from './config/environment';

export interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
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
  last_access_date: string | null;
  creation_date: string;
  last_update: string;
  language: string;
  timezone: string;
  is_manager: boolean;
  expired: boolean;
}

export interface DoceboCourse {
  course_id?: string;
  id_course?: string;
  idCourse?: string;
  id?: string;
  course_name?: string;
  name?: string;
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

export interface EnrollmentResult {
  success: boolean;
  message: string;
  details?: any;
}

export class DoceboAPI {
  private config: DoceboConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(doceboConfig?: DoceboConfig) {
    this.config = doceboConfig || config.docebo;
    this.baseUrl = `https://${this.config.domain}`;
    
    console.log('🔗 Docebo API Client initialized');
    console.log('🌐 Domain:', this.config.domain);
    console.log('👤 Username:', this.config.username);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Getting access token...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
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
          throw new Error(`OAuth failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const tokenData = await response.json();
        
        if (!tokenData.access_token || typeof tokenData.access_token !== 'string') {
          throw new Error('No valid access token received from Docebo');
        }
        
        this.accessToken = tokenData.access_token;
        this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
        
        console.log('✅ Access token obtained');
        return this.accessToken;

      } catch (error) {
        console.error(`❌ Token attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to obtain access token after ${this.maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    throw new Error('Failed to obtain access token');
  }

  private async apiRequest<T = any>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    params?: Record<string, string | number | boolean>
  ): Promise<ApiResponse<T>> {
    
    const token = await this.getAccessToken();
    
    // Build URL with query parameters
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
    
    console.log(`📡 API Request: ${method} ${endpoint}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    // Only add Content-Type for POST/PUT requests with body
    if ((method === 'POST' || method === 'PUT') && body) {
      headers['Content-Type'] = 'application/json';
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          // If 401, clear token and retry once
          if (response.status === 401 && attempt === 1) {
            console.log('🔄 Token expired, retrying...');
            this.accessToken = undefined;
            this.tokenExpiry = undefined;
            continue;
          }
          
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
        console.error(`❌ API attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    throw new Error('API request failed after retries');
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
      data: result.data?.items || [],
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
      data: result.data?.items || [],
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

  // Enrollment Methods
  async getUserEnrollments(userId: string): Promise<DoceboEnrollment[]> {
    try {
      const result = await this.apiRequest<DoceboApiListResponse<DoceboEnrollment>>(`/learn/v1/enrollments/users/${userId}`);
      return result.data?.items || [];
    } catch (error) {
      console.error('Get user enrollments failed:', error);
      return [];
    }
  }

  async getCourseEnrollments(courseId: string): Promise<DoceboEnrollment[]> {
    try {
      const result = await this.apiRequest<DoceboApiListResponse<DoceboEnrollment>>(`/learn/v1/enrollments/courses/${courseId}`);
      return result.data?.items || [];
    } catch (error) {
      console.error('Get course enrollments failed:', error);
      return [];
    }
  }

  async enrollUser(userId: string, courseId: string, options: {
    level?: string;
    dateBeginValidity?: string;
    dateExpireValidity?: string;
    assignmentType?: string;
  } = {}): Promise<EnrollmentResult> {
    
    try {
      const enrollmentBody: any = {
        course_ids: [String(courseId)],
        user_ids: [String(userId)],
        level: options.level || "3",
        date_begin_validity: options.dateBeginValidity,
        date_expire_validity: options.dateExpireValidity,
        send_notification: false
      };

      // Only add assignment_type if it's a valid value
      if (options.assignmentType && options.assignmentType !== "none") {
        enrollmentBody.assignment_type = options.assignmentType;
      }

      // Remove undefined fields
      Object.keys(enrollmentBody).forEach(key => {
        if (enrollmentBody[key] === undefined) {
          delete enrollmentBody[key];
        }
      });

      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
      
      const enrolledUsers = result.data?.enrolled || [];
      const errors = result.data?.errors || {};
      
      if (enrolledUsers.length > 0) {
        return { 
          success: true, 
          message: `Successfully enrolled user in course`,
          details: result
        };
      } else {
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
      
    } catch (error) {
      return { 
        success: false, 
        message: `Enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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

  // Utility method to get the correct course ID from course object
  getCourseId(course: DoceboCourse): string | null {
    return course.id_course || course.course_id || course.idCourse || course.id || null;
  }
}
