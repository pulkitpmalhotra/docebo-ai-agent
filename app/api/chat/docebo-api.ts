// app/api/chat/docebo-api.ts - FIXED TypeScript types

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

  getLearningPlanName(learningPlan: any): string {
    return learningPlan.title || 
           learningPlan.name || 
           learningPlan.learning_plan_name || 
           learningPlan.lp_name || 
           learningPlan.learningplan_name ||
           learningPlan.plan_name ||
           'Unknown Learning Plan';
  }

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
  'required': 'required',  // Keep as required, don't map to mandatory
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

  // FIXED: Learning Plan enrollment method with proper typing
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
      console.log(`🔄 FIXED LP: Individual enrollment - user ${userId} in learning plan ${learningPlanId}`);
      console.log(`🔧 FIXED LP: Options:`, options);

      // FIXED: Properly typed enrollment data with explicit interface
      const enrollmentData: {
        items: {
          user_ids: number[];
        };
        options: {
          assignment_type?: string;
          validity_start_at?: string;
          validity_end_at?: string;
        };
      } = {
        items: {
          user_ids: [parseInt(userId)]
        },
        options: {}
      };

      // FIXED: Support ALL assignment types or default to empty (no assignment type)
      if (options.assignmentType && options.assignmentType.toLowerCase() !== 'none') {
        const assignmentTypeMap: { [key: string]: string } = {
          'mandatory': 'mandatory',
          'required': 'required',
          'recommended': 'recommended',
          'optional': 'optional'
        };
        
        const mappedType = assignmentTypeMap[options.assignmentType.toLowerCase()];
        if (mappedType) {
          enrollmentData.options.assignment_type = mappedType;
          console.log(`📋 FIXED LP: Using assignment type: ${mappedType}`);
        }
      } else {
        console.log(`📋 FIXED LP: No assignment type specified - using default (empty)`);
      }

      // Add validity dates with correct UTC format
      if (options.startValidity) {
        enrollmentData.options.validity_start_at = `${options.startValidity} 00:00:00`;
        console.log(`📅 FIXED LP: Start validity: ${enrollmentData.options.validity_start_at}`);
      }
      if (options.endValidity) {
        enrollmentData.options.validity_end_at = `${options.endValidity} 23:59:59`;
        console.log(`📅 FIXED LP: End validity: ${enrollmentData.options.validity_end_at}`);
      }

      console.log(`📋 FIXED LP: Final enrollment data:`, JSON.stringify(enrollmentData, null, 2));
      
      const result = await this.apiRequest(
        `/learningplan/v1/learningplans/${learningPlanId}/enrollments/bulk`, 
        'POST', 
        enrollmentData
      );
      
      console.log(`✅ FIXED LP: Individual enrollment successful:`, result);
      return result;

    } catch (error) {
      console.error(`❌ FIXED LP: Individual enrollment error for user ${userId}:`, error);
      throw error;
    }
  }

  // FIXED: Unenroll user from course using the correct endpoint
