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

  // FIXED: Enroll user in a course using correct API endpoints and parameters
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
      // Try multiple enrollment endpoints with different parameter formats
      const enrollmentEndpoints = [
        {
          endpoint: '/learn/v1/enrollments',
          body: {
            user_ids: [userId],
            course_ids: [courseId],
            level: options.level || 'student',
            assignment_type: options.assignmentType || 'required'
          }
        },
        {
          endpoint: '/learn/v1/enrollments',
          body: {
            users: [userId],
            courses: [courseId],
            level: options.level || 'student',
            assignment_type: options.assignmentType || 'required'
          }
        },
        {
          endpoint: '/course/v1/courses/enrollments',
          body: {
            user_id: userId,
            course_id: courseId,
            level: options.level || 'student',
            assignment_type: options.assignmentType || 'required'
          }
        }
      ];

      console.log(`🔄 Attempting to enroll user ${userId} in course ${courseId}`);

      // Try each endpoint until one succeeds
      for (const { endpoint, body } of enrollmentEndpoints) {
        try {
          console.log(`📋 Trying ${endpoint} with body:`, body);
          const result = await this.apiRequest(endpoint, 'POST', body);
          console.log(`✅ Enrollment successful via ${endpoint}:`, result);
          return result;
        } catch (endpointError) {
          console.log(`❌ Failed ${endpoint}:`, endpointError instanceof Error ? endpointError.message : endpointError);
          continue;
        }
      }
      
      // If all endpoints fail, throw the last error
      throw new Error('All enrollment endpoints failed. Please check the course ID and user permissions.');
    } catch (error) {
      console.error(`❌ Error enrolling user in course:`, error);
      throw error;
    }
  }

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
      // Try multiple learning plan enrollment endpoints
      const enrollmentEndpoints = [
        {
          endpoint: '/learningplan/v1/learningplans/enrollments',
          body: {
            user_ids: [userId],
            learning_plan_ids: [learningPlanId],
            assignment_type: options.assignmentType || 'required'
          }
        },
        {
          endpoint: '/learningplan/v1/learningplans/enrollments',
          body: {
            users: [userId],
            learning_plans: [learningPlanId],
            assignment_type: options.assignmentType || 'required'
          }
        },
        {
          endpoint: '/learningplan/v1/learningplans/enrollments',
          body: {
            user_id: userId,
            learning_plan_id: learningPlanId,
            assignment_type: options.assignmentType || 'required'
          }
        }
      ];

      console.log(`🔄 Attempting to enroll user ${userId} in learning plan ${learningPlanId}`);

      // Try each endpoint until one succeeds
      for (const { endpoint, body } of enrollmentEndpoints) {
        try {
          console.log(`📋 Trying LP ${endpoint} with body:`, body);
          const result = await this.apiRequest(endpoint, 'POST', body);
          console.log(`✅ LP enrollment successful via ${endpoint}:`, result);
          return result;
        } catch (endpointError) {
          console.log(`❌ Failed LP ${endpoint}:`, endpointError instanceof Error ? endpointError.message : endpointError);
          continue;
        }
      }
      
      // If all endpoints fail, throw the last error
      throw new Error('All learning plan enrollment endpoints failed. Please check the learning plan ID and user permissions.');
    } catch (error) {
      console.error(`❌ Error enrolling user in learning plan:`, error);
      throw error;
    }
  }

  // FIXED: Helper method to map enrollment levels
  private mapEnrollmentLevel(level: string): number {
    const levelMap: { [key: string]: number } = {
      'student': 3,
      'learner': 3,
      'tutor': 4,
      'instructor': 6
    };
    
    return levelMap[level.toLowerCase()] || 3;
  }

  // FIXED: Enhanced user search with better email matching
  async findUserByEmail(email: string): Promise<any> {
    try {
      console.log(`🔍 FIXED: Enhanced user search for: ${email}`);
      
      // Try exact email search first
      const exactSearch = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: email,
        page_size: 100
      });
      
      const users = exactSearch.data?.items || [];
      console.log(`📊 FIXED: Found ${users.length} users from search`);
      
      // Find exact email match (case-insensitive)
      const exactMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase() === email.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`✅ FIXED: Found exact email match: ${exactMatch.fullname || 'No name'} (${exactMatch.email})`);
        return exactMatch;
      }
      
      // If no exact match found, try partial matching
      const partialMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase().includes(email.toLowerCase())
      );
      
      if (partialMatch) {
        console.log(`⚠️ FIXED: Found partial email match: ${partialMatch.fullname || 'No name'} (${partialMatch.email})`);
        return partialMatch;
      }
      
      // No match found
      console.log(`❌ FIXED: No user found with email: ${email}`);
      return null;
      
    } catch (error) {
      console.error(`❌ FIXED: Error in findUserByEmail for ${email}:`, error);
      throw error;
    }
  }

  // FIXED: Enhanced course search with better matching
  async findCourseByIdentifier(identifier: string): Promise<any> {
    try {
      console.log(`🔍 Enhanced course search for: ${identifier}`);
      
      // Try direct ID lookup if it's numeric
      if (/^\d+$/.test(identifier)) {
        try {
          console.log(`🆔 Trying direct course lookup by ID: ${identifier}`);
          const directResult = await this.apiRequest(`/learn/v1/courses/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ Found course by direct ID lookup`);
            return this.enrichCourseData(directResult.data);
          }
        } catch (directError) {
          console.log(`❌ Direct course lookup failed for ID ${identifier}`);
        }
      }

      // Search by name/keyword
      console.log(`🔍 Searching courses by name: ${identifier}`);
      const searchResult = await this.apiRequest('/learn/v1/courses', 'GET', null, {
        search_text: identifier,
        page_size: 100,
        sort_attr: 'name',
        sort_dir: 'asc'
      });
      
      const courses = searchResult.data?.items || [];
      console.log(`📊 Found ${courses.length} courses from search`);
      
      if (courses.length === 0) {
        throw new Error(`Course not found: ${identifier}`);
      }

      // Find best match (exact name match first, then partial)
      const exactMatch = courses.find((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase() === identifier.toLowerCase();
      });

      if (exactMatch) {
        console.log(`✅ Found exact course match: ${this.getCourseName(exactMatch)}`);
        return this.enrichCourseData(exactMatch);
      }

      // Try partial match
      const partialMatch = courses.find((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase().includes(identifier.toLowerCase());
      });

      if (partialMatch) {
        console.log(`⚠️ Found partial course match: ${this.getCourseName(partialMatch)}`);
        return this.enrichCourseData(partialMatch);
      }

      // Return first result as fallback
      console.log(`🔄 Using first result as fallback: ${this.getCourseName(courses[0])}`);
      return this.enrichCourseData(courses[0]);

    } catch (error) {
      console.error(`❌ Error finding course: ${identifier}`, error);
      throw error;
    }
  }

  // Helper method to get course name from various possible fields
  getCourseName(course: any): string {
    return course.name || 
           course.title || 
           course.course_name || 
           course.courseName ||
           course.course_title ||
           'Unknown Course';
  }

  // Helper method to get learning plan name from various possible fields
  getLearningPlanName(learningPlan: any): string {
    return learningPlan.title || 
           learningPlan.name || 
           learningPlan.learning_plan_name || 
           learningPlan.lp_name || 
           learningPlan.learningplan_name ||
           learningPlan.plan_name ||
           'Unknown Learning Plan';
  }

  // Helper method to find learning plan by identifier
  async findLearningPlanByIdentifier(identifier: string): Promise<any> {
    try {
      console.log(`🔍 Enhanced learning plan search for: ${identifier}`);
      
      // Try direct ID lookup if it's numeric
      if (/^\d+$/.test(identifier)) {
        try {
          console.log(`🆔 Trying direct learning plan lookup by ID: ${identifier}`);
          const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ Found learning plan by direct ID lookup`);
            return directResult.data;
          }
        } catch (directError) {
          console.log(`❌ Direct learning plan lookup failed for ID ${identifier}`);
        }
      }

      // Search by name/keyword
      console.log(`🔍 Searching learning plans by name: ${identifier}`);
      const searchResult = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        search_text: identifier,
        page_size: 100
      });
      
      const learningPlans = searchResult.data?.items || [];
      console.log(`📊 Found ${learningPlans.length} learning plans from search`);
      
      if (learningPlans.length === 0) {
        throw new Error(`Learning plan not found: ${identifier}`);
      }

      // Find best match
      const exactMatch = learningPlans.find((lp: any) => {
        const lpName = this.getLearningPlanName(lp);
        const lpId = (lp.learning_plan_id || lp.id)?.toString();
        
        return lpId === identifier.toString() || 
               lpName.toLowerCase() === identifier.toLowerCase();
      });

      if (exactMatch) {
        console.log(`✅ Found exact learning plan match: ${this.getLearningPlanName(exactMatch)}`);
        return exactMatch;
      }

      // Return first result as fallback
      console.log(`🔄 Using first result as fallback: ${this.getLearningPlanName(learningPlans[0])}`);
      return learningPlans[0];

    } catch (error) {
      console.error(`❌ Error finding learning plan: ${identifier}`, error);
      throw error;
    }
  }

  // Helper method to unenroll user from course
  async unenrollUserFromCourse(userId: string, courseId: string): Promise<any> {
    try {
      console.log(`🔄 Attempting to unenroll user ${userId} from course ${courseId}`);
      
      const unenrollmentEndpoints = [
        {
          endpoint: `/learn/v1/enrollments/users/${userId}/courses/${courseId}`,
          method: 'DELETE' as const
        },
        {
          endpoint: '/learn/v1/enrollments',
          method: 'DELETE' as const,
          body: {
            user_ids: [userId],
            course_ids: [courseId]
          }
        }
      ];

      for (const { endpoint, method, body } of unenrollmentEndpoints) {
        try {
          console.log(`📋 Trying unenrollment ${method} ${endpoint}`);
          const result = await this.apiRequest(endpoint, method, body);
          console.log(`✅ Unenrollment successful via ${endpoint}`);
          return result;
        } catch (endpointError) {
          console.log(`❌ Failed ${endpoint}:`, endpointError instanceof Error ? endpointError.message : endpointError);
          continue;
        }
      }
      
      throw new Error('All unenrollment endpoints failed. Please check the course ID and user permissions.');
    } catch (error) {
      console.error(`❌ Error unenrolling user from course:`, error);
      throw error;
    }
  }

  // Helper method to unenroll user from learning plan
  async unenrollUserFromLearningPlan(userId: string, learningPlanId: string): Promise<any> {
    try {
      console.log(`🔄 Attempting to unenroll user ${userId} from learning plan ${learningPlanId}`);
      
      const unenrollmentEndpoints = [
        {
          endpoint: `/learningplan/v1/learningplans/${learningPlanId}/enrollments/users/${userId}`,
          method: 'DELETE' as const
        },
        {
          endpoint: '/learningplan/v1/learningplans/enrollments',
          method: 'DELETE' as const,
          body: {
            user_ids: [userId],
            learning_plan_ids: [learningPlanId]
          }
        }
      ];

      for (const { endpoint, method, body } of unenrollmentEndpoints) {
        try {
          console.log(`📋 Trying LP unenrollment ${method} ${endpoint}`);
          const result = await this.apiRequest(endpoint, method, body);
          console.log(`✅ LP unenrollment successful via ${endpoint}`);
          return result;
        } catch (endpointError) {
          console.log(`❌ Failed LP ${endpoint}:`, endpointError instanceof Error ? endpointError.message : endpointError);
          continue;
        }
      }
      
      throw new Error('All learning plan unenrollment endpoints failed. Please check the learning plan ID and user permissions.');
    } catch (error) {
      console.error(`❌ Error unenrolling user from learning plan:`, error);
      throw error;
    }
  }

  // FIXED: Helper method to get user details by email
  async getUserDetails(email: string): Promise<any> {
    try {
      console.log(`🔍 FIXED: Getting user details for: ${email}`);
      
      const user = await this.findUserByEmail(email);
      if (!user) {
        throw new Error(`User not found: ${email}`);
      }

      return this.formatUserDetails(user);
    } catch (error) {
      console.error(`❌ FIXED: Error getting user details for ${email}:`, error);
      throw error;
    }
  }

  // FIXED: Helper method to format user details consistently
  formatUserDetails(userData: any): any {
    console.log(`🔧 FIXED: Formatting user details for:`, userData.email || userData.user_id);
    
    return {
      id: (userData.user_id || userData.id || 'Unknown').toString(),
      fullname: userData.fullname || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Not available',
      email: userData.email || 'Not available',
      username: userData.username || userData.encoded_username || 'Not available',
      status: this.mapUserStatus(userData.status),
      level: this.mapUserLevel(userData.level),
      creationDate: userData.creation_date ? new Date(userData.creation_date).toLocaleDateString() : 'Not available',
      lastAccess: userData.last_access_date ? new Date(userData.last_access_date).toLocaleDateString() : 'Not available',
      timezone: userData.timezone || 'Not set',
      language: userData.language || userData.lang_code || 'en',
      department: userData.field_1 || userData.field_5 || 'Not assigned',
      
      // Additional fields from API response
      firstName: userData.first_name,
      lastName: userData.last_name,
      uuid: userData.uuid,
      isManager: userData.is_manager || false,
      directManager: userData.manager_first_name && userData.manager_last_name 
        ? `${userData.manager_first_name} ${userData.manager_last_name}` 
        : null,
      managerUsername: userData.manager_username,
      managerId: userData.manager_id,
      
      // Custom fields from API response
      jobRole: userData.field_1, // Job Role
      googlerType: userData.field_2, // Googler Type
      organizationName: userData.field_4, // Organization Name
      team: userData.field_5, // Team
      personId: userData.field_6, // Person ID
      
      // Manager information
      managers: userData.managers || [],
      managerNames: userData.manager_names || {},
      activeSubordinatesCount: userData.active_subordinates_count || 0
    };
  }

  // FIXED: Helper method to map user status
  private mapUserStatus(status: any): string {
    if (status === 1 || status === '1' || status === 'active') return 'Active';
    if (status === 0 || status === '0' || status === 'inactive') return 'Inactive';
    if (status === 2 || status === '2' || status === 'suspended') return 'Suspended';
    return status?.toString() || 'Unknown';
  }

  // FIXED: Helper method to map user level
  private mapUserLevel(level: any): string {
    if (level === 'godadmin') return 'Super Admin';
    if (level === 'power_user') return 'Power User';
    if (level === 'course_creator') return 'Course Creator';
    if (level === '3' || level === 3) return 'Student';
    return level?.toString() || 'User';
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

  // FIXED: Search users with proper field mapping
  async searchUsers(searchText: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`🔍 FIXED: Searching users with: "${searchText}"`);
      
      const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      
      const users = result.data?.items || [];
      console.log(`📊 FIXED: Found ${users.length} users from API`);
      
      return users;
    } catch (error) {
      console.error('FIXED: User search failed:', error);
      return [];
    }
  }

  // FIXED: Search courses with proper endpoint and mapping
  async searchCourses(searchText: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`🔍 FIXED: Searching courses with: "${searchText}"`);
      
      const result = await this.apiRequest('/course/v1/courses', 'GET', null, {
        search_text: searchText,
        page_size: limit,
        sort_attr: 'name',
        sort_dir: 'asc'
      });
      
      const courses = result.data?.items || [];
      console.log(`📊 FIXED: Found ${courses.length} courses from API`);
      
      return courses;
    } catch (error) {
      console.error('FIXED: Course search failed:', error);
      return [];
    }
  }

  // FIXED: Search learning plans without problematic sort_attr
  async searchLearningPlans(searchText: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`🔍 FIXED: Searching learning plans: "${searchText}"`);
      
      // First try with search_text (might not work)
      let result;
      try {
        result = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
          // Removed sort_attr which was causing 400 error
        });
        
        if (result.data?.items?.length > 0) {
          console.log(`📊 FIXED: Found ${result.data.items.length} learning plans via search_text`);
          return result.data.items;
        }
      } catch (searchError) {
        console.log(`🔍 FIXED: search_text failed, trying manual filter...`);
      }
      
      // Fallback: get all and filter manually
      const allResult = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        page_size: Math.min(limit * 5, 200)
        // No sort_attr to avoid 400 error
      });
      
      if (allResult.data?.items?.length > 0) {
        const filteredPlans = allResult.data.items.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          return name.includes(searchText.toLowerCase()) || 
                 description.includes(searchText.toLowerCase());
        });
        
        console.log(`📊 FIXED: Found ${filteredPlans.length} learning plans via manual filter`);
        return filteredPlans.slice(0, limit);
      }
      
      return [];
    } catch (error) {
      console.error('FIXED: Learning plan search failed:', error);
      return [];
    }
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
