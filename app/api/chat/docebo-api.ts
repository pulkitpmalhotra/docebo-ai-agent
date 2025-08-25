import { DoceboConfig, UserDetails, EnrollmentData, FormattedEnrollment } from './types';

export class DoceboAPI {
  private config: DoceboConfig;
  private accessToken: string = ''; // Initialize with empty string
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: DoceboConfig) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
  }

  // Obtain access token
  private async getAccessToken(): Promise<string> {
    // Check if current token is valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Request new token
    try {
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
        throw new Error('Token request failed');
      }

      const tokenData = await response.json();
      
      // Validate access token
      if (!tokenData.access_token) {
        throw new Error('No access token received');
      }

      // Update access token and expiry
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
      
      return this.accessToken;
    } catch (error) {
      // Reset access token to empty string in case of error
      this.accessToken = '';
      this.tokenExpiry = undefined;
      
      console.error('Token acquisition failed:', error);
      throw error;
    }
  }

  // Generic API request method
  async apiRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
    body?: any, 
    params?: Record<string, string | number>
  ): Promise<any> {
    // Get access token
    const token = await this.getAccessToken();
    
    // Construct URL with optional query parameters
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value.toString());
      });
      url += `?${queryParams}`;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    // Prepare request options
    const options: RequestInit = {
      method,
      headers: headers
    };

    // Add body for non-GET requests
    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    // Perform the request
    try {
      const response = await fetch(url, options);

      // Handle response
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // User details extraction and formatting
  private formatUserDetails(user: any): UserDetails {
    // Utility functions for parsing
    const extractName = (user: any): string => {
      return user.fullname || 
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
        `User ${user.user_id || user.id}`;
    };

    const determineStatus = (user: any): string => {
      const statusField = user.status || user.valid || user.is_active || user.active;
      
      if (statusField === '1' || statusField === 1 || statusField === true || statusField === 'active') {
        return 'Active';
      } else if (statusField === '0' || statusField === 0 || statusField === false || statusField === 'inactive') {
        return 'Inactive';
      } else if (statusField === 'suspended') {
        return 'Suspended';
      }
      
      return 'Unknown';
    };

    const determineLevel = (user: any): string => {
      const levelField = user.level || user.user_level || user.role || user.user_role || '';
      
      const levelMap: {[key: string]: string} = {
        'godadmin': 'God Admin',
        'powUser': 'Power User',
        'power_user': 'Power User',
        'admin': 'Admin', 
        'administrator': 'Admin',
        'user': 'User',
        '4': 'User'
      };
      
      return levelMap[levelField] || 'User';
    };

    // Validate required fields
    const userId = (user.user_id || user.id || '').toString();
    const email = user.email || '';

    if (!userId || !email) {
      throw new Error('Missing required user data');
    }

    return {
      id: userId,
      fullname: extractName(user),
      email: email,
      username: user.username || user.encoded_username || user.userid || user.user_name || email,
      status: determineStatus(user),
      level: determineLevel(user),
      creationDate: user.creation_date || user.register_date || user.date_created || user.created_at || 'Not available',
      lastAccess: user.last_access_date || user.last_update || user.last_access || user.updated_at || 'Not available',
      timezone: user.timezone || user.time_zone || user.tz || 'America/New_York',
      language: user.language || user.lang || user.lang_code || 'English',
      department: user.department || user.field_5 || 'Not specified',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      uuid: user.uuid || '',
      isManager: user.is_manager || false,
      subordinatesCount: user.active_subordinates_count || 0,
      avatar: user.avatar || '',
      expirationDate: user.expiration_date || null,
      emailValidationStatus: user.email_validation_status === '1' ? 'Validated' : 'Not Validated',
    };
  }

  // Retrieve user details by email
  async getUserDetails(email: string): Promise<UserDetails> {
    try {
      const response = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: email
      });
      
      const users = response.data?.items || [];
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        throw new Error(`No user found with email: ${email}`);
      }
      
      return this.formatUserDetails(user);
    } catch (error) {
      console.error(`Error retrieving user details for ${email}:`, error);
      throw error;
    }
  }

  // Course name extraction
  getCourseName(course: any): string {
    return course.name || 
           course.title || 
           course.course_name || 
           'Unknown Course';
  }

  // Learning plan name extraction
  getLearningPlanName(lp: any): string {
    return lp.name ||
           lp.title ||
           lp.learning_plan_name ||
           lp.lp_name ||
           lp.learningplan_name ||
           lp.plan_name ||
           'Unknown Learning Plan';
  }

  // Find course by identifier (ID or name)
  async findCourseByIdentifier(identifier: string): Promise<any> {
    try {
      // Direct lookup by ID
      if (/^\d+$/.test(identifier)) {
        try {
          const directResult = await this.apiRequest(`/learn/v1/courses/${identifier}`, 'GET');
          if (directResult.data) {
            return this.enrichCourseData(directResult.data);
          }
        } catch (directError) {
          console.log(`Course direct lookup failed for ID ${identifier}`);
        }
      }

      // Search by name/keyword
      const courses = await this.searchCourses(identifier, 50);
      
      if (courses.length === 0) {
        throw new Error(`Course not found: ${identifier}`);
      }

      // Find exact or best match
      const bestMatch = courses.find(course => {
        const courseName = this.getCourseName(course);
        const courseId = (course.id || course.course_id)?.toString();
        
        return courseId === identifier || 
               courseName.toLowerCase() === identifier.toLowerCase() ||
               courseName.toLowerCase().includes(identifier.toLowerCase());
      }) || courses[0];

      return this.enrichCourseData(bestMatch);
    } catch (error) {
      console.error(`Error finding course: ${identifier}`, error);
      throw error;
    }
  }

  // Enrich course data with normalized fields
  private enrichCourseData(courseData: any): any {
    return {
      id: courseData.id || courseData.course_id || courseData.idCourse,
      course_id: courseData.id || courseData.course_id || courseData.idCourse,
      title: this.getCourseName(courseData),
      course_name: this.getCourseName(courseData),
      name: this.getCourseName(courseData),
      code: courseData.code || courseData.course_code,
      type: courseData.course_type || 'elearning',
      course_type: courseData.course_type || 'elearning',
      status: courseData.status,
      can_subscribe: courseData.can_subscribe,
      description: courseData.description || '',
      date_creation: courseData.date_creation,
      date_modification: courseData.date_modification,
      creation_date: courseData.date_creation ? new Date(courseData.date_creation * 1000).toISOString() : null,
      last_update: courseData.date_modification ? new Date(courseData.date_modification * 1000).toISOString() : null,
      language: courseData.lang_code || courseData.language,
      lang_code: courseData.lang_code,
      enrolled_count: courseData.enrolled_users_count || courseData.enrolled_users || courseData.subscription_count || 0,
      enrollment_count: courseData.enrolled_users_count || courseData.enrolled_users || courseData.subscription_count || 0,
      category_name: courseData.category_name,
      credits: courseData.credits || 0,
      ...courseData
    };
  }

  // Search courses
  async searchCourses(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/learn/v1/courses', 'GET', null, {
      search_text: searchText,
      page_size: limit
    });
    return result.data?.items || [];
  }

  // Get user enrollments
  async getUserAllEnrollments(userId: string): Promise<EnrollmentData> {
    try {
      // Get course enrollments
      const courseEnrollments = await this.apiRequest('/course/v1/courses/enrollments', 'GET', null, {
        'user_id[]': userId,
        page_size: 200
      });

      // Get learning plan enrollments
      const lpEnrollments = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'GET', null, {
        'user_id[]': userId,
        page_size: 200
      });

      const courses = courseEnrollments.data?.items || [];
      const learningPlans = lpEnrollments.data?.items || [];

      return {
        courses: {
          enrollments: courses.map((enrollment: any) => this.formatCourseEnrollment(enrollment)),
          totalCount: courses.length,
          endpoint: '/course/v1/courses/enrollments',
          success: true
        },
        learningPlans: {
          enrollments: learningPlans.map((enrollment: any) => this.formatLearningPlanEnrollment(enrollment)),
          totalCount: learningPlans.length,
          endpoint: '/learningplan/v1/learningplans/enrollments',
          success: true
        },
        totalCourses: courses.length,
        totalLearningPlans: learningPlans.length,
        success: true
      };
    } catch (error) {
      console.error(`Error getting all enrollments:`, error);
      return {
        courses: {
          enrollments: [],
          totalCount: 0,
          endpoint: '/course/v1/courses/enrollments',
          success: false
        },
        learningPlans: {
          enrollments: [],
          totalCount: 0,
          endpoint: '/learningplan/v1/learningplans/enrollments',
          success: false
        },
        totalCourses: 0,
        totalLearningPlans: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Format course enrollment
  private formatCourseEnrollment(enrollment: any): FormattedEnrollment {
    return {
      courseId: (enrollment.course_id || enrollment.id)?.toString(),
      courseName: enrollment.course_name || enrollment.name || 'Unknown Course',
      enrollmentStatus: enrollment.status || 'enrolled',
      enrollmentDate: enrollment.enrollment_date || enrollment.date_inscr,
      completionDate: enrollment.completion_date,
      progress: enrollment.progress || 0,
      score: enrollment.score,
      dueDate: enrollment.due_date,
      assignmentType: enrollment.assignment_type
    };
  }

  // Format learning plan enrollment
  private formatLearningPlanEnrollment(enrollment: any): FormattedEnrollment {
    return {
      learningPlanId: (enrollment.learning_plan_id || enrollment.id)?.toString(),
      learningPlanName: enrollment.learning_plan_name || enrollment.name || 'Unknown Learning Plan',
      enrollmentStatus: enrollment.status || 'enrolled',
      enrollmentDate: enrollment.enrollment_date || enrollment.date_inscr,
      completionDate: enrollment.completion_date,
      progress: enrollment.progress || 0,
      completedCourses: enrollment.completed_courses,
      totalCourses: enrollment.total_courses,
      dueDate: enrollment.due_date,
      assignmentType: enrollment.assignment_type
    };
  }
}
