import { DoceboConfig, UserDetails, EnhancedUserDetails } from './types';
export class DoceboAPI {
  private config: DoceboConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;
  constructor(config: DoceboConfig) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
  }
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }
    try {
      const response = await fetch(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
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
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      console.error('Error fetching access token:', error);
      throw error;
    }
  }
  private formatUserDetails(user: any): UserDetails {
    console.log('🔍 Raw user data received:', JSON.stringify(user, null, 2));
    // Handle different possible field names from Docebo API
    const userId = (user.user_id || user.id || '').toString();
    const email = user.email || user.emailAddress || user.email_address || '';
    // Build fullname from available fields
    let fullname = user.fullname || user.full_name || user.displayName || user.display_name || '';
    if (!fullname) {
      const firstName = user.first_name || user.firstName || user.fname || '';
      const lastName = user.last_name || user.lastName || user.lname || '';
      fullname = `${firstName} ${lastName}`.trim();
    }
    console.log(`🔍 Extracted: ID="${userId}", Email="${email}", Name="${fullname}"`);
    if (!userId) {
      console.error('❌ No user ID found in user data');
      throw new Error('Missing user ID in response data');
    }
    if (!email) {
      console.error('❌ No email found in user data');
      throw new Error('Missing email in response data');
    }
    // Format the user details object correctly
    return {
      id: userId,
      fullname: fullname,
      email: email,
      username: user.username || '',
      status: user.status || '',
      level: user.level || '',
      creationDate: user.creation_date || '',
      lastAccess: user.last_access_date || '',
      timezone: user.timezone || '',
      language: user.language || '',
      department: user.department || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      uuid: user.uuid || '',
      isManager: user.is_manager || false,
      subordinatesCount: user.subordinates_count || 0,
      avatar: user.avatar || '',
      expirationDate: user.expiration_date || null,
      emailValidationStatus: user.email_validation_status || '',
    };
  }
  async getUserDetails(email: string): Promise<UserDetails> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/manage/v1/user?search_text=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch user details: ${response.status} - ${errorText}`);
    }
    const userData = await response.json();

      throw new Error(`User not found: ${identifier}`);
    } catch (error) {
      console.error(`❌ Error getting user details for ${identifier}:`, error);
      throw error;
    }
  }

  private formatUserDetails(user: any): UserDetails {
  console.log('🔍 Raw user data received:', JSON.stringify(user, null, 2));
    const userId = (user.user_id || user.id || '').toString();
  const email = user.email || '';
  const fullname = user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '';
  console.log(`🔍 Extracted: ID="${userId}", Email="${email}", Name="${fullname}"`);

    if (!userId || !email) {
      throw new Error('Missing required user data');
    }
// Create and return the UserDetails object
  return {
    id: userId,
    fullname: fullname,
    email: email,
    username: user.username || '',
    status: user.status || '',
    level: user.level || '',
    creationDate: user.creation_date || '',
    lastAccess: user.last_access_date || '',
    timezone: user.timezone || '',
    language: user.language || '',
    department: user.department || '',
    isManager: user.is_manager || false,
    subordinatesCount: user.subordinates_count || 0,
    avatar: user.avatar || '',
    expirationDate: user.expiration_date || null,
    emailValidationStatus: user.email_validation_status || '',
    directManager: managerInfo,
      managers: user.managers || [],
      expired: user.expired || false,
    // Add other necessary fields here
  };
}
    // Handle status - Docebo uses "1" for active, "0" for inactive
    let status = 'Unknown';
    const statusField = user.status || user.valid || user.is_active || user.active;
    if (statusField === '1' || statusField === 1 || statusField === true || statusField === 'active') {
      status = 'Active';
    } else if (statusField === '0' || statusField === 0 || statusField === false || statusField === 'inactive') {
      status = 'Inactive';
    } else if (statusField === 'suspended') {
      status = 'Suspended';
    }

    // Handle user level - Docebo specific levels
    let level = 'User';
    const levelField = user.level || user.user_level || user.role || user.user_role || '';
    if (levelField === 'godadmin') {
      level = 'God Admin';
    } else if (levelField === 'powUser' || levelField === 'power_user') {
      level = 'Power User';
    } else if (levelField === 'admin' || levelField === 'administrator') {
      level = 'Admin';
    } else if (levelField === 'user' || levelField === '4') {
      level = 'User';
    }

    // Extract manager information
    let managerInfo = 'Not assigned or not available';
    if (user.managers && user.managers.length > 0) {
      const directManager = user.managers.find((m: any) => m.manager_title === 'Direct Manager' || m.manager_type_id === 1);
      if (directManager) {
        managerInfo = `${directManager.manager_name} (${directManager.manager_username})`;
      } else {
        const firstManager = user.managers[0];
        managerInfo = `${firstManager.manager_name} (${firstManager.manager_title})`;
      }
    }

    // Extract organizational information from custom fields
    const orgChart = user.field_1 || user.orgchart_desc || user.org_chart || user.organization || 'Not specified';
    const employeeType = user.field_2 || 'Not specified';
    const businessUnit = user.field_4 || 'Not specified';
    const department = user.field_5 || orgChart;

    const formattedUser = {
      id: userId,
      fullname: fullname || `User ${userId}`,
      email: email,
      username: user.username || user.encoded_username || user.userid || user.user_name || email,
      status: status,
      level: level,
      creationDate: user.creation_date || user.register_date || user.date_created || user.created_at || 'Not available',
      lastAccess: user.last_access_date || user.last_update || user.last_access || user.updated_at || 'Not available',
      timezone: user.timezone || user.time_zone || user.tz || 'America/New_York',
      language: user.language || user.lang || user.lang_code || 'English',
      department: department,
      // Additional fields from Docebo API
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      uuid: user.uuid || '',
      isManager: user.is_manager || false,
      subordinatesCount: user.active_subordinates_count || 0,
      avatar: user.avatar || '',
      expirationDate: user.expiration_date || null,
      emailValidationStatus: user.email_validation_status === '1' ? 'Validated' : 'Not Validated',
      organizationChart: orgChart,
      employeeType: employeeType,
      businessUnit: businessUnit,
      employeeId: user.field_6 || userId,
      directManager: managerInfo,
      managers: user.managers || [],
      expired: user.expired || false,
      dateFormat: user.date_format || 'Not specified',
      newsletterOptout: user.newsletter_optout === '1' ? 'Yes' : 'No',
    };
  }

  async getEnhancedUserDetails(userId: string): Promise<any> {
    console.log(`📋 Getting enhanced user details for: ${userId}`);

    try {
      const result = await this.apiRequest(`/manage/v1/user/${userId}`, 'GET');
      return result.data || result;
    } catch (error) {
      console.error(`❌ Error getting enhanced user details:`, error);
      throw error;
    }
  }

  // Course and Learning Plan Details
  async getCourseDetails(identifier: string): Promise<any> {
    console.log(`📚 Getting course details for: ${identifier}`);

    try {
      // Try direct course lookup by ID if identifier is numeric
      if (/^\d+$/.test(identifier)) {
        console.log(`🆔 Trying direct course lookup by ID: ${identifier}`);
        try {
          const directResult = await this.apiRequest(`/learn/v1/courses/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ Found course by direct ID lookup`);
            return this.enrichCourseData(directResult.data);
          }
        } catch (directError) {
          console.log(`❌ Direct course lookup failed, trying search...`);
        }
      }

      // Fallback to course search
      console.log(`🔍 Searching for course: ${identifier}`);
      const courses = await this.searchCourses(identifier, 50);

      if (courses.length === 0) {
        throw new Error(`Course not found: ${identifier}`);
      }

      // Find best match
      let bestMatch = courses.find(course => {
        const courseName = this.getCourseName(course);
        const courseCode = course.code || course.course_code || '';
        const courseId = (course.id || course.course_id)?.toString();

        // Exact matches
        if (courseId === identifier.toString()) return true;
        if (courseCode === identifier) return true;
        if (courseName.toLowerCase() === identifier.toLowerCase()) return true;

        return false;
      });

      // If no exact match, try partial match
      if (!bestMatch) {
        bestMatch = courses.find(course => {
          const courseName = this.getCourseName(course);
          return courseName.toLowerCase().includes(identifier.toLowerCase());
        });
      }

      // Default to first result if nothing else matches
      if (!bestMatch) {
        bestMatch = courses[0];
      }

      console.log(`✅ Selected course: ${this.getCourseName(bestMatch)}`);

      // Try to get more detailed information
      const courseId = bestMatch.id || bestMatch.course_id;
      if (courseId) {
        try {
          console.log(`📋 Getting detailed course information for ID: ${courseId}`);
          const detailedResult = await this.apiRequest(`/learn/v1/courses/${courseId}`, 'GET');
          if (detailedResult.data) {
            console.log(`✅ Got detailed course information`);
            return this.enrichCourseData(detailedResult.data);
          }
        } catch (detailError) {
          console.log(`⚠️ Could not get detailed course info, using search result`);
        }
      }

      return this.enrichCourseData(bestMatch);
    } catch (error) {
      console.error(`❌ Error getting course details:`, error);
      throw error;
    }
  }

  async getLearningPlanDetails(identifier: string): Promise<any> {
    console.log(`📋 Getting learning plan details for: ${identifier}`);

    try {
      // Try direct learning plan lookup by ID if identifier is numeric
      if (/^\d+$/.test(identifier)) {
        console.log(`🆔 Trying direct learning plan lookup by ID: ${identifier}`);
        try {
          const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
          if (directResult.data) {
            console.log(`✅ Found learning plan by direct ID lookup`);
            return this.enrichLearningPlanData(directResult.data);
          }
        } catch (directError) {
          console.log(`❌ Direct learning plan lookup failed, trying search...`);
        }
      }

      // Fallback to learning plan search
      console.log(`🔍 Searching for learning plan: ${identifier}`);
      const learningPlans = await this.searchLearningPlans(identifier, 50);

      if (learningPlans.length === 0) {
        throw new Error(`Learning plan not found: ${identifier}`);
      }

      // Find best match
      let bestMatch = learningPlans.find(lp => {
        const lpName = this.getLearningPlanName(lp);
        const lpCode = lp.code || '';
        const lpId = (lp.learning_plan_id || lp.id)?.toString();

        // Exact matches
        if (lpId === identifier.toString()) return true;
        if (lpCode === identifier) return true;
        if (lpName.toLowerCase() === identifier.toLowerCase()) return true;

        return false;
      });

      // If no exact match, try partial match
      if (!bestMatch) {
        bestMatch = learningPlans.find(lp => {
          const lpName = this.getLearningPlanName(lp);
          return lpName.toLowerCase().includes(identifier.toLowerCase());
        });
      }

      // Default to first result if nothing else matches
      if (!bestMatch) {
        bestMatch = learningPlans[0];
      }

      console.log(`✅ Selected learning plan: ${this.getLearningPlanName(bestMatch)}`);

      // Try to get more detailed information
      const lpId = bestMatch.learning_plan_id || bestMatch.id;
      if (lpId) {
        try {
          console.log(`📋 Getting detailed learning plan information for ID: ${lpId}`);
          const detailedResult = await this.apiRequest(`/learningplan/v1/learningplans/${lpId}`, 'GET');
          if (detailedResult.data) {
            console.log(`✅ Got detailed learning plan information`);
            return this.enrichLearningPlanData(detailedResult.data);
          }
        } catch (detailError) {
          console.log(`⚠️ Could not get detailed learning plan info, using search result`);
        }
      }

      return this.enrichLearningPlanData(bestMatch);
    } catch (error) {
      console.error(`❌ Error getting learning plan details:`, error);
      throw error;
    }
  }

  // Data Enrichment Methods
  private enrichCourseData(courseData: any): any {
    console.log(`📊 Enriching course data`);

    return {
      id: courseData.id || courseData.course_id || courseData.idCourse,
      course_id: courseData.id || courseData.course_id || courseData.idCourse,
      title: courseData.name || courseData.title || courseData.course_name,
      course_name: courseData.name || courseData.title || courseData.course_name,
      name: courseData.name || courseData.title || courseData.course_name,
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
      enrolled_users_count: courseData.enrolled_users_count,
      subscription_count: courseData.subscription_count,
      category_name: courseData.category_name,
      credits: courseData.credits || 0,
      ...courseData
    };
  }

  private enrichLearningPlanData(lpData: any): any {
    console.log(`📊 Enriching learning plan data`);

    return {
      id: lpData.id || lpData.learning_plan_id || lpData.lp_id,
      learning_plan_id: lpData.learning_plan_id || lpData.id || lpData.lp_id,
      lp_id: lpData.learning_plan_id || lpData.id || lpData.lp_id,
      title: lpData.name || lpData.title || lpData.learning_plan_name,
      name: lpData.name || lpData.title || lpData.learning_plan_name,
      learning_plan_name: lpData.name || lpData.title || lpData.learning_plan_name,
      code: lpData.code,
      is_active: lpData.is_active,
      status: lpData.status,
      description: lpData.description || '',
      date_creation: lpData.date_creation,
      date_modification: lpData.date_modification,
      creation_date: lpData.date_creation ? new Date(lpData.date_creation * 1000).toISOString() : null,
      last_update: lpData.date_modification ? new Date(lpData.date_modification * 1000).toISOString() : null,
      enrolled_users_count: lpData.enrolled_users_count,
      enrolled_users: lpData.enrolled_users,
      total_users: lpData.total_users,
      user_count: lpData.user_count,
      enrollment_count: lpData.enrolled_users_count || lpData.enrolled_users || lpData.total_users || lpData.user_count || 0,
      courses_count: lpData.courses_count || lpData.total_courses || 0,
      total_courses: lpData.courses_count || lpData.total_courses || 0,
      ...lpData
    };
  }

  // Enrollment Methods
  async getUserAllEnrollments(userId: string): Promise<EnrollmentData> {
    console.log(`📚 Getting all enrollments for user: ${userId}`);

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
      console.error(`❌ Error getting all enrollments:`, error);
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

  async enrollUserInCourse(userId: string, courseId: string, options: any = {}): Promise<any> {
    console.log(`📚 Enrolling user ${userId} in course ${courseId}`);

    try {
      const result = await this.apiRequest('/course/v1/courses/enrollments', 'POST', {
        user_ids: [userId],
        course_id: courseId,
        ...options
      });

      return result;
    } catch (error) {
      console.error(`❌ Error enrolling user in course:`, error);
      throw error;
    }
  }

  async enrollUserInLearningPlan(userId: string, learningPlanId: string, options: any = {}): Promise<any> {
    console.log(`📋 Enrolling user ${userId} in learning plan ${learningPlanId}`);

    try {
      const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'POST', {
        user_ids: [userId],
        learning_plan_id: learningPlanId,
        ...options
      });

      return result;
    } catch (error) {
      console.error(`❌ Error enrolling user in learning plan:`, error);
      throw error;
    }
  }

  async unenrollUserFromCourse(userId: string, courseId: string): Promise<any> {
    console.log(`📚 Unenrolling user ${userId} from course ${courseId}`);

    try {
      const result = await this.apiRequest(`/course/v1/courses/${courseId}/enrollments/${userId}`, 'DELETE');
      return result;
    } catch (error) {
      console.error(`❌ Error unenrolling user from course:`, error);
      throw error;
    }
  }

  async unenrollUserFromLearningPlan(userId: string, learningPlanId: string): Promise<any> {
    console.log(`📋 Unenrolling user ${userId} from learning plan ${learningPlanId}`);

    try {
      const result = await this.apiRequest(`/learningplan/v1/learningplans/${learningPlanId}/enrollments/${userId}`, 'DELETE');
      return result;
    } catch (error) {
      console.error(`❌ Error unenrolling user from learning plan:`, error);
      throw error;
    }
  }

  // Utility Methods
  getCourseName(course: any): string {
    return course.name ||
           course.title ||
           course.course_name ||
           'Unknown Course';
  }

  getLearningPlanName(lp: any): string {
    return lp.name ||
           lp.title ||
           lp.learning_plan_name ||
           lp.lp_name ||
           lp.learningplan_name ||
           lp.plan_name ||
           'Unknown Learning Plan';
  }

  // Legacy compatibility methods
  async findCourseByIdentifier(identifier: string): Promise<any> {
    return await this.getCourseDetails(identifier);
  }

  async findLearningPlanByIdentifier(identifier: string): Promise<any> {
    return await this.getLearningPlanDetails(identifier);
  }
}