async unenrollUserFromCourse(userId: string, courseId: string): Promise<any> {
    try {
      console.log(`🔄 ENHANCED UNENROLL: Attempting to unenroll user ${userId} from course ${courseId}`);
      
      // Method 1: Use the primary unenrollment endpoint
      const unenrollmentBody = {
        user_ids: [parseInt(userId)],
        course_ids: [parseInt(courseId)],
        reset_tracks: false,
        delete_issued_certificates: false
      };

      console.log(`📋 ENHANCED UNENROLL: Using DELETE /learn/v1/enrollments with body:`, unenrollmentBody);
      
      try {
        const result = await this.apiRequest('/learn/v1/enrollments', 'DELETE', unenrollmentBody);
        console.log(`✅ ENHANCED UNENROLL: Course unenrollment successful via primary endpoint:`, result);
        return result;
      } catch (primaryError) {
        console.log(`❌ Primary unenroll endpoint failed:`, primaryError);
        
        // Method 2: Try alternative endpoint structure
        try {
          const alternativeBody = {
            enrollments: [
              {
                user_id: parseInt(userId),
                course_id: parseInt(courseId)
              }
            ],
            reset_tracks: false,
            delete_issued_certificates: false
          };
          
          const result = await this.apiRequest('/course/v1/courses/enrollments', 'DELETE', alternativeBody);
          console.log(`✅ ENHANCED UNENROLL: Course unenrollment successful via alternative endpoint:`, result);
          return result;
        } catch (alternativeError) {
          console.log(`❌ Alternative unenroll endpoint also failed:`, alternativeError);
          
          // Method 3: Try individual course unenrollment
          try {
            const individualResult = await this.apiRequest(`/course/v1/courses/${courseId}/enrollments/${userId}`, 'DELETE');
            console.log(`✅ ENHANCED UNENROLL: Course unenrollment successful via individual endpoint:`, individualResult);
            return individualResult;
          } catch (individualError) {
            console.error(`❌ All unenrollment methods failed:`, individualError);
            throw new Error(`Failed to unenroll user from course. The user may not be enrolled in this course, or there may be a permissions issue.`);
          }
        }
      }

    } catch (error) {
      console.error(`❌ ENHANCED UNENROLL: Error unenrolling user ${userId} from course ${courseId}:`, error);
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
      console.log(`🔍 ENHANCED COURSE SEARCH: Finding course: "${identifier}"`);
      
      // Method 1: Try direct ID lookup if it's numeric
      if (/^\d+$/.test(identifier)) {
        try {
          console.log(`🆔 Direct course lookup by ID: ${identifier}`);
          const directResult = await this.apiRequest(`/course/v1/courses/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ Found course by direct ID lookup`);
            return this.enrichCourseData(directResult.data);
          }
        } catch (directError) {
          console.log(`❌ Direct course lookup failed for ID ${identifier}:`, directError);
          throw new Error(`Course with ID ${identifier} not found`);
        }
      }

      // Method 2: Search by name/keyword with comprehensive search
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
        // Multiple exact matches - provide detailed error with IDs
        const courseDetails = exactMatches.map((course: any) => 
          `"${this.getCourseName(course)}" (ID: ${course.id || course.course_id})`
        );
        console.log(`❌ MULTIPLE EXACT MATCHES: Found ${exactMatches.length} courses with same name`);
        throw new Error(`Multiple courses found with the exact name "${identifier}". Please use course ID instead. Found courses: ${courseDetails.join(', ')}`);
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
      }

      // PRIORITY 3: If no exact matches, try partial matching but be very careful
      const partialMatches = courses.filter((course: any) => {
        const courseName = this.getCourseName(course);
        return courseName.toLowerCase().includes(identifier.toLowerCase());
      });

      if (partialMatches.length === 1) {
        console.log(`⚠️ SINGLE PARTIAL MATCH: Found partial match: "${this.getCourseName(partialMatches[0])}"`);
        return this.enrichCourseData(partialMatches[0]);
      }

      // NO CLEAR MATCH FOUND - Return detailed error with suggestions
      console.log(`❌ NO CLEAR MATCH: No clear match found for "${identifier}"`);
      
      // Show best matches as suggestions (limit to top 5)
      const suggestions = courses.slice(0, 5).map((course: any) => 
        `"${this.getCourseName(course)}" (ID: ${course.id || course.course_id})`
      );

      if (suggestions.length > 0) {
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
      console.log(`🔍 ENHANCED LP SEARCH: Finding learning plan: "${identifier}"`);
      
      // Method 1: Direct ID lookup if it's numeric
      if (/^\d+$/.test(identifier)) {
        try {
          console.log(`🆔 ENHANCED LP: Direct lookup by ID: ${identifier}`);
          const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ ENHANCED LP: Found by direct ID lookup`);
            return directResult.data;
          }
        } catch (directError) {
          console.log(`❌ ENHANCED LP: Direct ID lookup failed for ${identifier}, trying search...`);
        }
      }

      // Method 2: Search by name/keyword
      console.log(`🔍 ENHANCED LP: Searching by name/keyword: "${identifier}"`);
      let searchResult;
      
      try {
        searchResult = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          search_text: identifier,
          page_size: 200
        });
      } catch (searchError) {
        console.log('ENHANCED LP: Direct search failed, trying fallback method...');
        
        // Fallback: Get all and filter manually
        searchResult = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          page_size: 200
        });
        
        const allItems = searchResult.data?.items || [];
        const filteredItems = allItems.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          const code = (lp.code || '').toLowerCase();
          const searchLower = identifier.toLowerCase();
          
          return name.includes(searchLower) || 
                 description.includes(searchLower) ||
                 code === searchLower;
        });
        
        searchResult = {
          data: {
            items: filteredItems,
            total_count: filteredItems.length
          }
        };
      }
      
      const learningPlans = searchResult.data?.items || [];
      console.log(`📊 ENHANCED LP: Found ${learningPlans.length} learning plans from search`);
      
      if (learningPlans.length === 0) {
        throw new Error(`No learning plans found matching: "${identifier}"`);
      }

      // PRIORITY 1: Find EXACT matches (ID, name, or code)
      const exactMatches = learningPlans.filter((lp: any) => {
        const lpName = this.getLearningPlanName(lp);
        const lpId = (lp.learning_plan_id || lp.id)?.toString();
        const lpCode = lp.code || '';
        
        // Exact matches
        return lpId === identifier ||
               lpName.toLowerCase() === identifier.toLowerCase() ||
               lpCode.toLowerCase() === identifier.toLowerCase();
      });

      console.log(`🎯 ENHANCED LP: Found ${exactMatches.length} exact matches`);

      if (exactMatches.length === 1) {
        const match = exactMatches[0];
        console.log(`✅ ENHANCED LP: Single exact match found: "${this.getLearningPlanName(match)}" (ID: ${match.learning_plan_id || match.id}, Code: ${match.code || 'N/A'})`);
        return match;
      } else if (exactMatches.length > 1) {
        const lpNames = exactMatches.map((lp: any) => 
          `"${this.getLearningPlanName(lp)}" (ID: ${lp.learning_plan_id || lp.id}, Code: ${lp.code || 'N/A'})`
        );
        console.log(`❌ ENHANCED LP: Multiple exact matches found`);
        throw new Error(`Multiple learning plans found matching "${identifier}". Please be more specific. Found: ${lpNames.join(', ')}`);
      }

      // PRIORITY 2: Partial matches for names (but not for numeric IDs)
      if (!/^\d+$/.test(identifier)) {
        const partialMatches = learningPlans.filter((lp: any) => {
          const lpName = this.getLearningPlanName(lp);
          return lpName.toLowerCase().includes(identifier.toLowerCase());
        });

        if (partialMatches.length === 1) {
          const match = partialMatches[0];
          console.log(`✅ ENHANCED LP: Single partial match found: "${this.getLearningPlanName(match)}"`);
          return match;
        }
      }

      // NO EXACT MATCHES FOUND - Return error with suggestions
      console.log(`❌ ENHANCED LP: No exact matches found for "${identifier}"`);
      
      // Show best matches as suggestions
      const suggestions = learningPlans.slice(0, 5).map((lp: any) => 
        `"${this.getLearningPlanName(lp)}" (ID: ${lp.learning_plan_id || lp.id}, Code: ${lp.code || 'N/A'})`
      );

      if (suggestions.length > 0) {
        throw new Error(`No exact match found for learning plan "${identifier}". Did you mean one of these?\n${suggestions.join('\n')}\n\nFor exact matching, use the complete learning plan name, ID, or code.`);
      }

      throw new Error(`Learning plan "${identifier}" not found. Please check the name, ID, or code.`);

    } catch (error) {
      console.error(`❌ ENHANCED LP: Error in findLearningPlanByIdentifier: ${identifier}`, error);
      throw error;
    }
  }

  // Enhanced user search with better email matching
  async findUserByEmail(email: string): Promise<any> {
    try {
      console.log(`🔍 ENHANCED USER SEARCH: Finding user by email: ${email}`);
      
      // Method 1: Direct search with exact email
      const exactSearch = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: email,
        page_size: 200
      });
      
      const users = exactSearch.data?.items || [];
      console.log(`📊 ENHANCED USER SEARCH: Found ${users.length} users from search`);
      
      // Look for exact email match first
      const exactMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase() === email.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`✅ ENHANCED USER SEARCH: Found exact email match: ${exactMatch.fullname || 'No name'} (${exactMatch.email})`);
        return exactMatch;
      }
      
      // If no exact match, look for partial matches but be careful
      const partialMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase().includes(email.toLowerCase())
      );
      
      if (partialMatch) {
        console.log(`⚠️ ENHANCED USER SEARCH: Found partial email match: ${partialMatch.fullname || 'No name'} (${partialMatch.email})`);
        return partialMatch;
      }
      
      console.log(`❌ ENHANCED USER SEARCH: No user found with email: ${email}`);
      return null;
      
    } catch (error) {
      console.error(`❌ ENHANCED USER SEARCH: Error in findUserByEmail for ${email}:`, error);
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
// Create ILT Session
async createILTSession(sessionData: any): Promise<any> {
  try {
    console.log(`🎓 Creating ILT session:`, sessionData);
    
    // Primary endpoint for creating classroom sessions
    const result = await this.apiRequest('/learn/v1/sessions', 'POST', sessionData);
    
    console.log(`✅ ILT session created successfully:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Error creating ILT session:`, error);
    
    // Try alternative endpoint if primary fails
    try {
      console.log(`🔄 Trying alternative ILT session creation endpoint...`);
      
      const alternativeResult = await this.apiRequest('/course/v1/courses/sessions', 'POST', sessionData);
      console.log(`✅ ILT session created via alternative endpoint:`, alternativeResult);
      return alternativeResult;
      
    } catch (alternativeError) {
      console.error(`❌ Alternative ILT session creation also failed:`, alternativeError);
      throw error; // Throw original error
    }
  }
}

// Get ILT Session by ID
async getILTSession(sessionId: string): Promise<any> {
  try {
    console.log(`🔍 Getting ILT session: ${sessionId}`);
    
    const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}`, 'GET');
    
    if (result.data) {
      console.log(`✅ Found ILT session: ${result.data.name || result.data.session_name}`);
      return result.data;
    }
    
    throw new Error(`Session ${sessionId} not found`);
    
  } catch (error) {
    console.error(`❌ Error getting ILT session ${sessionId}:`, error);
    throw error;
  }
}

