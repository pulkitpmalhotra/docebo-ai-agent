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
      // Get basic user details
      const userDetails = await this.getUserDetails(userId);
      
      // Get additional user information including manager
      const enhancedInfo = await this.getUserAdditionalInfo(userId);
      
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

      // Primary endpoint - try to get basic user details first
      try {
        console.log(`🔍 Trying primary endpoint: /manage/v1/user/${userId}`);
        const userResult = await this.apiRequest(`/manage/v1/user/${userId}`);
        
        if (userResult.data) {
          const userData = userResult.data;
          console.log(`✅ Primary endpoint successful for user ${userId}`);
          
          // Look for manager information in main user data
          managerId = userData.manager_id || 
                     userData.managerId || 
                     userData.manager || 
                     userData.direct_manager ||
                     userData.manager_user_id ||
                     userData.manager_username ||
                     (userData.manager_first_name && userData.manager_last_name ? 
                       `${userData.manager_first_name} ${userData.manager_last_name}` : undefined);
          
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

          console.log(`📋 Found manager info from primary endpoint: ${managerId || 'None'}`);
        }
      } catch (primaryError) {
        console.warn(`⚠️ Primary endpoint failed for user ${userId}:`, primaryError);
      }

      // Try additional field endpoints only if we don't have enough info
      const additionalFieldEndpoints = [
        `/manage/v1/user/${userId}/additional_fields`,
        `/manage/v1/user/${userId}/profile`,
        `/manage/v1/user/${userId}/fields`
      ];

      for (const endpoint of additionalFieldEndpoints) {
        try {
          console.log(`🔍 Trying additional fields endpoint: ${endpoint}`);
          const result = await this.apiRequest(endpoint);
          
          if (result.data) {
            console.log(`✅ Additional fields endpoint successful: ${endpoint}`);
            
            // Process additional fields based on endpoint response structure
            if (Array.isArray(result.data)) {
              // Handle array of additional fields
              result.data.forEach((field: any) => {
                this.processAdditionalField(field, additionalFields);
              });
            } else if (result.data.additional_fields) {
              // Handle nested additional_fields object
              Object.entries(result.data.additional_fields).forEach(([key, value]) => {
                this.processAdditionalFieldKeyValue(key, value, additionalFields);
              });
            } else {
              // Handle direct field mapping
              this.processDirectFields(result.data, additionalFields);
            }
            
            // Found additional fields, no need to try other endpoints
            break;
          }
        } catch (error) {
          console.log(`❌ Additional fields endpoint ${endpoint} failed:`, error);
          continue;
        }
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
      
      // If managerId is an email, search by email
      if (managerId.includes('@')) {
        console.log(`📧 Manager ID appears to be email: ${managerId}`);
        const managers = await this.searchUsers(managerId, 5);
        const manager = managers.find((u: any) => u.email?.toLowerCase() === managerId.toLowerCase());
        
        if (manager) {
          return {
            id: manager.user_id || manager.id,
            fullname: manager.fullname || `${manager.firstname || ''} ${manager.lastname || ''}`.trim() || 'Manager',
            email: manager.email
          };
        }
      } else {
        // Try direct user lookup by ID
        try {
          console.log(`🆔 Looking up manager by ID: ${managerId}`);
          const managerResult = await this.apiRequest(`/manage/v1/user/${managerId}`);
          if (managerResult.data) {
            const manager = managerResult.data;
            return {
              id: manager.user_id || manager.id || managerId,
              fullname: manager.fullname || `${manager.firstname || ''} ${manager.lastname || ''}`.trim() || 'Manager',
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
                fullname: manager.fullname || `${manager.firstname || ''} ${manager.lastname || ''}`.trim() || 'Manager',
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
  console.log(`🔍 Searching users with: "${searchText}" (limit: ${limit})`);
  
  const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
    search_text: searchText,
    page_size: Math.min(limit, 200),
    // Add additional parameters to get more complete user data
    sort_attr: 'user_id',
    sort_dir: 'asc'
  });
  
  const users = result.data?.items || [];
  console.log(`📊 Found ${users.length} users from search`);
  
  // Log first user structure to understand the data format
  if (users.length > 0) {
    console.log(`📋 Sample user structure:`, JSON.stringify(users[0], null, 2));
  }
  
  return users;
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
  
  // Always use the list endpoint first to get complete user data including creation/update dates
  try {
    // For email searches, use exact email matching
    if (identifier.includes('@')) {
      console.log(`📧 Searching for exact email: ${identifier}`);
      
      // First try with exact email search
      const exactEmailUsers = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: identifier,
        page_size: 50, // Get more results to ensure we find exact match
        sort_attr: 'user_id',
        sort_dir: 'asc'
      });
      
      console.log(`🔍 Email search returned ${exactEmailUsers.data?.items?.length || 0} users`);
      
      if (exactEmailUsers.data?.items?.length > 0) {
        // Look for EXACT email match (case insensitive)
        const exactMatch = exactEmailUsers.data.items.find((u: any) => {
          const userEmail = (u.email || '').toLowerCase();
          const searchEmail = identifier.toLowerCase();
          console.log(`🔍 Comparing: "${userEmail}" === "${searchEmail}"`);
          return userEmail === searchEmail;
        });
        
        if (exactMatch) {
          console.log(`✅ Found EXACT email match:`, {
            email: exactMatch.email,
            fullname: exactMatch.fullname || `${exactMatch.firstname || ''} ${exactMatch.lastname || ''}`.trim(),
            user_id: exactMatch.user_id
          });
          return this.formatUserDetails(exactMatch);
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
      
      if (broadUsers.data?.items?.length > 0) {
        // Look for exact email match in broader results
        const exactMatch = broadUsers.data.items.find((u: any) => {
          const userEmail = (u.email || '').toLowerCase();
          const searchEmail = identifier.toLowerCase();
          return userEmail === searchEmail;
        });
        
        if (exactMatch) {
          console.log(`✅ Found exact email match in broader search:`, {
            email: exactMatch.email,
            fullname: exactMatch.fullname || `${exactMatch.firstname || ''} ${exactMatch.lastname || ''}`.trim(),
            user_id: exactMatch.user_id
          });
          return this.formatUserDetails(exactMatch);
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
    
    throw new Error(`User not found: ${identifier}`);
    
  } catch (error) {
    console.error(`❌ Error getting user details for ${identifier}:`, error);
    throw error;
  }
}

  private formatUserDetails(user: any): UserDetails {
  console.log(`📝 Formatting user details from list endpoint:`, JSON.stringify(user, null, 2));
  
  // Handle different response structures - sometimes data is nested under 'user_data'
  const userData = user.user_data || user;
  
  // Extract creation date from multiple possible fields (list endpoint specific)
  const creationDate = userData.register_date || 
                      userData.creation_date || 
                      userData.created_at || 
                      userData.date_created ||
                      userData.signup_date ||
                      userData.date_creation ||
                      userData.registration_date ||
                      'Not available';
  
  // Extract last update/access date from multiple possible fields (list endpoint specific)  
  const lastAccess = userData.last_access_date || 
                    userData.last_access || 
                    userData.last_login || 
                    userData.lastAccess ||
                    userData.last_update ||
                    userData.date_last_access ||
                    userData.updated_at ||
                    'Not available';
  
  // Build full name with better fallback logic
  const firstName = userData.firstname || userData.first_name || '';
  const lastName = userData.lastname || userData.last_name || '';
  const fullName = userData.fullname || 
                   (firstName && lastName ? `${firstName} ${lastName}`.trim() : '') ||
                   userData.name || 
                   userData.username ||
                   userData.email ||
                   'Not available';
  
  // Determine user status with better logic
  let status = 'Unknown';
  if (userData.status !== undefined) {
    if (userData.status === '1' || userData.status === 1) status = 'Active';
    else if (userData.status === '0' || userData.status === 0) status = 'Inactive';
    else status = `Status: ${userData.status}`;
  } else if (userData.valid !== undefined) {
    if (userData.valid === '1' || userData.valid === 1) status = 'Active';
    else if (userData.valid === '0' || userData.valid === 0) status = 'Inactive';
  } else {
    status = 'Active'; // Default assumption
  }
  
  // Determine user level with better mapping
  let level = 'User';
if (userData.level !== undefined && userData.level !== null) {
  const levelValue = userData.level.toString().toLowerCase();
  switch (levelValue) {
    case 'godadmin':
    case '6':
      level = 'Superadmin';
      break;
    case 'powuser':
    case '4':
      level = 'Power User';
      break;
    case '3':
      level = 'Course Creator';
      break;
    case '2':
      level = 'Admin';
      break;
    case '1':
      level = 'Learner';
      break;
    case 'user':
      level = 'User';
      break;
    default:
      // If it's a number, show it as "Level X"
      if (/^\d+$/.test(userData.level.toString())) {
        level = `Level ${userData.level}`;
      } else {
        level = userData.level;
      }
  }
} else {
  level = 'User'; // Default
}
  
  return {
    id: (userData.user_id || userData.id || userData.idUser || 'Unknown').toString(),
    fullname: fullName,
    email: userData.email || 'Not available',
    username: userData.username || userData.userid || userData.user_id || 'Not available',
    status: status,
    level: level,
    creationDate: creationDate,
    lastAccess: lastAccess,
    timezone: userData.timezone || userData.time_zone || 'Not specified',
    language: userData.language || 
              userData.lang_code || 
              userData.lang_browsercode ||
              userData.locale ||
              'Not specified',
    department: userData.department || 
                userData.orgchart_desc ||
                userData.branch ||
                userData.organization ||
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
