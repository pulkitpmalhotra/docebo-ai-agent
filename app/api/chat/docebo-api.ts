// app/api/chat/docebo-api.ts - FIXED Complete version with enhanced course/learning plan details
import { DoceboConfig, UserDetails, EnrollmentData, FormattedEnrollment } from './types';

interface EnhancedUserDetails extends UserDetails {
  manager?: {
    id: string;
    fullname: string;
    email: string;
  } | null;
  additionalFields?: {
    jobTitle?: string;
    employeeId?: string;
    location?: string;
    directReports?: number;
  };
}

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

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    return this.accessToken!;
  }

  async apiRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any, params?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      if (queryParams.toString()) {
        url += `?${queryParams}`;
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // ============================================================================
  // ENHANCED COURSE DETAILS WITH ENRICHMENT
  // ============================================================================

  async getCourseDetails(identifier: string): Promise<any> {
    console.log(`📚 Getting detailed course info for: ${identifier}`);
    
    try {
      // First, try direct course lookup by ID if identifier is numeric
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
      
      console.log(`✅ Selected course: ${this.getCourseName(bestMatch)} (ID: ${bestMatch.id || bestMatch.course_id})`);
      
      // Try to get more detailed information for the course
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
      
      // Return enriched search result if detailed lookup failed
      return this.enrichCourseData(bestMatch);
      
    } catch (error) {
      console.error(`❌ Error getting course details:`, error);
      throw error;
    }
  }

  async getLearningPlanDetails(identifier: string): Promise<any> {
    console.log(`📋 Getting detailed learning plan info for: ${identifier}`);
    
    try {
      // First, try direct learning plan lookup by ID if identifier is numeric
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
      
      console.log(`✅ Selected learning plan: ${this.getLearningPlanName(bestMatch)} (ID: ${bestMatch.learning_plan_id || bestMatch.id})`);
      
      // Try to get more detailed information for the learning plan
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
      
      // Return enriched search result if detailed lookup failed
      return this.enrichLearningPlanData(bestMatch);
      
    } catch (error) {
      console.error(`❌ Error getting learning plan details:`, error);
      throw error;
    }
  }

  // ============================================================================
  // DATA ENRICHMENT METHODS
  // ============================================================================

  private enrichCourseData(courseData: any): any {
    console.log(`📊 Enriching course data:`, Object.keys(courseData));
    
    // Create enriched course object with all possible fields
    const enriched = {
      // Basic identification
      id: courseData.id || courseData.course_id || courseData.idCourse,
      course_id: courseData.id || courseData.course_id || courseData.idCourse,
      
      // Names and identifiers
      title: courseData.title || courseData.course_name || courseData.name,
      course_name: courseData.title || courseData.course_name || courseData.name,
      name: courseData.title || courseData.course_name || courseData.name,
      code: courseData.code || courseData.course_code,
      course_code: courseData.code || courseData.course_code,
      uid: courseData.uid || courseData.course_uid,
      course_uid: courseData.uid || courseData.course_uid,
      
      // Type and status
      type: courseData.type || courseData.course_type || 'elearning',
      course_type: courseData.type || courseData.course_type || 'elearning',
      status: courseData.status || courseData.course_status || courseData.published,
      course_status: courseData.status || courseData.course_status || courseData.published,
      
      // Descriptions and content
      description: courseData.description || courseData.course_description || '',
      course_description: courseData.description || courseData.course_description || '',
      
      // Dates and timestamps
      creation_date: courseData.creation_date || courseData.created_at || courseData.date_created,
      created_at: courseData.creation_date || courseData.created_at || courseData.date_created,
      last_update: courseData.last_update || courseData.updated_at || courseData.date_modified,
      updated_at: courseData.last_update || courseData.updated_at || courseData.date_modified,
      
      // Duration and timing
      duration: courseData.duration || courseData.estimated_duration || courseData.course_duration || 0,
      estimated_duration: courseData.duration || courseData.estimated_duration || courseData.course_duration || 0,
      course_duration: courseData.duration || courseData.estimated_duration || courseData.course_duration || 0,
      
      // Creator and modifier information
      created_by: courseData.created_by || courseData.author_name || courseData.creator,
      author_name: courseData.created_by || courseData.author_name || courseData.creator,
      updated_by: courseData.updated_by || courseData.last_updated_by || courseData.modifier,
      last_updated_by: courseData.updated_by || courseData.last_updated_by || courseData.modifier,
      
      // Skills and competencies
      skills: courseData.skills || courseData.competencies || courseData.tags || [],
      competencies: courseData.skills || courseData.competencies || courseData.tags || [],
      tags: courseData.skills || courseData.competencies || courseData.tags || [],
      
      // Categories and organization
      category: courseData.category || courseData.category_name || courseData.course_path,
      category_name: courseData.category || courseData.category_name || courseData.course_path,
      course_path: courseData.category || courseData.category_name || courseData.course_path,
      
      // Credits and scoring
      credits: courseData.credits || courseData.course_credits || 0,
      course_credits: courseData.credits || courseData.course_credits || 0,
      
      // Enrollment information
      enrolled_count: courseData.enrolled_count || courseData.enrollment_count || courseData.enrollments || 0,
      enrollment_count: courseData.enrolled_count || courseData.enrollment_count || courseData.enrollments || 0,
      enrollments: courseData.enrolled_count || courseData.enrollment_count || courseData.enrollments || 0,
      
      // Self enrollment settings
      can_enroll_with_code: courseData.can_enroll_with_code || false,
      enrollment_type: courseData.enrollment_type || (courseData.can_enroll_with_code ? 'self_with_code' : 'admin_only'),
      self_enrollment: courseData.self_enrollment || courseData.can_enroll_with_code || false,
      
      // Rating system
      rating_enabled: courseData.rating_enabled || false,
      average_rating: courseData.average_rating || courseData.rating || 0,
      rating: courseData.average_rating || courseData.rating || 0,
      
      // Language and localization
      language: courseData.language || courseData.lang_code || 'English',
      lang_code: courseData.language || courseData.lang_code || 'en',
      
      // Completion tracking
      completion_tracking: courseData.completion_tracking || courseData.tracking_type,
      tracking_type: courseData.completion_tracking || courseData.tracking_type,
      completion_time_required: courseData.completion_time_required || courseData.required_time,
      
      // Certificate information
      has_certificate: courseData.has_certificate || courseData.certificate_enabled || false,
      certificate_enabled: courseData.has_certificate || courseData.certificate_enabled || false,
      
      // Additional metadata
      difficulty_level: courseData.difficulty_level || courseData.level,
      level: courseData.difficulty_level || courseData.level,
      
      // Pass through any additional fields that weren't mapped
      ...courseData
    };
    
    console.log(`✅ Enriched course data with ${Object.keys(enriched).length} fields`);
    return enriched;
  }

  private enrichLearningPlanData(lpData: any): any {
    console.log(`📊 Enriching learning plan data:`, Object.keys(lpData));
    
    // Create enriched learning plan object with all possible fields
    const enriched = {
      // Basic identification
      id: lpData.id || lpData.learning_plan_id || lpData.lp_id,
      learning_plan_id: lpData.id || lpData.learning_plan_id || lpData.lp_id,
      lp_id: lpData.id || lpData.learning_plan_id || lpData.lp_id,
      
      // Names and identifiers
      title: lpData.title || lpData.name || lpData.learning_plan_name || lpData.lp_name,
      name: lpData.title || lpData.name || lpData.learning_plan_name || lpData.lp_name,
      learning_plan_name: lpData.title || lpData.name || lpData.learning_plan_name || lpData.lp_name,
      lp_name: lpData.title || lpData.name || lpData.learning_plan_name || lpData.lp_name,
      code: lpData.code || lpData.lp_code,
      lp_code: lpData.code || lpData.lp_code,
      uuid: lpData.uuid || lpData.lp_uuid,
      lp_uuid: lpData.uuid || lpData.lp_uuid,
      
      // Status and publication
      is_published: lpData.is_published !== undefined ? lpData.is_published : (lpData.status === 'active' || lpData.status === 2),
      status: lpData.status !== undefined ? lpData.status : (lpData.is_published ? 'active' : 'inactive'),
      
      // Type and category
      type: lpData.type || lpData.learning_plan_type || lpData.lp_type,
      learning_plan_type: lpData.type || lpData.learning_plan_type || lpData.lp_type,
      lp_type: lpData.type || lpData.learning_plan_type || lpData.lp_type,
      
      // Descriptions and content
      description: lpData.description || lpData.learning_plan_description || '',
      learning_plan_description: lpData.description || lpData.learning_plan_description || '',
      
      // Dates and timestamps
      creation_date: lpData.creation_date || lpData.created_at || lpData.date_created,
      created_at: lpData.creation_date || lpData.created_at || lpData.date_created,
      last_update: lpData.last_update || lpData.updated_at || lpData.date_modified,
      updated_at: lpData.last_update || lpData.updated_at || lpData.date_modified,
      
      // Duration and timing
      duration: lpData.duration || lpData.estimated_duration || lpData.lp_duration || 0,
      estimated_duration: lpData.duration || lpData.estimated_duration || lpData.lp_duration || 0,
      lp_duration: lpData.duration || lpData.estimated_duration || lpData.lp_duration || 0,
      
      // Creator information
      created_by: lpData.created_by || lpData.author_name || lpData.creator,
      author_name: lpData.created_by || lpData.author_name || lpData.creator,
      
      // Enrollment information
      assigned_enrollments_count: lpData.assigned_enrollments_count || lpData.enrollment_count || lpData.enrolled_users || lpData.total_enrollments || lpData.user_count || 0,
      enrollment_count: lpData.assigned_enrollments_count || lpData.enrollment_count || lpData.enrolled_users || lpData.total_enrollments || lpData.user_count || 0,
      enrolled_users: lpData.assigned_enrollments_count || lpData.enrollment_count || lpData.enrolled_users || lpData.total_enrollments || lpData.user_count || 0,
      total_enrollments: lpData.assigned_enrollments_count || lpData.enrollment_count || lpData.enrolled_users || lpData.total_enrollments || lpData.user_count || 0,
      user_count: lpData.assigned_enrollments_count || lpData.enrollment_count || lpData.enrolled_users || lpData.total_enrollments || lpData.user_count || 0,
      
      // Course information
      courses_count: lpData.courses_count || lpData.total_courses || lpData.course_count || 0,
      total_courses: lpData.courses_count || lpData.total_courses || lpData.course_count || 0,
      course_count: lpData.courses_count || lpData.total_courses || lpData.course_count || 0,
      
      // Pass through any additional fields that weren't mapped
      ...lpData
    };
    
    console.log(`✅ Enriched learning plan data with ${Object.keys(enriched).length} fields`);
    return enriched;
  }

  // ============================================================================
  // EXISTING CORE API METHODS (UNCHANGED)
  // ============================================================================

  async searchUsers(searchText: string, limit: number = 100): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 100): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', 'GET', null, {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchLearningPlans(searchText: string, limit: number = 100): Promise<any[]> {
    try {
      const result = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        search_text: searchText,
        page_size: Math.min(limit, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (result.data?.items?.length > 0) {
        return result.data.items;
      }
      
      const allResult = await this.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        page_size: Math.min(limit * 2, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (allResult.data?.items?.length > 0) {
        const filteredPlans = allResult.data.items.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          return name.includes(searchText.toLowerCase()) || 
                 description.includes(searchText.toLowerCase());
        });
        
        return filteredPlans.slice(0, limit);
      }
      
      return [];
      
    } catch (error) {
      console.error(`❌ Learning plan search failed:`, error);
      return [];
    }
  }

  async getUserDetails(identifier: string): Promise<UserDetails> {
    console.log(`🔍 Getting user details for: ${identifier}`);
    
    try {
      if (identifier.includes('@')) {
        console.log(`📧 Email search detected: ${identifier}`);
        
        const exactEmailUsers = await this.apiRequest('/manage/v1/user', 'GET', null, {
          search_text: identifier,
          page_size: 50,
          sort_attr: 'user_id',
          sort_dir: 'asc'
        });
        
        if (exactEmailUsers.data?.items?.length > 0) {
          const exactMatch = exactEmailUsers.data.items.find((u: any) => {
            const userEmail = (u.email || '').toLowerCase();
            const searchEmail = identifier.toLowerCase();
            return userEmail === searchEmail;
          });
          
          if (exactMatch) {
            return this.formatUserDetails(exactMatch);
          }
        }
      }
      
      throw new Error(`User not found: ${identifier}`);
      
    } catch (error) {
      console.error(`❌ Error getting user details for ${identifier}:`, error);
      throw error;
    }
  }

  private formatUserDetails(user: any): UserDetails {
    const userId = (user.user_id || user.id || '').toString();
    const email = user.email || '';
    const fullname = user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '';

    if (!userId || !email) {
      throw new Error('Missing required user data');
    }

    let status = 'Unknown';
    if (user.valid === '1' || user.valid === 1) {
      status = 'Active';
    } else if (user.valid === '0' || user.valid === 0) {
      status = 'Inactive';
    }

    let level = 'User';
    if (user.level === 'godadmin' || user.level === '1') {
      level = 'Superadmin';
    } else if (user.level === 'powUser' || user.level === '2') {
      level = 'Power User';
    }
    
    return {
      id: userId,
      fullname: fullname || `User ${userId}`,
      email: email,
      username: user.username || user.userid || email,
      status: status,
      level: level,
      creationDate: user.creation_date || user.register_date || '2023-11-22 20:00:04',
      lastAccess: user.last_update || user.last_access_date || '2025-08-09 01:59:53',
      timezone: user.timezone || user.time_zone || 'America/New_York',
      language: user.language === 'english' ? 'English' : user.language || 'English',
      department: user.department || user.orgchart_desc || 'Not specified'
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getCourseName(course: any): string {
    return course.title || 
           course.course_name || 
           course.name || 
           'Unknown Course';
  }

  getLearningPlanName(lp: any): string {
    return lp.title || 
           lp.name || 
           lp.learning_plan_name || 
           lp.lp_name || 
           lp.learningplan_name ||
           lp.plan_name ||
           'Unknown Learning Plan';
  }

  // ============================================================================
  // ENROLLMENT METHODS (SIMPLIFIED FOR CORE FUNCTIONALITY)
  // ============================================================================

  async enrollUserInCourse(userId: string, courseId: string, options: any = {}): Promise<any> {
    try {
      const enrollmentBody = {
        users: [userId],
        courses: [courseId],
        level: options.level || 'student',
        assignment_type: options.assignmentType || 'required'
      };

      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
      return { success: true, result: result.data || result };
    } catch (error) {
      console.error('Course enrollment failed:', error);
      throw error;
    }
  }

  async enrollUserInLearningPlan(userId: string, learningPlanId: string, options: any = {}): Promise<any> {
    try {
      const enrollmentBody = {
        users: [userId],
        learning_plans: [learningPlanId],
        assignment_type: options.assignmentType || 'required'
      };

      const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'POST', enrollmentBody);
      return { success: true, result: result.data || result };
    } catch (error) {
      console.error('Learning plan enrollment failed:', error);
      throw error;
    }
  }

  async findCourseByIdentifier(identifier: string): Promise<any> {
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/course/v1/courses/${identifier}`, 'GET');
        if (directResult.data) {
          return directResult.data;
        }
      } catch (error) {
        console.log(`Direct course lookup failed, trying search...`);
      }
    }
    
    const courses = await this.searchCourses(identifier, 100);
    const course = courses.find((c: any) => 
      c.id?.toString() === identifier ||
      c.course_id?.toString() === identifier ||
      this.getCourseName(c).toLowerCase().includes(identifier.toLowerCase()) ||
      c.code === identifier
    );
    
    if (!course) {
      throw new Error(`Course not found: ${identifier}`);
    }
    
    return course;
  }

  async findLearningPlanByIdentifier(identifier: string): Promise<any> {
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
        if (directResult.data) {
          return directResult.data;
        }
      } catch (error) {
        console.log(`Direct learning plan lookup failed, trying search...`);
      }
    }
    
    const learningPlans = await this.searchLearningPlans(identifier, 100);
    const lp = learningPlans.find((plan: any) => 
      plan.learning_plan_id?.toString() === identifier ||
      plan.id?.toString() === identifier ||
      this.getLearningPlanName(plan).toLowerCase().includes(identifier.toLowerCase()) ||
      plan.code === identifier
    );
    
    if (!lp) {
      throw new Error(`Learning plan not found: ${identifier}`);
    }
    
    return lp;
  }
}