// Find ILT Session by Name
async findILTSessionByName(sessionName: string): Promise<any> {
  try {
    console.log(`🔍 Finding ILT session by name: "${sessionName}"`);
    
    // Search for sessions
    const searchResult = await this.apiRequest('/learn/v1/sessions', 'GET', null, {
      search_text: sessionName,
      page_size: 50
    });
    
    const sessions = searchResult.data?.items || [];
    console.log(`📊 Found ${sessions.length} sessions from search`);
    
    if (sessions.length === 0) {
      throw new Error(`No ILT sessions found matching: "${sessionName}"`);
    }
    
    // Look for exact match first
    const exactMatch = sessions.find((session: any) => {
      const name = session.name || session.session_name || '';
      return name.toLowerCase() === sessionName.toLowerCase();
    });
    
    if (exactMatch) {
      console.log(`✅ Found exact ILT session match: "${exactMatch.name || exactMatch.session_name}"`);
      return exactMatch;
    }
    
    // If no exact match, try partial match
    const partialMatch = sessions.find((session: any) => {
      const name = session.name || session.session_name || '';
      return name.toLowerCase().includes(sessionName.toLowerCase());
    });
    
    if (partialMatch) {
      console.log(`⚠️ Found partial ILT session match: "${partialMatch.name || partialMatch.session_name}"`);
      return partialMatch;
    }
    
    // Show available sessions for guidance
    const sessionList = sessions.slice(0, 5).map((s: any) => 
      `"${s.name || s.session_name}" (ID: ${s.id || s.session_id})`
    );
    
    throw new Error(`No exact match for session "${sessionName}". Available sessions: ${sessionList.join(', ')}`);
    
  } catch (error) {
    console.error(`❌ Error finding ILT session by name: ${sessionName}`, error);
    throw error;
  }
}

