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

// app/api/chat/docebo-api.ts - FIXED enrollment methods

// Replace the existing enrollment methods with these corrected versions:

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
      console.log(`🔄 ENROLLING: User ${userId} -> Course ${courseId}`, options);
      
      // Primary endpoint attempt
      const primaryBody = {
        course_ids: [parseInt(courseId)],
        user_ids: [parseInt(userId)],
        level: options.level === 'instructor' ? 6 : (options.level === 'tutor' ? 4 : 3),
        assignment_type: options.assignmentType || 'required'
      };

      console.log(`📋 PRIMARY REQUEST:`, JSON.stringify(primaryBody, null, 2));

      try {
        const result = await this.apiRequest('/learn/v1/enrollments', 'POST', primaryBody);
        console.log(`✅ PRIMARY SUCCESS:`, result);
        return result;
      } catch (primaryError) {
        console.log(`❌ PRIMARY FAILED:`, primaryError);
        
        // Alternative endpoint attempt
        const altBody = {
          users: [parseInt(userId)],
          courses: [parseInt(courseId)],
          level: options.level === 'instructor' ? 6 : (options.level === 'tutor' ? 4 : 3),
          assignment_type: options.assignmentType || 'required'
        };

        console.log(`📋 ALTERNATIVE REQUEST:`, JSON.stringify(altBody, null, 2));

        try {
          const altResult = await this.apiRequest('/learn/v1/enrollments', 'POST', altBody);
          console.log(`✅ ALTERNATIVE SUCCESS:`, altResult);
          return altResult;
        } catch (altError) {
          console.log(`❌ ALTERNATIVE FAILED:`, altError);
          
          // Final attempt with different endpoint
          try {
            const finalResult = await this.apiRequest('/course/v1/courses/enrollments', 'POST', {
              user_id: parseInt(userId),
              course_id: parseInt(courseId),
              level: options.level === 'instructor' ? 6 : (options.level === 'tutor' ? 4 : 3)
            });
            console.log(`✅ FINAL ENDPOINT SUCCESS:`, finalResult);
            return finalResult;
          } catch (finalError) {
            console.error(`❌ ALL ENDPOINTS FAILED:`, {
              primary: primaryError,
              alternative: altError,
              final: finalError
            });
            throw new Error(`All course enrollment endpoints failed. Check user ID ${userId}, course ID ${courseId}, and API permissions.`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ COURSE ENROLLMENT ERROR:`, error);
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
      console.log(`🔄 LP ENROLLING: User ${userId} -> LP ${learningPlanId}`, options);
      
      // Primary LP endpoint attempt
      const primaryBody = {
        user_ids: [parseInt(userId)],
        learningplan_ids: [parseInt(learningPlanId)],
        assignment_type: options.assignmentType || 'required'
      };

      console.log(`📋 LP PRIMARY REQUEST:`, JSON.stringify(primaryBody, null, 2));

      try {
        const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'POST', primaryBody);
        console.log(`✅ LP PRIMARY SUCCESS:`, result);
        return result;
      } catch (primaryError) {
        console.log(`❌ LP PRIMARY FAILED:`, primaryError);
        
        // Alternative LP endpoint attempt
        const altBody = {
          users: [parseInt(userId)],
          learning_plans: [parseInt(learningPlanId)],
          assignment_type: options.assignmentType || 'required'
        };

        console.log(`📋 LP ALTERNATIVE REQUEST:`, JSON.stringify(altBody, null, 2));

        try {
          const altResult = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'POST', altBody);
          console.log(`✅ LP ALTERNATIVE SUCCESS:`, altResult);
          return altResult;
        } catch (altError) {
          console.error(`❌ ALL LP ENDPOINTS FAILED:`, {
            primary: primaryError,
            alternative: altError
          });
          throw new Error(`All learning plan enrollment endpoints failed. Check user ID ${userId}, learning plan ID ${learningPlanId}, and API permissions.`);
        }
      }
    } catch (error) {
      console.error(`❌ LP ENROLLMENT ERROR:`, error);
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
      console.log(`🔍 Enhanced user search for: ${email}`);
      
      // Try exact email search first
      const exactSearch = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: email,
        page_size: 50
      });
      
      const users = exactSearch.data?.items || [];
      console.log(`📊 Found ${users.length} users from search`);
      
      // Find exact email match (case-insensitive)
      const exactMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase() === email.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`✅ Found exact email match: ${exactMatch.fullname} (${exactMatch.email})`);
        return exactMatch;
      }
      
      // If no exact match found, try partial matching
      const partialMatch = users.find((u: any) => 
        u.email && u.email.toLowerCase().includes(email.toLowerCase())
      );
      
      if (partialMatch) {
        console.log(`⚠️ Found partial email match: ${partialMatch.fullname} (${partialMatch.email})`);
        return partialMatch;
      }
      
      // No match found
      console.log(`❌ No user found with email: ${email}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error in findUserByEmail for ${email}:`, error);
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

      // Helper function to extract course name
      const getCourseName = (course: any): string => {
        return course.name || 
               course.title || 
               course.course_name || 
               'Unknown Course';
      };

      // Find best match (exact name match first, then partial)
      const exactMatch = courses.find((course: any) => {
        const courseName = getCourseName(course);
        return courseName.toLowerCase() === identifier.toLowerCase();
      });

      if (exactMatch) {
        console.log(`✅ Found exact course match: ${getCourseName(exactMatch)}`);
        return this.enrichCourseData(exactMatch);
      }

      // Try partial match
      const partialMatch = courses.find((course: any) => {
        const courseName = getCourseName(course);
        return courseName.toLowerCase().includes(identifier.toLowerCase());
      });

      if (partialMatch) {
        console.log(`⚠️ Found partial course match: ${getCourseName(partialMatch)}`);
        return this.enrichCourseData(partialMatch);
      }

      // Return first result as fallback
      console.log(`🔄 Using first result as fallback: ${getCourseName(courses[0])}`);
      return this.enrichCourseData(courses[0]);

    } catch (error) {
      console.error(`❌ Error finding course: ${identifier}`, error);
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
