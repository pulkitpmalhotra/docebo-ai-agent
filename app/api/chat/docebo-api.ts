// app/api/chat/docebo-api.ts - COMPLETE Version 5 with Fixed Learning Plan Enrollment

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
    console.log(`🔄 FIXED: Attempting to enroll user ${userId} in course ${courseId}`);

    let levelValue: string | number = 3;
    if (options.level === 'tutor') levelValue = 4;
    else if (options.level === 'instructor') levelValue = 6;
    else levelValue = 3; // student

    const enrollmentData: any = {
      course_ids: [parseInt(courseId)],
      user_ids: [parseInt(userId)],
      level: levelValue.toString()
    };

    // FIXED: Only add assignment_type if it's explicitly provided and valid
    if (options.assignmentType && options.assignmentType !== 'none') {
      // Map assignment types to correct Docebo values
      const assignmentTypeMap: { [key: string]: string } = {
        'mandatory': 'mandatory',
        'required': 'mandatory',  // Map required to mandatory
        'recommended': 'recommended',
        'optional': 'optional'
      };
      
      const mappedType = assignmentTypeMap[options.assignmentType.toLowerCase()];
      if (mappedType) {
        enrollmentData.assignment_type = mappedType;
      }
    }

    // FIXED: Only add validity dates if provided
    if (options.startValidity) {
      enrollmentData.date_begin_validity = options.startValidity;
    }
    if (options.endValidity) {
      enrollmentData.date_expire_validity = options.endValidity;
    }

    console.log(`📋 FIXED: Course enrollment data:`, enrollmentData);
    
    const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentData);
    console.log(`✅ FIXED: Course enrollment successful:`, result);
    return result;

  } catch (error) {
    console.error(`❌ FIXED: Error enrolling user ${userId} in course ${courseId}:`, error);
    throw error;
  }
}