// Get ILT Sessions for Course
async getILTSessionsForCourse(courseIdentifier: string): Promise<any[]> {
  try {
    console.log(`🔍 Getting ILT sessions for course: ${courseIdentifier}`);
    
    let courseId = courseIdentifier;
    
    // If not numeric, find course first
    if (!/^\d+$/.test(courseIdentifier)) {
      const course = await this.findCourseByIdentifier(courseIdentifier);
      courseId = course.id || course.course_id || course.idCourse;
    }
    
    // Get sessions for the course
    const result = await this.apiRequest('/learn/v1/sessions', 'GET', null, {
      course_id: courseId,
      page_size: 100
    });
    
    const sessions = result.data?.items || [];
    console.log(`📊 Found ${sessions.length} ILT sessions for course ${courseId}`);
    
    return sessions;
    
  } catch (error) {
    console.error(`❌ Error getting ILT sessions for course ${courseIdentifier}:`, error);
    throw error;
  }
}

// Enroll User in ILT Session
async enrollUserInILTSession(userId: string, sessionId: string): Promise<any> {
  try {
    console.log(`🎓 Enrolling user ${userId} in ILT session ${sessionId}`);
    
    const enrollmentData = {
      user_ids: [parseInt(userId)],
      session_id: parseInt(sessionId),
      enrollment_status: 'enrolled',
      waiting_list: false
    };
    
    // Try primary enrollment endpoint
    try {
      const result = await this.apiRequest('/learn/v1/sessions/enrollments', 'POST', enrollmentData);
      console.log(`✅ ILT session enrollment successful:`, result);
      return result;
      
    } catch (primaryError) {
      console.log(`❌ Primary ILT enrollment endpoint failed, trying alternative...`);
      
      // Try alternative endpoint structure
      const alternativeData = {
        enrollments: [
          {
            user_id: parseInt(userId),
            session_id: parseInt(sessionId),
            status: 'enrolled'
          }
        ]
      };
      
      const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}/enrollments`, 'POST', alternativeData);
      console.log(`✅ ILT session enrollment successful via alternative endpoint:`, result);
      return result;
    }
    
  } catch (error) {
    console.error(`❌ Error enrolling user ${userId} in ILT session ${sessionId}:`, error);
    throw error;
  }
}

// Unenroll User from ILT Session
async unenrollUserFromILTSession(userId: string, sessionId: string): Promise<any> {
  try {
    console.log(`🎓 Unenrolling user ${userId} from ILT session ${sessionId}`);
    
    const unenrollmentData = {
      user_ids: [parseInt(userId)],
      session_id: parseInt(sessionId)
    };
    
    // Try primary unenrollment endpoint
    try {
      const result = await this.apiRequest('/learn/v1/sessions/enrollments', 'DELETE', unenrollmentData);
      console.log(`✅ ILT session unenrollment successful:`, result);
      return result;
      
    } catch (primaryError) {
      console.log(`❌ Primary ILT unenrollment endpoint failed, trying alternative...`);
      
      // Try alternative endpoint
      const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}/enrollments/${userId}`, 'DELETE');
      console.log(`✅ ILT session unenrollment successful via alternative endpoint:`, result);
      return result;
    }
    
  } catch (error) {
    console.error(`❌ Error unenrolling user ${userId} from ILT session ${sessionId}:`, error);
    throw error;
  }
}

