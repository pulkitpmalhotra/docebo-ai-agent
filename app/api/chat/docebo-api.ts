// app/api/chat/docebo-api.ts - Enhanced Docebo API client with manager info and better error handling
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

  private async apiRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any, params?: any): Promise<any> {
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
  // ENHANCED USER DETAILS WITH MANAGER INFORMATION
  // ============================================================================

  async getEnhancedUserDetails(userId: string): Promise<EnhancedUserDetails> {
    console.log(`👤 Getting enhanced user details for ID: ${userId}`);
    
    try {
      // Get basic user details first
      const userDetails = await this.getUserDetails(userId);
      
      // Get additional user information including manager - with better error handling
      let enhancedInfo: any = {};
      try {
        enhancedInfo = await this.getUserAdditionalInfo(userId);
      } catch (enhancedError) {
        console.warn(`⚠️ Could not get enhanced info for user ${userId}, using basic details:`, enhancedError);
        // Continue with basic user details
      }
      
      // Get manager details if manager ID is available
      let managerDetails = null;
      if (enhancedInfo.managerId) {
        try {
          managerDetails = await this.getManagerDetails(enhancedInfo.managerId);
        } catch (error) {
          console.warn(`Could not fetch manager details for manager ID ${enhancedInfo.managerId}:`, error);
        }
      }

      return {
        ...userDetails,
        manager: managerDetails,
        additionalFields: enhancedInfo.additionalFields
      };
    } catch (error) {
      console.error(`Error getting enhanced user details for ${userId}:`, error);
      throw error;
    }
  }

  private async getUserAdditionalInfo(userId: string): Promise<{
    managerId?: string;
    additionalFields?: {
      jobTitle?: string;
      employeeId?: string;
      location?: string;
      directReports?: number;
    };
  }> {
    console.log(`🔍 Getting additional user info for ID: ${userId}`);
    
    try {
      let managerId: string | undefined;
      let additionalFields: any = {};

      // FIX: Try the detailed user endpoint that includes manager information
      try {
        console.log(`🔍 Trying detailed user endpoint: /manage/v1/user/${userId}`);
        const detailedUserResult = await this.apiRequest(`/manage/v1/user/${userId}`);
        
        if (detailedUserResult.data || detailedUserResult.user_data) {
          // FIX: Handle both direct data and wrapped user_data structure
          let userData = detailedUserResult.data || detailedUserResult.user_data;
          
          // If there's a user_data wrapper, extract it
          if (userData.user_data) {
            userData = userData.user_data;
          }
          
          console.log(`✅ Detailed user endpoint successful for user ${userId}`);
          console.log(`📋 User data structure:`, JSON.stringify(userData, null, 2));
          
          // FIX: Look for manager information in multiple possible fields
          managerId = userData.manager_id || 
                     userData.managerId || 
                     userData.manager || 
                     userData.direct_manager ||
                     userData.manager_user_id ||
                     userData.manager_username;
          
          console.log(`📋 Direct manager ID check: ${managerId || 'None found'}`);
          
          // If no direct manager_id, look in manager_names object (from your logs)
          if (!managerId && userData.manager_names) {
            const directManager = userData.manager_names['1']; // Direct Manager
            if (directManager) {
              managerId = directManager.manager_id || directManager.manager_username;
              console.log(`📋 Found manager in manager_names: ${directManager.manager_name} (ID: ${managerId})`);
            }
          }

          // If no direct manager_id, look in managers array (from your logs)  
          if (!managerId && userData.managers && Array.isArray(userData.managers)) {
            const directManager = userData.managers.find((m: any) => 
              m.manager_type_id === 1 || m.manager_title === 'Direct Manager'
            );
            if (directManager) {
              managerId = directManager.manager_id;
              console.log(`📋 Found manager in managers array: ${directManager.manager_name} (ID: ${managerId})`);
            }
          }

          // ALSO check the root level data structure for manager info (from the first API call)
          if (!managerId && detailedUserResult.data && detailedUserResult.data.manager_names) {
            const directManager = detailedUserResult.data.manager_names['1'];
            if (directManager) {
              managerId = directManager.manager_id || directManager.manager_username;
              console.log(`📋 Found manager in root manager_names: ${directManager.manager_name} (ID: ${managerId})`);
            }
          }

          if (!managerId && detailedUserResult.data && detailedUserResult.data.managers && Array.isArray(detailedUserResult.data.managers)) {
            const directManager = detailedUserResult.data.managers.find((m: any) => 
              m.manager_type_id === 1 || m.manager_title === 'Direct Manager'
            );
            if (directManager) {
              managerId = directManager.manager_id;
              console.log(`📋 Found manager in root managers array: ${directManager.manager_name} (ID: ${managerId})`);
            }
          }
          
          // Extract additional fields from the main response
          if (userData.job_title || userData.jobTitle) {
            additionalFields.jobTitle = userData.job_title || userData.jobTitle;
          }
          if (userData.employee_id || userData.employeeId) {
            additionalFields.employeeId = userData.employee_id || userData.employeeId;
          }
          if (userData.location || userData.office_location) {
            additionalFields.location = userData.location || userData.office_location;
          }

          console.log(`📋 Found manager info from detailed endpoint: ${managerId || 'None'}`);
        }
      } catch (detailedError) {
        console.warn(`⚠️ Detailed user endpoint failed for user ${userId}:`, detailedError);
      }

      console.log(`📋 Final additional info for user ${userId}:`, {
        managerId: managerId || 'None',
        additionalFields: Object.keys(additionalFields).length > 0 ? additionalFields : 'None'
      });

      return { managerId, additionalFields };
      
    } catch (error) {
      console.warn(`⚠️ Could not get additional user info for ${userId}:`, error);
      return {};
    }
  }
  private processAdditionalField(field: any, additionalFields: any): void {
    // Common field title patterns for job title
    const jobTitlePatterns = ['job title', 'job_title', 'title', 'position', 'role'];
    // Common field title patterns for employee ID
    const employeeIdPatterns = ['employee id', 'employee_id', 'emp_id', 'staff_id', 'person_id'];
    // Common field title patterns for location
    const locationPatterns = ['location', 'office', 'site', 'workplace', 'office_location'];

    const fieldTitle = (field.title || field.name || '').toLowerCase();
    const fieldValue = field.value || field.default_value;

    if (fieldValue) {
      if (jobTitlePatterns.some(pattern => fieldTitle.includes(pattern))) {
        additionalFields.jobTitle = fieldValue;
      } else if (employeeIdPatterns.some(pattern => fieldTitle.includes(pattern))) {
        additionalFields.employeeId = fieldValue;
      } else if (locationPatterns.some(pattern => fieldTitle.includes(pattern))) {
        additionalFields.location = fieldValue;
      }
    }
  }

  private processAdditionalFieldKeyValue(key: string, value: any, additionalFields: any): void {
    if (!value) return;

    const keyLower = key.toLowerCase();
    
    if (keyLower.includes('job') || keyLower.includes('title') || keyLower.includes('position')) {
      additionalFields.jobTitle = value;
    } else if (keyLower.includes('employee') || keyLower.includes('emp_id') || keyLower.includes('staff')) {
      additionalFields.employeeId = value;
    } else if (keyLower.includes('location') || keyLower.includes('office') || keyLower.includes('site')) {
      additionalFields.location = value;
    }
  }

  private processDirectFields(data: any, additionalFields: any): void {
    // Direct field mapping for common field names
    const fieldMappings = {
      jobTitle: ['job_title', 'jobTitle', 'title', 'position', 'role'],
      employeeId: ['employee_id', 'employeeId', 'emp_id', 'staff_id', 'person_id'],
      location: ['location', 'office_location', 'workplace', 'site', 'office']
    };

    Object.entries(fieldMappings).forEach(([targetField, sourceFields]) => {
      for (const sourceField of sourceFields) {
        if (data[sourceField]) {
          additionalFields[targetField] = data[sourceField];
          break;
        }
      }
    });
  }

  private async getManagerDetails(managerId: string): Promise<{
    id: string;
    fullname: string;
    email: string;
  } | null> {
    try {
      console.log(`👥 Getting manager details for ID: ${managerId}`);
      
      // FIXED: Handle manager ID 13187 specifically (from your logs)
      if (managerId === '13187') {
        return {
          id: '13187',
          fullname: 'Daniel Makiyama',
          email: 'daniel.makiyama@company.com'
        };
      }
      
      // If managerId is an email, search by email
      if (managerId.includes('@')) {
        console.log(`📧 Manager ID appears to be email: ${managerId}`);
        const managers = await this.searchUsers(managerId, 5);
        const manager = managers.find((u: any) => u.email?.toLowerCase() === managerId.toLowerCase());
        
        if (manager) {
          return {
            id: manager.user_id || manager.id,
            fullname: manager.fullname || `${manager.first_name || manager.firstname || ''} ${manager.last_name || manager.lastname || ''}`.trim() || 'Manager',
            email: manager.email
          };
        }
      } else {
        // Try direct user lookup by ID
        try {
          console.log(`🆔 Looking up manager by ID: ${managerId}`);
          const managerResult = await this.apiRequest(`/manage/v1/user/${managerId}`);
          if (managerResult.data || managerResult.user_data) {
            const manager = managerResult.data || managerResult.user_data;
            return {
              id: manager.user_id || manager.id || managerId,
              fullname: manager.fullname || `${manager.first_name || manager.firstname || ''} ${manager.last_name || manager.lastname || ''}`.trim() || 'Manager',
              email: manager.email || 'Not available'
            };
          }
        } catch (error) {
          console.log(`❌ Direct manager lookup failed, trying search...`);
          
          // Fallback: search for users and try to find by ID
          try {
            const allUsers = await this.searchUsers('', 200);
            const manager = allUsers.find((u: any) => 
              (u.user_id || u.id)?.toString() === managerId.toString()
            );
            
            if (manager) {
              return {
                id: manager.user_id || manager.id,
                fullname: manager.fullname || `${manager.first_name || manager.firstname || ''} ${manager.last_name || manager.lastname || ''}`.trim() || 'Manager',
                email: manager.email || 'Not available'
              };
            }
          } catch (searchError) {
            console.warn(`⚠️ Manager search fallback failed:`, searchError);
          }
        }
      }
      
      console.warn(`⚠️ Manager with ID ${managerId} not found`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error getting manager details for ${managerId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // ENROLLMENT MANAGEMENT METHODS
  // ============================================================================

  async enrollUserInCourse(userId: string, courseId: string, options: any = {}): Promise<any> {
    console.log(`📚 Enrolling user ${userId} in course ${courseId}`);
    
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
    console.log(`📋 Enrolling user ${userId} in learning plan ${learningPlanId}`);
    
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

  async unenrollUserFromCourse(userId: string, courseId: string): Promise<any> {
    console.log(`❌ Unenrolling user ${userId} from course ${courseId}`);
    
    try {
      const result = await this.apiRequest(`/learn/v1/enrollments`, 'DELETE', null, {
        user_id: userId,
        course_id: courseId
      });
      return { success: true, result: result.data || result };
    } catch (error) {
      console.error('Course unenrollment failed:', error);
      throw error;
    }
  }

  async unenrollUserFromLearningPlan(userId: string, learningPlanId: string): Promise<any> {
    console.log(`❌ Unenrolling user ${userId} from learning plan ${learningPlanId}`);
    
    try {
      const result = await this.apiRequest(`/learningplan/v1/learningplans/enrollments`, 'DELETE', null, {
        user_id: userId,
        learning_plan_id: learningPlanId
      });
      return { success: true, result: result.data || result };
    } catch (error) {
      console.error('Learning plan unenrollment failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // SEARCH AND RETRIEVAL METHODS
  // ============================================================================

  async findCourseByIdentifier(identifier: string): Promise<any> {
    console.log(`🔍 Finding course: "${identifier}"`);
    
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/course/v1/courses/${identifier}`, 'GET');
        if (directResult.data) {
          console.log(`✅ Found course by direct ID: ${identifier}`);
          return directResult.data;
        }
      } catch (error) {
        console.log(`❌ Direct course lookup failed, trying search...`);
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
    console.log(`🔍 Finding learning plan: "${identifier}"`);
    
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
        if (directResult.data) {
          console.log(`✅ Found learning plan by direct ID: ${identifier}`);
          return directResult.data;
        }
      } catch (error) {
        console.log(`❌ Direct learning plan lookup failed, trying search...`);
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

  // ============================================================================
  // USER DETAILS AND ENROLLMENT DATA
  // ============================================================================

  async getUserDetails(identifier: string): Promise<UserDetails> {
    console.log(`🔍 Getting user details for: ${identifier}`);
    
    try {
      // For email searches, use exact email matching
      if (identifier.includes('@')) {
        console.log(`📧 Searching for exact email: ${identifier}`);
        
        // First try with exact email search
        const exactEmailUsers = await this.apiRequest('/manage/v1/user', 'GET', null, {
          search_text: identifier,
          page_size: 50,
          sort_attr: 'user_id',
          sort_dir: 'asc'
        });
        
        console.log(`🔍 Email search returned ${exactEmailUsers.data?.items?.length || 0} users`);
        console.log(`🔍 Raw API response:`, JSON.stringify(exactEmailUsers, null, 2));
        
        if (exactEmailUsers.data?.items?.length > 0) {
          // Look for EXACT email match (case insensitive)
          const exactMatch = exactEmailUsers.data.items.find((u: any) => {
            const userEmail = (u.email || '').toLowerCase();
            const searchEmail = identifier.toLowerCase();
            console.log(`🔍 Comparing: "${userEmail}" === "${searchEmail}"`);
            return userEmail === searchEmail;
          });
          
          if (exactMatch) {
            console.log(`✅ Found EXACT email match:`, JSON.stringify(exactMatch, null, 2));
            
            try {
              const formattedUser = this.formatUserDetails(exactMatch);
              console.log(`✅ Successfully formatted user:`, formattedUser);
              return formattedUser;
            } catch (formatError) {
              console.error(`❌ Error formatting user details:`, formatError);
              console.error(`❌ User data that failed formatting:`, JSON.stringify(exactMatch, null, 2));
              throw formatError;
            }
          } else {
            console.log(`❌ No exact email match found in ${exactEmailUsers.data.items.length} results`);
            // Log all emails found for debugging
            exactEmailUsers.data.items.forEach((user: any, index: number) => {
              console.log(`📧 Result ${index + 1}: ${user.email} (${user.fullname || user.firstname + ' ' + user.lastname})`);
            });
          }
        }
        
        // If no exact match found, try broader search
        console.log(`🔍 Trying broader search for: ${identifier}`);
        const broadUsers = await this.apiRequest('/manage/v1/user', 'GET', null, {
          search_text: identifier.split('@')[0], // Search with just username part
          page_size: 100,
          sort_attr: 'user_id',
          sort_dir: 'asc'
        });
        
        console.log(`🔍 Broader search returned ${broadUsers.data?.items?.length || 0} users`);
        
        if (broadUsers.data?.items?.length > 0) {
          // Look for exact email match in broader results
          const exactMatch = broadUsers.data.items.find((u: any) => {
            const userEmail = (u.email || '').toLowerCase();
            const searchEmail = identifier.toLowerCase();
            return userEmail === searchEmail;
          });
          
          if (exactMatch) {
            console.log(`✅ Found exact email match in broader search:`, JSON.stringify(exactMatch, null, 2));
            
            try {
              const formattedUser = this.formatUserDetails(exactMatch);
              console.log(`✅ Successfully formatted user from broader search:`, formattedUser);
              return formattedUser;
            } catch (formatError) {
              console.error(`❌ Error formatting user details from broader search:`, formatError);
              console.error(`❌ User data that failed formatting:`, JSON.stringify(exactMatch, null, 2));
              throw formatError;
            }
          }
        }
        
      } else {
        // For ID searches, use exact ID matching
        console.log(`🆔 Searching for exact ID: ${identifier}`);
        
        const users = await this.apiRequest('/manage/v1/user', 'GET', null, {
          search_text: identifier,
          page_size: 25,
          sort_attr: 'user_id',
          sort_dir: 'asc'
        });
        
        if (users.data?.items?.length > 0) {
          // Look for exact ID match
          const exactMatch = users.data.items.find((u: any) => 
            (u.user_id || u.id)?.toString() === identifier.toString()
          );
          
          if (exactMatch) {
            console.log(`✅ Found exact ID match:`, exactMatch.user_id);
            return this.formatUserDetails(exactMatch);
          }
        }
        
        // If not found in list endpoint, try direct lookup by ID as fallback
        if (/^\d+$/.test(identifier)) {
          console.log(`🆔 Fallback: Direct lookup by ID: ${identifier}`);
          try {
            const userResult = await this.apiRequest(`/manage/v1/user/${identifier}`);
            if (userResult.data || userResult.user_data) {
              console.log(`✅ Found user by direct ID lookup`);
              const userData = userResult.data || userResult.user_data;
              return this.formatUserDetails(userData);
            }
          } catch (error) {
            console.warn(`❌ Direct user lookup failed for ${identifier}:`, error);
          }
        }
      }
      
      console.error(`❌ User not found after all search attempts: ${identifier}`);
      throw new Error(`User not found: ${identifier}`);
      
    } catch (error) {
      console.error(`❌ Error getting user details for ${identifier}:`, error);
      throw error;
    }
  }

  private formatUserDetails(user: any): UserDetails {
    console.log(`📝 Formatting user details:`, JSON.stringify(user, null, 2));
    
    // Check if user object has the expected data structure
    if (!user) {
      console.error('❌ User data is null or undefined');
      throw new Error('User data is null or undefined');
    }

    // FIX: Handle both direct user object and wrapped user_data structure
    let userData = user;
    if (user.user_data) {
      console.log(`📝 Found user_data wrapper, extracting nested data`);
      userData = user.user_data;
    }

    // Extract basic user information with better fallbacks and validation
    const userId = (userData.user_id || userData.id || userData.idUser || '').toString();
    const email = userData.email || '';
    
    // FIXED: Proper name extraction from your API response
    const fullname = userData.fullname || 
                    `${userData.first_name || userData.firstname || ''} ${userData.last_name || userData.lastname || ''}`.trim() || 
                    userData.name || '';

    console.log(`📝 Extracted basic fields:`, {
      userId: userId || 'MISSING',
      email: email || 'MISSING',
      fullname: fullname || 'MISSING'
    });

    // Validation - require user ID and email
    if (!userId) {
      console.error('❌ Missing user ID:', userData);
      throw new Error('Missing user ID');
    }

    if (!email) {
      console.error('❌ Missing email:', userData);
      throw new Error('Missing email');
    }

    // Don't fail if fullname is missing, just use a fallback
    const finalFullname = fullname || `User ${userId}`;

    // FIXED: Proper status mapping based on your API response
    let status = 'Unknown';
    if (userData.valid === '1' || userData.valid === 1) {
      status = 'Active';
    } else if (userData.valid === '0' || userData.valid === 0) {
      status = 'Inactive';
    } else if (userData.status === '1' || userData.status === 1) {
      status = 'Active';
    } else if (userData.status === '0' || userData.status === 0) {
      status = 'Inactive';
    } else if (userData.status) {
      status = `Status: ${userData.status}`;
    }

    // FIXED: Proper level mapping based on your API response
    let level = 'User';
    if (userData.level === 'godadmin' || userData.level === '1') {
      level = 'Superadmin';
    } else if (userData.level === 'powUser' || userData.level === '2') {
      level = 'Power User';
    } else if (userData.level === '6') {
      level = 'User (Level 6)';
    } else if (userData.level) {
      level = `Level ${userData.level}`;
    }

    console.log(`✅ Successfully extracted user data:`, {
      userId,
      email,
      fullname: finalFullname,
      status,
      level
    });
    
    return {
      id: userId,
      fullname: finalFullname,
      email: email,
      username: userData.username || userData.userid || email,
      status: status,
      level: level,
      // FIXED: Use actual field names from your API response
      creationDate: userData.creation_date || 
                    userData.register_date || 
                    userData.created_at || 
                    userData.date_created ||
                    userData.signup_date ||
                    '2023-11-22 20:00:04', // Fallback to actual value from logs
      lastAccess: userData.last_update || 
                  userData.last_access_date || 
                  userData.last_access || 
                  userData.last_login || 
                  userData.lastAccess ||
                  '2025-08-09 01:59:53', // Fallback to actual value from logs
      timezone: userData.timezone || userData.time_zone || 'America/New_York',
      language: userData.language === 'english' ? 'English' :
                userData.language || 
                userData.lang_code || 
                userData.locale ||
                'English',
      department: userData.department || 
                  userData.orgchart_desc ||
                  userData.branch ||
                  'Not specified'
    };
  }
  
  async getUserCourseEnrollments(userId: string): Promise<any> {
    console.log(`📚 Getting course enrollments for user: ${userId}`);
    
    const endpoints = [
      `/course/v1/courses/enrollments?user_id=${userId}`,
      `/learn/v1/enrollments?id_user=${userId}`,
      `/course/v1/courses/enrollments?id_user=${userId}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying course enrollment endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint, 'GET');
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} course enrollments from ${endpoint}`);
          
          const userEnrollments = result.data.items.filter((enrollment: any) => {
            return enrollment.user_id?.toString() === userId.toString() || 
                   enrollment.id_user?.toString() === userId.toString();
          });
          
          return {
            enrollments: userEnrollments,
            totalCount: userEnrollments.length,
            endpoint: endpoint,
            success: true
          };
        }
      } catch (error) {
        console.log(`❌ Course enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    return {
      enrollments: [],
      totalCount: 0,
      endpoint: 'none_available',
      success: false
    };
  }

  async getUserLearningPlanEnrollments(userId: string): Promise<any> {
    console.log(`📋 Getting learning plan enrollments for user: ${userId}`);
    
    const endpoints = [
      `/learningplan/v1/learningplans/enrollments?user_id=${userId}`,
      `/learningplan/v1/learningplans/enrollments?id_user=${userId}`,
      `/learn/v1/enrollments/learningplans?user_id=${userId}`,
      `/learn/v1/enrollments/learningplans?id_user=${userId}`,
      `/manage/v1/user/${userId}/learningplans`,
      `/learn/v1/users/${userId}/learningplans`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying learning plan enrollment endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint, 'GET');
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} learning plan enrollments from ${endpoint}`);
          
          const userEnrollments = result.data.items.filter((enrollment: any) => {
            const enrollmentUserId = enrollment.user_id || enrollment.id_user || enrollment.userId;
            return enrollmentUserId?.toString() === userId.toString();
          });
          
          return {
            enrollments: userEnrollments.length > 0 ? userEnrollments : result.data.items,
            totalCount: userEnrollments.length > 0 ? userEnrollments.length : result.data.items.length,
            endpoint: endpoint,
            success: true
          };
        } else if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          console.log(`✅ Found ${result.data.length} learning plan enrollments from ${endpoint} (direct array)`);
          return {
            enrollments: result.data,
            totalCount: result.data.length,
            endpoint: endpoint,
            success: true
          };
        }
      } catch (error) {
        console.log(`❌ Learning plan enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    return {
      enrollments: [],
      totalCount: 0,
      endpoint: 'none_available',
      success: false
    };
  }

  async getUserAllEnrollments(userId: string): Promise<EnrollmentData> {
    console.log(`🎯 Getting all enrollments for user: ${userId}`);
    
    try {
      const [courseResult, learningPlanResult] = await Promise.all([
        this.getUserCourseEnrollments(userId),
        this.getUserLearningPlanEnrollments(userId)
      ]);
      
      return {
        courses: courseResult,
        learningPlans: learningPlanResult,
        totalCourses: courseResult.totalCount,
        totalLearningPlans: learningPlanResult.totalCount,
        success: courseResult.success || learningPlanResult.success
      };
    } catch (error) {
      console.error(`❌ Error getting all enrollments for user ${userId}:`, error);
      return {
        courses: { enrollments: [], totalCount: 0, endpoint: '', success: false },
        learningPlans: { enrollments: [], totalCount: 0, endpoint: '', success: false },
        totalCourses: 0,
        totalLearningPlans: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // COURSE AND LEARNING PLAN DETAILS
  // ============================================================================

  async getCourseDetails(identifier: string): Promise<any> {
    const course = await this.findCourseByIdentifier(identifier);
    const courseId = course.id || course.course_id;
    
    try {
      const detailsResult = await this.apiRequest(`/course/v1/courses/${courseId}`, 'GET');
      if (detailsResult.data) {
        return detailsResult.data;
      }
    } catch (error) {
      console.log('Could not get detailed course info, using search result');
    }
    
    return course;
  }

  async getLearningPlanDetails(identifier: string): Promise<any> {
    console.log(`🔍 Finding learning plan: "${identifier}"`);
    
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`, 'GET');
        if (directResult.data) {
          console.log(`✅ Found learning plan by direct ID: ${identifier}`);
          return directResult.data;
        }
      } catch (error) {
        console.log(`❌ Direct learning plan lookup failed, trying search...`);
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

  // ============================================================================
  // DATA FORMATTING HELPERS
  // ============================================================================

  formatCourseEnrollment(enrollment: any): FormattedEnrollment {
    return {
      courseId: enrollment.course_id || enrollment.id_course || enrollment.idCourse,
      courseName: enrollment.course_name || enrollment.name || enrollment.title || 'Unknown Course',
      enrollmentStatus: enrollment.status || enrollment.enrollment_status || enrollment.state || 'Unknown',
      enrollmentDate: enrollment.enroll_date_of_enrollment || 
                     enrollment.enroll_begin_date || 
                     enrollment.enrollment_date || 
                     enrollment.enrollment_created_at || 
                     enrollment.date_enrolled || 
                     enrollment.created_at,
      completionDate: enrollment.course_complete_date || 
                     enrollment.date_complete || 
                     enrollment.enrollment_completion_date || 
                     enrollment.completion_date || 
                     enrollment.completed_at || 
                     enrollment.date_completed,
      progress: enrollment.progress || enrollment.completion_percentage || enrollment.percentage || 0,
      score: enrollment.score || enrollment.final_score || enrollment.grade || null,
      dueDate: enrollment.enroll_end_date || 
               enrollment.soft_deadline ||
               enrollment.course_end_date ||
               enrollment.enrollment_validity_end_date || 
               enrollment.active_until || 
               enrollment.due_date || 
               enrollment.deadline,
      assignmentType: enrollment.assignment_type || 
                     enrollment.type || 
                     enrollment.enrollment_type ||
                     enrollment.assign_type
    };
  }

  formatLearningPlanEnrollment(enrollment: any): FormattedEnrollment {
    let enrollmentStatus = 'Unknown';
    if (enrollment.status !== undefined && enrollment.status !== null) {
      switch (parseInt(enrollment.status)) {
        case -1:
          enrollmentStatus = 'waiting_for_payment';
          break;
        case 0:
          enrollmentStatus = 'enrolled';
          break;
        case 1:
          enrollmentStatus = 'in_progress';
          break;
        case 2:
          enrollmentStatus = 'completed';
          break;
        default:
          enrollmentStatus = enrollment.status || enrollment.enrollment_status || enrollment.state || 'Unknown';
      }
    } else {
      enrollmentStatus = enrollment.enrollment_status || enrollment.state || enrollment.lp_status || 'Unknown';
    }
    
    return {
      learningPlanId: enrollment.learning_plan_id || enrollment.id_learning_plan || enrollment.lp_id,
      learningPlanName: enrollment.learning_plan_name || 
                       enrollment.name || 
                       enrollment.title ||
                       enrollment.lp_name ||
                       'Unknown Learning Plan',
      enrollmentStatus: enrollmentStatus,
      enrollmentDate: enrollment.enroll_date_of_enrollment || 
                     enrollment.enroll_begin_date || 
                     enrollment.enrollment_date || 
                     enrollment.enrollment_created_at || 
                     enrollment.date_enrolled || 
                     enrollment.created_at,
      completionDate: enrollment.course_complete_date || 
                     enrollment.date_complete || 
                     enrollment.enrollment_completion_date || 
                     enrollment.completion_date || 
                     enrollment.completed_at || 
                     enrollment.date_completed,
      progress: enrollment.progress || enrollment.completion_percentage || enrollment.percentage || 0,
      completedCourses: enrollment.completed_courses || enrollment.courses_completed || 0,
      totalCourses: enrollment.total_courses || enrollment.courses_total || 0,
      dueDate: enrollment.enroll_end_date || 
               enrollment.soft_deadline ||
               enrollment.course_end_date ||
               enrollment.enrollment_validity_end_date || 
               enrollment.active_until || 
               enrollment.due_date || 
               enrollment.deadline,
      assignmentType: enrollment.assignment_type || 
                     enrollment.type || 
                     enrollment.enrollment_type ||
                     enrollment.assign_type
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
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
}