// FIXED: Learning Plan enrollment method
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
    console.log(`🔄 FIXED LP: Attempting to enroll user ${userId} in learning plan ${learningPlanId}`);

    const enrollmentData: any = {
      user_ids: [parseInt(userId)],
      learningplan_ids: [parseInt(learningPlanId)]
    };

    // FIXED: Only add assignment_type if explicitly provided and valid
    if (options.assignmentType && options.assignmentType !== 'none') {
      const assignmentTypeMap: { [key: string]: string } = {
        'mandatory': 'mandatory',
        'required': 'mandatory',  // Map required to mandatory
        'recommended': 'recommended', 
        'optional': 'optional'
      };
      
      const mappedType = assignmentTypeMap[options.assignmentType.toLowerCase()];
      if (mappedType) {
        enrollmentData.assignment_type = mappedType;
      }
    }

    // FIXED: Only add validity dates if provided
    if (options.startValidity) {
      enrollmentData.date_begin_validity = options.startValidity;
    }
    if (options.endValidity) {
      enrollmentData.date_expire_validity = options.endValidity;
    }

    console.log(`📋 FIXED LP: Using correct enrollment data:`, enrollmentData);
    
    // Try the correct learning plan enrollment endpoint first
    try {
      const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'POST', enrollmentData);
      console.log(`✅ FIXED LP: Learning plan enrollment successful via primary endpoint:`, result);
      return result;
    } catch (primaryError) {
      console.log(`❌ Primary LP endpoint failed, trying alternative:`, primaryError);
      
      // Alternative endpoint format (some Docebo instances use this)
      const alternativeData = {
        users: [parseInt(userId)],
        learning_plans: [parseInt(learningPlanId)]
      };
      
      // Only add assignment_type if provided
      if (options.assignmentType && options.assignmentType !== 'none') {
        const assignmentTypeMap: { [key: string]: string } = {
          'mandatory': 'mandatory',
          'required': 'mandatory',
          'recommended': 'recommended',
          'optional': 'optional'
        };
        
        const mappedType = assignmentTypeMap[options.assignmentType.toLowerCase()];
        if (mappedType) {
          alternativeData.assignment_type = mappedType;
        }
      }
      
      try {
        const result = await this.apiRequest('/learningplan/v1/enrollments', 'POST', alternativeData);
        console.log(`✅ FIXED LP: Learning plan enrollment successful via alternative endpoint:`, result);
        return result;
      } catch (alternativeError) {
        console.log(`❌ Alternative LP endpoint also failed:`, alternativeError);
        
        // Final fallback: some instances use the general enrollment endpoint differently
        const fallbackData = {
          learningplan_ids: [parseInt(learningPlanId)],
          user_ids: [parseInt(userId)]
        };
        
        // Only add assignment_type if provided
        if (options.assignmentType && options.assignmentType !== 'none') {
          const assignmentTypeMap: { [key: string]: string } = {
            'mandatory': 'mandatory',
            'required': 'mandatory',
            'recommended': 'recommended',
            'optional': 'optional'
          };
          
          const mappedType = assignmentTypeMap[options.assignmentType.toLowerCase()];
          if (mappedType) {
            fallbackData.assignment_type = mappedType;
          }
        }
        
        const result = await this.apiRequest('/learningplan/v1/bulk', 'POST', fallbackData);
        console.log(`✅ FIXED LP: Learning plan enrollment successful via fallback endpoint:`, result);
        return result;
      }
    }

  } catch (error) {
    console.error(`❌ FIXED LP: Error enrolling user ${userId} in learning plan ${learningPlanId}:`, error);
    throw error;
  }
}
  // FIXED: Unenroll user from course using the correct endpoint
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

  // FIXED: Unenroll user from learning plan using multiple fallback endpoints
  async unenrollUserFromLearningPlan(userId: string, learningPlanId: string): Promise<any> {
    try {
      console.log(`🔄 FIXED LP UNENROLL: Attempting to unenroll user ${userId} from learning plan ${learningPlanId}`);
      
      const unenrollmentBody = {
        user_ids: [parseInt(userId)],
        learningplan_ids: [parseInt(learningPlanId)],
        reset_tracks: false,
        cascade_unenroll_from_courses_in_selected_learning_plan: false,
        delete_issued_certificates: false
      };

      console.log(`📋 FIXED LP UNENROLL: Using DELETE /learningplan/v1/learningplans/enrollments with body:`, unenrollmentBody);
      
      // Try the primary learning plan unenrollment endpoint
      try {
        const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'DELETE', unenrollmentBody);
        console.log(`✅ FIXED LP UNENROLL: Learning plan unenrollment successful via primary endpoint:`, result);
        return result;
      } catch (primaryError) {
        console.log(`❌ Primary LP unenroll endpoint failed, trying alternative:`, primaryError);
        
        // Try alternative endpoint format
        try {
          const result = await this.apiRequest('/learningplan/v1/enrollments', 'DELETE', unenrollmentBody);
          console.log(`✅ FIXED LP UNENROLL: Learning plan unenrollment successful via alternative endpoint:`, result);
          return result;
        } catch (alternativeError) {
          console.log(`❌ Alternative LP unenroll endpoint also failed:`, alternativeError);
          
          // Try the generic unenrollment endpoint
          const genericBody = {
            learningplan_ids: [parseInt(learningPlanId)],
            user_ids: [parseInt(userId)],
            reset_tracks: false
          };
          
          const result = await this.apiRequest('/learn/v1/enrollments', 'DELETE', genericBody);
          console.log(`✅ FIXED LP UNENROLL: Learning plan unenrollment successful via generic endpoint:`, result);
          return result;
        }
      }

    } catch (error) {
      console.error(`❌ FIXED LP UNENROLL: Error unenrolling user ${userId} from learning plan ${learningPlanId}:`, error);
      throw error;
    }
  }

  // FIXED: Enhanced course search with EXACT matching and duplicate detection
  async findCourseByIdentifier(identifier: string): Promise<any> {
    try {
      console.log(`🔍 EXACT COURSE SEARCH: Finding course: "${identifier}"`);
      
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
          throw new Error(`Course with ID ${identifier} not found`);
        }
      }

      // Search by name/keyword with comprehensive search
      console.log(`🔍 Searching courses by name: "${identifier}"`);
      const searchResult = await this.apiRequest('/course/v1/courses', 'GET', null, {
        search_text: identifier,
        page_size: 200, // Get more results to catch all matches
        sort_attr: 'name',
        sort_dir: 'asc'
      });
      
      const courses = searchResult.data?.items || [];
      console.log(`📊 Found ${courses.length} courses from search`);
      
      if (courses.length === 0) {
        throw new Error(`No courses found matching: "${identifier}"`);
      }

      // PRIORITY 1: Find EXACT title/name matches (case-insensitive)
      const exactMatches = courses.filter((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase() === identifier.toLowerCase();
      });

      console.log(`🎯 EXACT MATCHES: Found ${exactMatches.length} exact matches`);

      if (exactMatches.length === 1) {
        console.log(`✅ SINGLE EXACT MATCH: Found exact course match: "${this.getCourseName(exactMatches[0])}"`);
        return this.enrichCourseData(exactMatches[0]);
      } else if (exactMatches.length > 1) {
        // Multiple exact matches - this is an error condition
        const courseNames = exactMatches.map((course: any) => `"${this.getCourseName(course)}" (ID: ${course.id || course.course_id})`);
        console.log(`❌ MULTIPLE EXACT MATCHES: Found ${exactMatches.length} courses with same name`);
        throw new Error(`Multiple courses found with the exact name "${identifier}". Please use course ID instead. Found courses: ${courseNames.join(', ')}`);
      }

      // PRIORITY 2: Find EXACT code matches
      const exactCodeMatches = courses.filter((course: any) => {
        const courseCode = course.code || '';
        return courseCode.toLowerCase() === identifier.toLowerCase();
      });

      console.log(`🏷️ CODE MATCHES: Found ${exactCodeMatches.length} exact code matches`);

      if (exactCodeMatches.length === 1) {
        console.log(`✅ SINGLE CODE MATCH: Found exact code match: "${this.getCourseName(exactCodeMatches[0])}" (${exactCodeMatches[0].code})`);
        return this.enrichCourseData(exactCodeMatches[0]);
      } else if (exactCodeMatches.length > 1) {
        const courseNames = exactCodeMatches.map((course: any) => `"${this.getCourseName(course)}" (Code: ${course.code})`);
        console.log(`❌ MULTIPLE CODE MATCHES: Found ${exactCodeMatches.length} courses with same code`);
        throw new Error(`Multiple courses found with the exact code "${identifier}". Please use course ID instead. Found courses: ${courseNames.join(', ')}`);
      }

      // NO EXACT MATCHES FOUND - Return error with suggestions
      console.log(`❌ NO EXACT MATCHES: No exact matches found for "${identifier}"`);
      
      // Show partial matches as suggestions
      const partialMatches = courses.filter((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase().includes(identifier.toLowerCase());
      }).slice(0, 5);

      if (partialMatches.length > 0) {
        const suggestions = partialMatches.map((course: any) => 
          `"${this.getCourseName(course)}" (ID: ${course.id || course.course_id})`
        );
        throw new Error(`No exact match found for course "${identifier}". Did you mean one of these? ${suggestions.join(', ')}. For exact matching, use the complete course name or course ID.`);
      }

      throw new Error(`Course "${identifier}" not found. Please check the course name spelling or use the course ID for exact matching.`);

    } catch (error) {
      console.error(`❌ Error in findCourseByIdentifier: ${identifier}`, error);
      throw error;
    }
  }

  // FIXED: Enhanced learning plan search with EXACT matching and duplicate detection
  async findLearningPlanByIdentifier(identifier: string): Promise<any> {
  try {
    console.log(`🔍 EXACT LP SEARCH: Finding learning plan: "${identifier}"`);
    
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
        throw new Error(`Learning plan with ID ${identifier} not found`);
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
        
        return name.includes(searchLower) || description.includes(searchLower);
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
      throw new Error(`No learning plans found matching: "${identifier}"`);
    }

    // FIXED: Better matching logic for numbered learning plans
    // PRIORITY 1: Find EXACT name matches (case-insensitive)
    const exactMatches = learningPlans.filter((lp: any) => {
      const lpName = this.getLearningPlanName(lp);
      return lpName.toLowerCase() === identifier.toLowerCase();
    });

    console.log(`🎯 EXACT MATCHES: Found ${exactMatches.length} exact matches`);

    if (exactMatches.length === 1) {
      console.log(`✅ SINGLE EXACT MATCH: Found exact learning plan match: "${this.getLearningPlanName(exactMatches[0])}"`);
      return exactMatches[0];
    } else if (exactMatches.length > 1) {
      const lpNames = exactMatches.map((lp: any) => 
        `"${this.getLearningPlanName(lp)}" (ID: ${lp.learning_plan_id || lp.id})`
      );
      console.log(`❌ MULTIPLE EXACT MATCHES: Found ${exactMatches.length} learning plans with same name`);
      throw new Error(`Multiple learning plans found with the exact name "${identifier}". Please use learning plan ID instead. Found plans: ${lpNames.join(', ')}`);
    }

    // FIXED: Better partial matching for numbered names
    const partialMatches = learningPlans.filter((lp: any) => {
      const lpName = this.getLearningPlanName(lp);
      const lpNameLower = lpName.toLowerCase();
      const identifierLower = identifier.toLowerCase();
      
      // Check if the identifier is contained in the learning plan name
      // This handles cases like "4." matching "4. Navigate Your Workflows Effectively"
      return lpNameLower.includes(identifierLower) || identifierLower.includes(lpNameLower);
    });

    if (partialMatches.length === 1) {
      console.log(`✅ SINGLE PARTIAL MATCH: Found learning plan: "${this.getLearningPlanName(partialMatches[0])}"`);
      return partialMatches[0];
    }

    // NO EXACT MATCHES FOUND - Return error with suggestions
    console.log(`❌ NO EXACT MATCHES: No exact matches found for "${identifier}"`);
    
    // Show best matches as suggestions
    const suggestions = partialMatches.slice(0, 5).map((lp: any) => 
      `"${this.getLearningPlanName(lp)}" (ID: ${lp.learning_plan_id || lp.id})`
    );

    if (suggestions.length > 0) {
      throw new Error(`No exact match found for learning plan "${identifier}". Did you mean one of these? ${suggestions.join(', ')}. For exact matching, use the complete learning plan name or ID.`);
    }

    throw new Error(`Learning plan "${identifier}" not found. Please check the learning plan name spelling or use the learning plan ID for exact matching.`);

  } catch (error) {
    console.error(`❌ Error in findLearningPlanByIdentifier: ${identifier}`, error);
    throw error;
  }
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