// Mark ILT Session Attendance
async markILTSessionAttendance(attendanceData: any): Promise<any> {
  try {
    console.log(`📋 Marking ILT session attendance:`, attendanceData);
    
    const { user_id, session_id, attendance_status, completion_status, marked_date } = attendanceData;
    
    const attendancePayload = {
      user_id: parseInt(user_id),
      session_id: parseInt(session_id),
      attendance_status: attendance_status || 'attended',
      completion_status: completion_status || 'completed',
      attendance_date: marked_date || new Date().toISOString(),
      score: completion_status === 'completed' ? 100 : null
    };
    
    // Try primary attendance marking endpoint
    try {
      const result = await this.apiRequest('/learn/v1/sessions/attendance', 'POST', attendancePayload);
      console.log(`✅ ILT session attendance marked successfully:`, result);
      return result;
      
    } catch (primaryError) {
      console.log(`❌ Primary attendance endpoint failed, trying alternative...`);
      
      // Try alternative endpoint structure
      const alternativePayload = {
        attendances: [attendancePayload]
      };
      
      const result = await this.apiRequest(`/learn/v1/sessions/${session_id}/attendance`, 'POST', alternativePayload);
      console.log(`✅ ILT session attendance marked via alternative endpoint:`, result);
      return result;
    }
    
  } catch (error) {
    console.error(`❌ Error marking ILT session attendance:`, error);
    throw error;
  }
}

