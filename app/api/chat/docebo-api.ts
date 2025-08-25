import { DoceboConfig, UserDetails, EnrollmentData, FormattedEnrollment } from './types';

export class DoceboAPI {
  private config: DoceboConfig;
  private _accessToken: string = '';
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
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new Error('No access token received');
      }

      this._accessToken = accessToken;
      this._tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
      
      return this._accessToken;
    } catch (error) {
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
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
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

    const options: RequestInit = {
      method,
      headers: headers
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

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

  // Helper method to enrich course data with normalized fields
  private enrichCourseData(courseData: any): any {
    return {
      id: courseData.id || courseData.course_id || courseData.idCourse,
      course_id: courseData.id || courseData.course_id || courseData.idCourse,
      title: this.getCourseName(courseData),
      course_name: this.getCourseName(courseData),
      name: this.getCourseName(courseData),
      code: courseData.code || courseData.course_code,
      type: courseData.course_type || courseData.type || 'elearning',
      course_type: courseData.course_type || courseData.type || 'elearning',
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

  // Enroll user in a course using correct API endpoints and parameters
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
      console.log(`🔄 FIXED: Attempting to enroll user ${userId} in course ${courseId}`);

      let levelValue: string | number = 3;
      if (options.level === 'tutor') levelValue = 4;
      else if (options.level === 'instructor') levelValue = 6;
      else levelValue = 3; // student

      const enrollmentData = {
        course_ids: [parseInt(courseId)],
        user_ids: [parseInt(userId)],
        level: levelValue.toString(),
        assignment_type: options.assignmentType || 'mandatory',
        ...(options.startValidity && { date_begin_validity: options.startValidity }),
        ...(options.endValidity && { date_expire_validity: options.endValidity })
      };

      console.log(`📋 FIXED: Course enrollment data:`, enrollmentData);
      
      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentData);
      console.log(`✅ FIXED: Course enrollment successful:`, result);
      return result;

    } catch (error) {
      console.error(`❌ FIXED: Error enrolling user ${userId} in course ${courseId}:`, error);
      throw error;
    }
  }

  // Enroll user in learning plan using the correct endpoint
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
      console.log(`🔄 FIXED: Attempting to enroll user ${userId} in learning plan ${learningPlanId}`);

      const enrollmentData = {
        user_ids: [parseInt(userId)],
        learningplan_ids: [parseInt(learningPlanId)],
        assignment_type: options.assignmentType || 'mandatory',
        ...(options.startValidity && { date_begin_validity: options.startValidity }),
        ...(options.endValidity && { date_expire_validity: options.endValidity })
      };

      console.log(`📋 FIXED: LP enrollment data:`, enrollmentData);
      
      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentData);
      console.log(`✅ FIXED: Learning plan enrollment successful:`, result);
      return result;

    } catch (error) {
      console.error(`❌ FIXED: Error enrolling user ${userId} in learning plan ${learningPlanId}:`, error);
      throw error;
    }
  }

  // Unenroll user from course using the correct endpoint
  async unenrollUserFromCourse(userId: string, courseId: string): Promise<any> {
    try {
      console.log(`🔄 FIXED: Attempting to unenroll user ${userId} from course ${courseId}`);
      
      const unenrollmentBody = {
        user_ids: [parseInt(userId)],
        course_ids: [parseInt(courseId)],
        reset_tracks: false,
        delete_issued_certificates: false
      };

      console.log(`📋 FIXED: Using DELETE /learn/v1/enrollments with body:`, unenrollmentBody);
      
      const result = await this.apiRequest('/learn/v1/enrollments', 'DELETE', unenrollmentBody);
      console.log(`✅ FIXED: Course unenrollment successful:`, result);
      return result;

    } catch (error) {
      console.error(`❌ FIXED: Error unenrolling user ${userId} from course ${courseId}:`, error);
      throw error;
    }
  }

  // Unenroll user from learning plan using the correct endpoint
  async unenrollUserFromLearningPlan(userId: string, learningPlanId: string): Promise<any> {
    try {
      console.log(`🔄 FIXED: Attempting to unenroll user ${userId} from learning plan ${learningPlanId}`);
      
      const unenrollmentBody = {
        user_ids: [parseInt(userId)],
        learningplan_ids: [parseInt(learningPlanId)],
        reset_tracks: false,
        cascade_unenroll_from_courses_in_selected_learning_plan: false,
        delete_issued_certificates: false
      };

      console.log(`📋 FIXED: Using DELETE /learningplan/v1/learningplans/enrollments with body:`, unenrollmentBody);
      
      const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'DELETE', unenrollmentBody);
      console.log(`✅ FIXED: Learning plan unenrollment successful:`, result);
      return result;

    } catch (error) {
      console.error(`❌ FIXED: Error unenrolling user ${userId} from learning plan ${learningPlanId}:`, error);
      throw error;
    }
  }

  // Enhanced course search with EXACT matching priority
  async findCourseByIdentifier(identifier: string): Promise<any> {
    try {
      console.log(`🔍 EXACT SEARCH: Finding course: "${identifier}"`);
      
      // Try direct ID lookup if it's numeric
      if (/^\d+$/.test(identifier)) {
        try {
          console.log(`🆔 Direct course lookup by ID: ${identifier}`);
          const directResult = await this.apiRequest(`/course/v1/courses/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ Found course by direct ID lookup`);
            return this.enrichCourseData(directResult.data);
          }
        } catch (directError) {
          console.log(`❌ Direct course lookup failed for ID ${identifier}`);
        }
      }

      // Search by name/keyword with EXACT matching priority
      console.log(`🔍 Searching courses by name: "${identifier}"`);
      const searchResult = await this.apiRequest('/course/v1/courses', 'GET', null, {
        search_text: identifier,
        page_size: 200,
        sort_attr: 'name',
        sort_dir: 'asc'
      });
      
      const courses = searchResult.data?.items || [];
      console.log(`📊 Found ${courses.length} courses from search`);
      
      if (courses.length === 0) {
        throw new Error(`Course not found: ${identifier}`);
      }

      // PRIORITY 1: Exact title/name match (case-insensitive)
      let exactMatch = courses.find((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase() === identifier.toLowerCase();
      });

      if (exactMatch) {
        console.log(`✅ EXACT MATCH: Found exact course match: "${this.getCourseName(exactMatch)}"`);
        return this.enrichCourseData(exactMatch);
      }

      // PRIORITY 2: Exact code match
      exactMatch = courses.find((course: any) => {
        const courseCode = course.code || '';
        return courseCode.toLowerCase() === identifier.toLowerCase();
      });

      if (exactMatch) {
        console.log(`✅ CODE MATCH: Found exact code match: "${this.getCourseName(exactMatch)}" (${exactMatch.code})`);
        return this.enrichCourseData(exactMatch);
      }

      // PRIORITY 3: Title starts with identifier
      const startsWithMatch = courses.find((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase().startsWith(identifier.toLowerCase());
      });

      if (startsWithMatch) {
        console.log(`✅ STARTS WITH: Found course starting with "${identifier}": "${this.getCourseName(startsWithMatch)}"`);
        return this.enrichCourseData(startsWithMatch);
      }

      // PRIORITY 4: Contains match (with warning)
      const containsMatch = courses.find((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase().includes(identifier.toLowerCase());
      });

      if (containsMatch) {
        console.log(`⚠️ PARTIAL MATCH: Using partial match: "${this.getCourseName(containsMatch)}" for search "${identifier}"`);
        return this.enrichCourseData(containsMatch);
      }

      // Fallback to first result
      console.log(`⚠️ FALLBACK: No exact matches found, using first result: "${this.getCourseName(courses[0])}" for search "${identifier}"`);
      return this.enrichCourseData(courses[0]);

    } catch (error) {
      console.error(`❌ Error finding course: ${identifier}`, error);
      throw error;
    }
  }

  // Enhanced learning plan search with EXACT matching priority
  async findLearningPlanByIdentifier(identifier: string): Promise<any> {
    try {
      console.log(`🔍 EXACT SEARCH: Finding learning plan: "${identifier}"`);
      
      // Try direct ID lookup if it's numeric
      if (/^\d+$/.test(identifier)) {
        try {
          console.log(`🆔 Direct learning plan lookup by ID: ${identifier}`);
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
      console.log(`🔍 Searching learning plans by name: "${identifier}"`);
      let result;
      try {
        result = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          search_text: identifier,
          page_size: 200
        });
      } catch (searchError) {
        console.log('Direct search failed, trying fallback method...');
        
        // Fallback: Get all and filter manually
        result = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          page_size: 200
        });
        
        const allItems = result.data?.items || [];
        const filteredItems = allItems.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          const searchLower = identifier.toLowerCase();
          
          if (name === searchLower) return true;
          if (name.startsWith(searchLower)) return true;
          return name.includes(searchLower) || description.includes(searchLower);
        });
        
        filteredItems.sort((a: any, b: any) => {
          const nameA = this.getLearningPlanName(a).toLowerCase();
          const nameB = this.getLearningPlanName(b).toLowerCase();
          const searchLower = identifier.toLowerCase();
          
          if (nameA === searchLower && nameB !== searchLower) return -1;
          if (nameB === searchLower && nameA !== searchLower) return 1;
          
          const aStartsWith = nameA.startsWith(searchLower);
          const bStartsWith = nameB.startsWith(searchLower);
          if (aStartsWith && !bStartsWith) return -1;
          if (bStartsWith && !aStartsWith) return 1;
          
          return 0;
        });
        
        result = {
          data: {
            items: filteredItems,
            total_count: filteredItems.length
          }
        };
      }
      
      const learningPlans = result.data?.items || [];
      console.log(`📊 Found ${learningPlans.length} learning plans from search`);
      
      if (learningPlans.length === 0) {
        throw new Error(`Learning plan not found: ${identifier}`);
      }

      // PRIORITY 1: Exact name match
      let exactMatch = learningPlans.find((lp: any) => {
        const lpName = this.getLearningPlanName(lp);
        const lpId = (lp.learning_plan_id || lp.id)?.toString();
        
        if (lpId === identifier.toString()) return true;
        return lpName.toLowerCase() === identifier.toLowerCase();
      });

      if (exactMatch) {
        console.log(`✅ EXACT MATCH: Found exact learning plan match: "${this.getLearningPlanName(exactMatch)}"`);
        return exactMatch;
      }

      // PRIORITY 2: Name starts with identifier
      const startsWithMatch = learningPlans.find((lp: any) => {
        const lpName = this.getLearningPlanName(lp);
        return lpName.toLowerCase().startsWith(identifier.toLowerCase());
      });

      if (startsWithMatch) {
        console.log(`✅ STARTS WITH: Found learning plan starting with "${identifier}": "${this.getLearningPlanName(startsWithMatch)}"`);
        return startsWithMatch;
      }

      // PRIORITY 3: Name contains identifier
      const containsMatch = learningPlans.find((lp: any) => {
        const lpName = this.getLearningPlanName(lp);
        return lpName.toLowerCase().includes(identifier.toLowerCase());
      });

      if (containsMatch) {
        console.log(`⚠️ PARTIAL MATCH: Using partial match: "${this.getLearningPlanName(containsMatch)}" for search "${identifier}"`);
        return containsMatch;
      }

      // Fallback to first result
      console.log(`⚠️ FALLBACK: No exact matches found, using first result: "${this.getLearningPlanName(learningPlans[0])}" for search "${identifier}"`);
      return learningPlans[0];

    } catch (error) {
      console.error(`❌ Error finding learning plan: ${identifier}`, error);
      throw error;
    }
  }

  // Helper method to map enrollment levels
  private mapEnrollmentLevel(level: string): number {
    const levelMap: { [key: string]: number } = {
      'student': 3,
      'learner': 3,
      'tutor': 4,
      'instructor': 6
    };
    
    return levelMap[level.toLowerCase()] || 3;
  }

  // Enhanced user search with better email matching
  async findUserByEmail(email: string): Promise<any> {
    try {
      console.log(`🔍 FIXED: Enhanced user search for: ${email}`);
      
      const exactSearch = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: email,
        page_size: 200
      });
      
      const users = exactSearch.data?.items || [];
      console.log(`📊 FIXED: Found ${users.length} users from search`);
      
      const exactMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase() === email.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`✅ FIXED: Found exact email match: ${exactMatch.fullname || 'No name'} (${exactMatch.email})`);
        return exactMatch;
      }
      
      const partialMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase().includes(email.toLowerCase())
      );
      
      if (partialMatch) {
        console.log(`⚠️ FIXED: Found partial email match: ${partialMatch.fullname || 'No name'} (${partialMatch.email})`);
        return partialMatch;
      }
      
      console.log(`❌ FIXED: No user found with email: ${email}`);
      return null;
      
    } catch (error) {
      console.error(`❌ FIXED: Error in findUserByEmail for ${email}:`, error);
      throw error;
    }
  }

  // Helper method to get user details by email
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

  // Helper method to format user details consistently
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
      
      firstName: userData.first_name,
      lastName: userData.last_name,
      uuid: userData.uuid,
      isManager: userData.is_manager || false,
      directManager: userData.manager_first_name && userData.manager_last_name 
        ? `${userData.manager_first_name} ${userData.manager_last_name}` 
        : null,
      managerUsername: userData.manager_username,
      managerId: userData.manager_id,
      
      jobRole: userData.field_1,
      googlerType: userData.field_2,
      organizationName: userData.field_4,
      team: userData.field_5,
      personId: userData.field_6,
      
      managers: userData.managers || [],
      managerNames: userData.manager_names || {},
      activeSubordinatesCount: userData.active_subordinates_count || 0
    };
  }

  // Helper method to map user status
  private mapUserStatus(status: any): string {
    if (status === 1 || status === '1' || status === 'active') return 'Active';
    if (status === 0 || status === '0' || status === 'inactive') return 'Inactive';
    if (status === 2 || status === '2' || status === 'suspended') return 'Suspended';
    return status?.toString() || 'Unknown';
  }

  // Helper method to map user level
  private mapUserLevel(level: any): string {
    if (level === 'godadmin') return 'Super Admin';
    if (level === 'power_user') return 'Power User';
    if (level === 'course_creator') return 'Course Creator';
    if (level === '3' || level === 3) return 'Student';
    return level?.toString() || 'User';
  }

  // Search users with proper field mapping
  async searchUsers(searchText: string, limit: number = 200): Promise<any[]> {
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

  // Search courses with proper endpoint and mapping
  async searchCourses(searchText: string, limit: number = 200): Promise<any[]> {
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

  // Search learning plans without problematic sort_attr
  async searchLearningPlans(searchText: string, limit: number = 200): Promise<any[]> {
    try {
      console.log(`🔍 FIXED: Searching learning plans: "${searchText}"`);
      
      let result;
      try {
        result = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
        if (result.data?.items?.length > 0) {
          console.log(`📊 FIXED: Found ${result.data.items.length} learning plans via search_text`);
          return result.data.items;
        }
      } catch (searchError) {
        console.log(`🔍 FIXED: search_text failed, trying manual filter...`);
      }
      
      const allResult = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        page_size: Math.min(limit * 5, 200)
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
      const courseEnrollments = await this.apiRequest('/course/v1/courses/enrollments', 'GET', null, {
        'user_id[]': userId,
        page_size: 200
      });

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
      const userResponse = await this.apiRequest(`/manage/v1/user/${userId}`, 'GET');
      const userData = userResponse.data;
      
      if (!userData) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      const basicDetails = this.formatUserDetails(userData);
      
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
