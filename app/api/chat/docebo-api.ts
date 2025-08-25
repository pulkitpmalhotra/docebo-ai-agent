import { DoceboConfig, UserDetails, EnrollmentData, FormattedEnrollment } from './types';

export class DoceboAPI {
  private config: DoceboConfig;
  private _accessToken: string = ''; // Private field with default empty string
  private _tokenExpiry: Date | null = null;
  private baseUrl: string;

  constructor(config: DoceboConfig) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
  }

  // Obtain access token with improved type safety
  private async getAccessToken(): Promise<string> {
    // Check if current token is valid
    if (this._accessToken && 
        this._tokenExpiry && 
        this._tokenExpiry > new Date()) {
      return this._accessToken;
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
      
      // Validate access token explicitly
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new Error('No access token received');
      }

      // Update access token and expiry
      this._accessToken = accessToken;
      this._tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
      
      return this._accessToken;
    } catch (error) {
      // Reset access token and expiry in case of error
      this._accessToken = '';
      this._tokenExpiry = null;
      
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

  // Enroll user in a course
  async enrollUserInCourse(
    userId: string, 
    courseId: string, 
    options: {
      level?: string;
      assignmentType?: string;
      startValidity?: string;
      endValidity?: string;
    } = {}
  ): Promise<any> {
    try {
      const enrollmentBody = {
        users: [userId],
        courses: [courseId],
        priority: options.level || 'medium',
        due_date: options.endValidity,
        enrollment_type: 'immediate',
        assignment_type: options.assignmentType || 'required'
      };

      return await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
    } catch (error) {
      console.error(`❌ Error enrolling user in course:`, error);
      throw error;
    }
  }

  // Enroll user in a learning plan
  async enrollUserInLearningPlan(
    userId: string, 
    learningPlanId: string, 
    options: {
      assignmentType?: string;
      startValidity?: string;
      endValidity?: string;
    } = {}
  ): Promise<any> {
    try {
      const enrollmentBody = {
        users: [userId],
        learning_plans: [learningPlanId],
        due_date: options.endValidity,
        assignment_type: options.assignmentType || 'required'
      };

      return await this.apiRequest('/learningplan/v1/enrollments', 'POST', enrollmentBody);
    } catch (error) {
      console.error(`❌ Error enrolling user in learning plan:`, error);
      throw error;
    }
  }

  // Unenroll user from a course
  async unenrollUserFromCourse(
    userId: string, 
    courseId: string
  ): Promise<any> {
    try {
      return await this.apiRequest(
        `/learn/v1/enrollments/courses/${courseId}/users/${userId}`, 
        'DELETE'
      );
    } catch (error) {
      console.error(`❌ Error unenrolling user from course:`, error);
      throw error;
    }
  }

  // Unenroll user from a learning plan
  async unenrollUserFromLearningPlan(
    userId: string, 
    learningPlanId: string
  ): Promise<any> {
    try {
      return await this.apiRequest(
        `/learn/v1/enrollments/learning-plans/${learningPlanId}/users/${userId}`, 
        'DELETE'
      );
    } catch (error) {
      console.error(`❌ Error unenrolling user from learning plan:`, error);
      throw error;
    }
  }

  // Find learning plan by identifier (ID or name)
  async findLearningPlanByIdentifier(identifier: string): Promise<any> {
    try {
      // Direct lookup by ID
      if (/^\d+$/.test(identifier)) {
        try {
          const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
          if (directResult.data) {
            return this.enrichLearningPlanData(directResult.data);
          }
        } catch (directError) {
          console.log(`Learning plan direct lookup failed for ID ${identifier}`);
        }
      }

      // Search by name/keyword
      const learningPlans = await this.searchLearningPlans(identifier, 50);
      
      if (learningPlans.length === 0) {
        throw new Error(`Learning plan not found: ${identifier}`);
      }

      // Find exact or best match
      const bestMatch = learningPlans.find(lp => {
        const lpName = this.getLearningPlanName(lp);
        const lpId = (lp.learning_plan_id || lp.id)?.toString();
        
        return lpId === identifier || 
               lpName.toLowerCase() === identifier.toLowerCase() ||
               lpName.toLowerCase().includes(identifier.toLowerCase());
      }) || learningPlans[0];

      return this.enrichLearningPlanData(bestMatch);
    } catch (error) {
      console.error(`Error finding learning plan: ${identifier}`, error);
      throw error;
    }
  }

  // Enrich learning plan data with normalized fields
  private enrichLearningPlanData(lpData: any): any {
    return {
      id: lpData.learning_plan_id || lpData.id || lpData.lp_id,
      learning_plan_id: lpData.learning_plan_id || lpData.id || lpData.lp_id,
      title: this.getLearningPlanName(lpData),
      name: this.getLearningPlanName(lpData),
      learning_plan_name: this.getLearningPlanName(lpData),
      code: lpData.code,
      is_active: lpData.is_active,
      status: lpData.status,
      description: lpData.description || '',
      date_creation: lpData.date_creation,
      date_modification: lpData.date_modification,
      creation_date: lpData.date_creation ? new Date(lpData.date_creation * 1000).toISOString() : null,
      last_update: lpData.date_modification ? new Date(lpData.date_modification * 1000).toISOString() : null,
      enrolled_users_count: lpData.enrolled_users_count || lpData.total_users || lpData.user_count || 0,
      courses_count: lpData.courses_count || lpData.total_courses || 0,
      ...lpData
    };
  }

  // Search learning plans
  async searchLearningPlans(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
      search_text: searchText,
      page_size: limit,
      sort_attr: 'name',
      sort_dir: 'asc'
    });
    return result.data?.items || [];
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

  // Search users
  async searchUsers(searchText: string, limit: number = 25): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
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
  formatCourseEnrollment(enrollment: any): FormattedEnrollment {
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
  formatLearningPlanEnrollment(enrollment: any): FormattedEnrollment {
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

  // Get enhanced user details with manager information
  async getEnhancedUserDetails(userId: string): Promise<any> {
    try {
      // Get basic user details first
      const userResponse = await this.apiRequest(`/manage/v1/user/${userId}`, 'GET');
      const userData = userResponse.data;
      
      if (!userData) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      // Format basic user details
      const basicDetails = this.formatUserDetails(userData);
      
      // Try to get manager information
      let managerInfo = null;
      try {
        if (userData.direct_manager || userData.manager_id) {
          const managerId = userData.direct_manager || userData.manager_id;
          const managerResponse = await this.apiRequest(`/manage/v1/user/${managerId}`, 'GET');
          if (managerResponse.data) {
            managerInfo = {
              id: managerResponse.data.user_id?.toString() || managerId,
              fullname: managerResponse.data.fullname || `${managerResponse.data.first_name || ''} ${managerResponse.data.last_name || ''}`.trim() || 'Unknown Manager',
              email: managerResponse.data.email || '',
              department: managerResponse.data.department || managerResponse.data.field_5 || ''
            };
          }
        }
      } catch (managerError) {
        console.log('Could not fetch manager details:', managerError);
      }

      // Return enhanced details
      return {
        ...basicDetails,
        manager: managerInfo,
        additionalFields: {
          jobTitle: userData.job_title || userData.field_1 || '',
          employeeId: userData.employee_id || userData.field_2 || '',
          location: userData.location || userData.field_3 || '',
          directReports: userData.subordinates_count || userData.active_subordinates_count || 0
        }
      };

    } catch (error) {
      console.error(`Error getting enhanced user details for ${userId}:`, error);
      throw error;
    }
  }
}