// Get ILT Session Participants
async getILTSessionParticipants(sessionId: string): Promise<any> {
  try {
    console.log(`👥 Getting participants for ILT session ${sessionId}`);
    
    const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}/enrollments`, 'GET', null, {
      page_size: 200
    });
    
    const participants = result.data?.items || [];
    console.log(`👥 Found ${participants.length} participants in session ${sessionId}`);
    
    return participants;
    
  } catch (error) {
    console.error(`❌ Error getting ILT session participants for ${sessionId}:`, error);
    throw error;
  }
}

// Get ILT Session Attendance
async getILTSessionAttendance(sessionId: string): Promise<any> {
  try {
    console.log(`📋 Getting attendance for ILT session ${sessionId}`);
    
    const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}/attendance`, 'GET', null, {
      page_size: 200
    });
    
    const attendance = result.data?.items || [];
    console.log(`📋 Found ${attendance.length} attendance records for session ${sessionId}`);
    
    return attendance;
    
  } catch (error) {
    console.error(`❌ Error getting ILT session attendance for ${sessionId}:`, error);
    throw error;
  }
}

// Update ILT Session
async updateILTSession(sessionId: string, updateData: any): Promise<any> {
  try {
    console.log(`📝 Updating ILT session ${sessionId}:`, updateData);
    
    const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}`, 'PUT', updateData);
    console.log(`✅ ILT session updated successfully:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Error updating ILT session ${sessionId}:`, error);
    throw error;
  }
}

// Delete ILT Session
async deleteILTSession(sessionId: string): Promise<any> {
  try {
    console.log(`🗑️ Deleting ILT session ${sessionId}`);
    
    const result = await this.apiRequest(`/learn/v1/sessions/${sessionId}`, 'DELETE');
    console.log(`✅ ILT session deleted successfully:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Error deleting ILT session ${sessionId}:`, error);
    throw error;
  }
}

// List All ILT Sessions
async listILTSessions(filters: any = {}): Promise<any> {
  try {
    console.log(`📋 Listing ILT sessions with filters:`, filters);
    
    const params = {
      page_size: filters.limit || 50,
      page: filters.page || 1,
      ...filters
    };
    
    const result = await this.apiRequest('/learn/v1/sessions', 'GET', null, params);
    
    const sessions = result.data?.items || [];
    console.log(`📋 Found ${sessions.length} ILT sessions`);
    
    return {
      sessions: sessions,
      total: result.data?.total_count || sessions.length,
      page: params.page,
      pageSize: params.page_size
    };
    
  } catch (error) {
    console.error(`❌ Error listing ILT sessions:`, error);
    throw error;
  }
}
