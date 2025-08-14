// app/api/chat/route.ts - Complete clean version with all syntax fixed
import { NextRequest, NextResponse } from 'next/server';

// Environment configuration
function validateEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getConfig() {
  return {
    domain: validateEnvironmentVariable('DOCEBO_DOMAIN', process.env.DOCEBO_DOMAIN),
    clientId: validateEnvironmentVariable('DOCEBO_CLIENT_ID', process.env.DOCEBO_CLIENT_ID),
    clientSecret: validateEnvironmentVariable('DOCEBO_CLIENT_SECRET', process.env.DOCEBO_CLIENT_SECRET),
    username: validateEnvironmentVariable('DOCEBO_USERNAME', process.env.DOCEBO_USERNAME),
    password: validateEnvironmentVariable('DOCEBO_PASSWORD', process.env.DOCEBO_PASSWORD),
  };
}

// Enhanced intent detection
class IntentAnalyzer {
  static analyzeIntent(message: string): {
    intent: string;
    entities: any;
    confidence: number;
  } {
    const lower = message.toLowerCase().trim();
    
    // Extract entities first
    const email = this.extractEmail(message);
    const courseId = this.extractCourseId(message);
    const courseName = this.extractCourseName(message);
    const learningPlanName = this.extractLearningPlanName(message);
    
    // Intent patterns with confidence scores
    const patterns = [
      // Course Info patterns
      {
        intent: 'get_course_info',
        patterns: [
          /(?:course info|tell me about course|course details|info about course|course information)/i,
          /(?:what is|describe|explain).+course/i,
          /(?:details for|info for|information for).+course/i
        ],
        extractEntities: () => ({
          courseId: courseId,
          courseName: courseName || this.extractAfterPattern(message, /(?:course info|course details|info about course|tell me about course)\s+(.+)/i)
        }),
        confidence: 0.9
      },
      
      // Learning Plan Info patterns  
      {
        intent: 'get_learning_plan_info',
        patterns: [
          /(?:learning plan info|lp info|plan info|tell me about learning plan|learning plan details)/i,
          /(?:what is|describe|explain).+learning plan/i,
          /(?:details for|info for|information for).+learning plan/i,
          /(?:info|details)\s+(.+)$/i
        ],
        extractEntities: () => ({
          learningPlanName: learningPlanName || 
            this.extractAfterPattern(message, /(?:learning plan info|lp info|plan info|tell me about learning plan|learning plan details)\s+(.+)/i) ||
            this.extractAfterPattern(message, /(?:info|details)\s+(.+)$/i)
        }),
        confidence: 0.9
      },
      
      // Session search patterns
      {
        intent: 'search_sessions_in_course',
        patterns: [
          /(?:search for sessions|find sessions|sessions in course|look for sessions)/i,
          /(?:sessions).+(?:in course|course)/i,
          /(?:course).+(?:sessions)/i
        ],
        extractEntities: () => ({
          courseId: courseId,
          courseName: courseName || this.extractCourseFromSessionQuery(message),
          sessionFilter: this.extractSessionFilter(message)
        }),
        confidence: 0.8
      },
      
      // Material search patterns
      {
        intent: 'search_materials_in_course',
        patterns: [
          /(?:search for materials|find materials|materials in course|training materials)/i,
          /(?:materials).+(?:in course|course)/i,
          /(?:course).+(?:materials)/i
        ],
        extractEntities: () => ({
          courseId: courseId,
          courseName: courseName || this.extractCourseFromMaterialQuery(message),
          materialFilter: this.extractMaterialFilter(message)
        }),
        confidence: 0.8
      },
      
      // User search patterns - LOWER PRIORITY than enrollments
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details|who is|tell me about)(?!\s+enrollments)/i,
          /@[\w.-]+\.\w+(?!\s+enrollments)/i  // Email without "enrollments" following
        ],
        extractEntities: () => ({
          email: email,
          searchTerm: email || this.extractAfterPattern(message, /(?:find user|search user|look up user|user info|user details)\s+(.+)/i)
        }),
        confidence: email ? 0.90 : 0.7  // Lower confidence than enrollment requests
      },
      
      // Course search patterns
      {
        intent: 'search_courses',
        patterns: [
          /(?:find course|search course|look for course|course search)/i,
          /(?:find|search).+course/i,
          /(?:courses about|courses on|courses for)/i
        ],
        extractEntities: () => ({
          searchTerm: courseName || this.extractAfterPattern(message, /(?:find|search|look for)\s+(.+?)\s+course/i) ||
                     this.extractAfterPattern(message, /(?:courses about|courses on|courses for)\s+(.+)/i)
        }),
        confidence: 0.8
      },
      
      // Learning plan search patterns
      {
        intent: 'search_learning_plans',
        patterns: [
          /(?:find learning plan|search learning plan|learning plans about|learning plans for)/i,
          /(?:find|search).+learning plan/i,
          /learning plans?/i
        ],
        extractEntities: () => ({
          searchTerm: learningPlanName || this.extractAfterPattern(message, /(?:find|search)\s+(.+?)\s+learning plan/i) ||
                     this.extractAfterPattern(message, /(?:learning plans about|learning plans for)\s+(.+)/i)
        }),
        confidence: 0.8
      },

      // User enrollment patterns - HIGHER PRIORITY
      {
        intent: 'get_user_enrollments',
        patterns: [
          /(?:user enrollments|enrollments for user|enrollments for|show enrollments)/i,
          /(?:what courses is|what learning plans is|what is.*enrolled)/i,
          /(?:enrolled in|taking|assigned to|learning progress|user progress)/i,
          /(?:get enrollments|show courses for|list courses for)/i
        ],
        extractEntities: () => ({
          email: email,
          userId: email || this.extractAfterPattern(message, /(?:user enrollments|enrollments for|show enrollments|get enrollments|show courses for|list courses for)\s+(.+?)(?:\s|$)/i)
        }),
        confidence: email ? 0.98 : 0.85  // Higher confidence for enrollment requests
      },
      
      // Help patterns
      {
        intent: 'docebo_help',
        patterns: [
          /(?:how to|how do i|how does|how can i)/i,
          /(?:help|guide|tutorial|documentation)/i,
          /(?:configure|setup|enable|create|manage)/i,
          /(?:troubleshoot|problem|issue|error)/i
        ],
        extractEntities: () => ({
          query: message
        }),
        confidence: 0.6
      }
    ];
    
    // Find best matching pattern
    let bestMatch = { intent: 'unknown', entities: {}, confidence: 0 };
    
    for (const pattern of patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(lower)) {
          if (pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              intent: pattern.intent,
              entities: pattern.extractEntities(),
              confidence: pattern.confidence
            };
          }
        }
      }
    }
    
    return bestMatch;
  }
  
  static extractEmail(message: string): string | null {
    const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return match ? match[0] : null;
  }
  
  static extractCourseId(message: string): string | null {
    const patterns = [
      /(?:course\s+)?id[:\s]+(\d+)/i,
      /(?:course\s+)?#(\d+)/i,
      /\bid\s*:?\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  static extractCourseName(message: string): string | null {
    const patterns = [
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:tell me about course\s+|info about course\s+)(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:in course\s+|course named\s+|course called\s+)(.+?)(?:\s|$)/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        name = name.replace(/^(info|details|about|course)\s+/i, '');
        return name;
      }
    }
    return null;
  }
  
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      /(?:learning plan info\s+|lp info\s+|plan info\s+)(.+)/i,
      /(?:tell me about learning plan\s+|learning plan details\s+)(.+)/i,
      /(?:info\s+|details\s+)(.+?)(?:\s+learning plan)?$/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        if (!name.match(/^(for|about|on|in|the|a|an|info|details)$/i)) {
          name = name.replace(/^(info|details|about|learning plan)\s+/i, '');
          return name;
        }
      }
    }
    return null;
  }
  
  static extractCourseFromSessionQuery(message: string): string | null {
    const patterns = [
      /sessions in course\s+(.+)/i,
      /in course\s+(.+?)(?:\s+sessions)?$/i,
      /course\s+(.+?)\s+sessions/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return null;
  }
  
  static extractCourseFromMaterialQuery(message: string): string | null {
    const patterns = [
      /materials in course\s+(.+)/i,
      /in course\s+(.+?)(?:\s+materials)?$/i,
      /course\s+(.+?)\s+materials/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return null;
  }
  
  static extractSessionFilter(message: string): string | null {
    const match = message.match(/(?:search for|find)\s+(.+?)\s+sessions/i);
    return match && match[1] && match[1] !== 'for' ? match[1].trim() : null;
  }
  
  static extractMaterialFilter(message: string): string | null {
    const match = message.match(/(?:search for|find)\s+(.+?)\s+(?:materials|training materials)/i);
    return match && match[1] && match[1] !== 'for' ? match[1].trim() : null;
  }
  
  static extractAfterPattern(message: string, pattern: RegExp): string | null {
    const match = message.match(pattern);
    return match && match[1] ? match[1].trim() : null;
  }
}

// Docebo API client
class DoceboAPI {
  private config: any;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: any) {
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

  private async apiRequest(endpoint: string, params?: any): Promise<any> {
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

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Docebo API error: ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  }

  async findCourseByIdentifier(identifier: string): Promise<any> {
    console.log(`🔍 Finding course: "${identifier}"`);
    
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/course/v1/courses/${identifier}`);
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

  async getCourseDetails(identifier: string): Promise<any> {
    const course = await this.findCourseByIdentifier(identifier);
    const courseId = course.id || course.course_id;
    
    try {
      const detailsResult = await this.apiRequest(`/course/v1/courses/${courseId}`);
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
        const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`);
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

  async searchSessionsInCourse(courseIdentifier: string, sessionFilter?: string): Promise<any> {
    const course = await this.findCourseByIdentifier(courseIdentifier);
    const courseId = course.id || course.course_id;
    
    const sessionEndpoints = [
      `/course/v1/courses/${courseId}/sessions`,
      `/learn/v1/courses/${courseId}/sessions`,
      `/course/v1/sessions?course_id=${courseId}`,
      `/learn/v1/sessions?course_id=${courseId}`
    ];
    
    for (const endpoint of sessionEndpoints) {
      try {
        const result = await this.apiRequest(endpoint);
        if (result.data?.items?.length > 0) {
          let sessions = result.data.items;
          
          if (sessionFilter) {
            sessions = sessions.filter((s: any) => {
              const sessionName = this.getSessionName(s).toLowerCase();
              return sessionName.includes(sessionFilter.toLowerCase());
            });
          }
          
          return {
            course: course,
            sessions: sessions,
            totalSessions: sessions.length,
            endpoint: endpoint
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return {
      course: course,
      sessions: [],
      totalSessions: 0,
      endpoint: 'none_available'
    };
  }

  async searchMaterialsInCourse(courseIdentifier: string, materialFilter?: string): Promise<any> {
    const course = await this.findCourseByIdentifier(courseIdentifier);
    const courseId = course.id || course.course_id;
    
    const materialEndpoints = [
      `/course/v1/courses/${courseId}/lo`,
      `/learn/v1/courses/${courseId}/lo`,
      `/course/v1/courses/${courseId}/materials`,
      `/learn/v1/courses/${courseId}/materials`
    ];
    
    for (const endpoint of materialEndpoints) {
      try {
        const result = await this.apiRequest(endpoint);
        if (result.data?.items?.length > 0) {
          let materials = result.data.items;
          
          if (materialFilter) {
            materials = materials.filter((m: any) => {
              const materialName = this.getMaterialName(m).toLowerCase();
              return materialName.includes(materialFilter.toLowerCase());
            });
          }
          
          return {
            course: course,
            materials: materials,
            totalMaterials: materials.length,
            endpoint: endpoint
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return {
      course: course,
      materials: [],
      totalMaterials: 0,
      endpoint: 'none_available'
    };
  }

  async searchUsers(searchText: string, limit: number = 100): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 100): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchLearningPlans(searchText: string, limit: number = 100): Promise<any[]> {
    try {
      const result = await this.apiRequest('/learningplan/v1/learningplans', {
        search_text: searchText,
        page_size: Math.min(limit, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (result.data?.items?.length > 0) {
        return result.data.items;
      }
      
      const allResult = await this.apiRequest('/learningplan/v1/learningplans', {
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

  async getUserDetails(email: string): Promise<any> {
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    return {
      id: user.user_id || user.id,
      fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Not available',
      email: user.email,
      username: user.username || 'Not available',
      status: user.status === '1' ? 'Active' : user.status === '0' ? 'Inactive' : `Status: ${user.status}`,
      level: user.level === 'godadmin' ? 'Superadmin' : user.level || 'User',
      creationDate: user.register_date || user.creation_date || user.created_at || 'Not available',
      lastAccess: user.last_access_date || user.last_access || user.last_login || 'Not available',
      timezone: user.timezone || 'Not specified',
      language: user.language || user.lang_code || 'Not specified',
      department: user.department || 'Not specified'
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
        const result = await this.apiRequest(endpoint);
        
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
        const result = await this.apiRequest(endpoint);
        
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
          // Handle case where data is directly an array
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

  async getUserAllEnrollments(userId: string): Promise<any> {
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
        courses: { enrollments: [], totalCount: 0, success: false },
        learningPlans: { enrollments: [], totalCount: 0, success: false },
        totalCourses: 0,
        totalLearningPlans: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  formatCourseEnrollment(enrollment: any): any {
    return {
      courseId: enrollment.course_id || enrollment.id_course,
      courseName: enrollment.course_name || enrollment.name || 'Unknown Course',
      enrollmentStatus: enrollment.status || enrollment.enrollment_status || 'Unknown',
      enrollmentDate: enrollment.enrollment_date || enrollment.enrolled_at || enrollment.date_enrolled,
      completionDate: enrollment.completion_date || enrollment.completed_at || enrollment.date_completed,
      progress: enrollment.progress || enrollment.completion_percentage || 0,
      score: enrollment.score || enrollment.final_score || null,
      timeSpent: enrollment.time_spent || enrollment.total_time || null,
      lastAccess: enrollment.last_access || enrollment.last_access_date || null,
      dueDate: enrollment.due_date || enrollment.deadline || null
    };
  }

  formatLearningPlanEnrollment(enrollment: any): any {
    return {
      learningPlanId: enrollment.learning_plan_id || enrollment.id_learning_plan,
      learningPlanName: enrollment.learning_plan_name || enrollment.name || 'Unknown Learning Plan',
      enrollmentStatus: enrollment.status || enrollment.enrollment_status || 'Unknown',
      enrollmentDate: enrollment.enrollment_date || enrollment.enrolled_at || enrollment.date_enrolled,
      completionDate: enrollment.completion_date || enrollment.completed_at || enrollment.date_completed,
      progress: enrollment.progress || enrollment.completion_percentage || 0,
      completedCourses: enrollment.completed_courses || enrollment.courses_completed || 0,
      totalCourses: enrollment.total_courses || enrollment.courses_total || 0,
      lastAccess: enrollment.last_access || enrollment.last_access_date || null,
      dueDate: enrollment.due_date || enrollment.deadline || null
    };
  }

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

  getSessionName(session: any): string {
    return session.name || session.session_name || session.title || 'Unknown Session';
  }

  getMaterialName(material: any): string {
    return material.title || material.name || material.material_name || 'Unknown Material';
  }
}

let api: DoceboAPI;

// Handler functions
async function handleCourseInfo(entities: any) {
  const identifier = entities.courseId || entities.courseName;
  
  if (!identifier) {
    return NextResponse.json({
      response: `❌ **Missing Course**: I need a course name or ID to get information about.

**Examples:**
• "Course info Working with Data in Python"
• "Course info ID: 994"
• "Tell me about course Python Programming"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const course = await api.getCourseDetails(identifier);
    const courseName = api.getCourseName(course);
    const courseId = course.id || course.course_id || course.idCourse;
    
    const status = course.status || 'Unknown';
    const statusText = status === 'published' ? 'Published ✅' : 
                      status === 'draft' ? 'Draft 📝' : 
                      status === 'suspended' ? 'Suspended 🚫' : 
                      `${status} ❓`;
    
    const rawDescription = course.description || course.short_description || 'No description available';
    let description = rawDescription
      .replace(/<\/li>/g, '\n• ')
      .replace(/<li>/g, '• ')
      .replace(/<\/ul>/g, '\n')
      .replace(/<ul>/g, '\n')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<p>/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/^•\s*/, '')
      .trim();
    
    const courseType = course.type || 'Not specified';
    const code = course.code || 'Not specified';
    const credits = course.credits || 'No credits assigned';
    const enrolledCount = course.enrolled_count !== undefined ? course.enrolled_count : 'Not available';
    const createdDate = course.created_on || 'Not available';
    const modifiedDate = course.updated_on || 'Not available';
    
    return NextResponse.json({
      response: `📚 **Course Details**: ${courseName}

🆔 **Course ID**: ${courseId}
📊 **Status**: ${statusText}
🎯 **Code**: ${code}
⭐ **Credits**: ${credits}

📝 **Description**: 
${description}

📈 **Enrollment Statistics**:
• **👥 Enrolled Count**: ${enrolledCount}

📅 **Timeline**:
• **Created**: ${createdDate}
• **Last Updated**: ${modifiedDate}

**Course found successfully!**`,
      success: true,
      data: course,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Course Not Found**: Could not find course "${identifier}"

**Suggestions:**
• Try searching for courses first: "Find ${identifier} courses"
• Check the course name spelling
• Use the exact course ID if you have it`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleLearningPlanInfo(entities: any) {
  const identifier = entities.learningPlanName;
  
  if (!identifier) {
    return NextResponse.json({
      response: `❌ **Missing Learning Plan**: I need a learning plan name or ID to get information about.

**Examples:**
• "Learning plan info Getting Started with Python"
• "Learning plan info Associate Memory Network"
• "Tell me about learning plan 111"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const lp = await api.getLearningPlanDetails(identifier);
    const lpName = api.getLearningPlanName(lp);
    const lpId = lp.learning_plan_id || lp.id;
    const status = lp.is_published ? 'Published ✅' : 'Unpublished ❌';
    
    return NextResponse.json({
      response: `📋 **Learning Plan Details**: ${lpName}

🆔 **ID**: ${lpId}
📊 **Status**: ${status}
🎯 **Code**: ${lp.code || 'Not specified'}
⭐ **Credits**: ${lp.credits || 'No credits assigned'}

📈 **Enrollment Statistics**:
• **👥 Users Enrolled**: ${lp.assigned_enrollments_count || 0}
• **📚 Courses**: ${lp.assigned_courses_count || 0}

📅 **Created**: ${lp.created_on || 'Not available'}
📅 **Updated**: ${lp.updated_on || 'Not available'}

**Learning plan found successfully!**`,
      success: true,
      data: lp,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Learning Plan Not Found**: Could not find learning plan "${identifier}"

**Suggestions:**
• Try searching for learning plans first: "Find ${identifier} learning plans"
• Check the learning plan name spelling
• Use the exact learning plan ID if you have it`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleUserSearch(entities: any) {
  const searchTerm = entities.email || entities.searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({
      response: `❌ **Missing Search Term**: I need a name or email to search for.

**Examples:**
• "Find user mike@company.com"
• "Find user John Smith"
• "User info sarah@company.com"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    if (entities.email) {
      const userDetails = await api.getUserDetails(entities.email);
      const enrollmentData = await api.getUserAllEnrollments(userDetails.id);
      
      let enrollmentSummary = '';
      if (enrollmentData.success) {
        enrollmentSummary = `

📚 **Enrollment Summary**:
• **👥 Courses**: ${enrollmentData.totalCourses} enrollments
• **📋 Learning Plans**: ${enrollmentData.totalLearningPlans} enrollments`;
      }
      
      return NextResponse.json({
        response: `👥 **User Found**: ${userDetails.fullname}

📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
👤 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
🏛️ **Department**: ${userDetails.department}
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}${enrollmentSummary}

💡 **Get detailed enrollments**: "User enrollments ${userDetails.email}"`,
        success: true,
        timestamp: new Date().toISOString()
      });
    } else {
      const users = await api.searchUsers(searchTerm, 100);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `👥 **No Users Found**: No users match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const userList = users.slice(0, 10).map((user, i) => {
        const statusIcon = user.status === '1' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users

${userList}${users.length > 10 ? `\n\n... and ${users.length - 10} more users` : ''}

💡 **Get user details**: "Find user [email]"
💡 **Get user enrollments**: "User enrollments [email]"`,
        success: true,
        totalCount: users.length,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleCourseSearch(entities: any) {
  const searchTerm = entities.searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({
      response: `❌ **Missing Search Term**: I need a course name to search for.

**Examples:**
• "Find Python courses"
• "Search for JavaScript courses"
• "Find courses about data analysis"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const courses = await api.searchCourses(searchTerm, 100);
    
    if (courses.length === 0) {
      return NextResponse.json({
        response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const courseList = courses.slice(0, 10).map((course, i) => {
      const courseName = api.getCourseName(course);
      const courseId = course.id || course.course_id || 'N/A';
      const status = course.status || 'Unknown';
      const statusText = status === 'published' ? 'Published ✅' : 
                        status === 'draft' ? 'Draft 📝' : 
                        status === 'suspended' ? 'Suspended 🚫' : 
                        `${status} ❓`;
      
      return `${i + 1}. **${courseName}** (ID: ${courseId})
   📊 ${statusText}`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 10 ? `\n\n... and ${courses.length - 10} more courses` : ''}

**Search Term**: "${searchTerm}"`,
      success: true,
      totalCount: courses.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleLearningPlanSearch(entities: any) {
  const searchTerm = entities.searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({
      response: `❌ **Missing Search Term**: I need a learning plan name to search for.

**Examples:**
• "Find Python learning plans"
• "Search for leadership learning plans"
• "Find learning plans about data science"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const learningPlans = await api.searchLearningPlans(searchTerm, 100);
    
    if (learningPlans.length === 0) {
      return NextResponse.json({
        response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"

**Suggestions:**
• Try broader search terms
• Check spelling
• Try: "Find Python" instead of "Find Python Programming"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const planList = learningPlans.slice(0, 10).map((plan, i) => {
      const planName = api.getLearningPlanName(plan);
      const planId = plan.learning_plan_id || plan.id || 'N/A';
      const status = plan.is_published ? 'Published ✅' : 'Unpublished ❌';
      
      return `${i + 1}. **${planName}** (ID: ${planId})
   📊 ${status}`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans

${planList}${learningPlans.length > 10 ? `\n\n... and ${learningPlans.length - 10} more learning plans` : ''}

**API Endpoint Used**: \`/learningplan/v1/learningplans\``,
      success: true,
      totalCount: learningPlans.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleUserEnrollments(entities: any) {
  const identifier = entities.email || entities.userId;
  
  if (!identifier) {
    return NextResponse.json({
      response: `❌ **Missing User**: I need a user email or ID to get enrollment information.

**Examples:**
• "User enrollments mike@company.com"
• "What courses is sarah@company.com enrolled in?"
• "Show enrollments for john@company.com"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log(`📊 Getting enrollments for: ${identifier}`);
  
  try {
    let userId: string;
    let userDetails: any;
    
    if (identifier.includes('@')) {
      userDetails = await api.getUserDetails(identifier);
      userId = userDetails.id;
    } else {
      userId = identifier;
      try {
        const users = await api.searchUsers(identifier, 1);
        userDetails = users.length > 0 ? users[0] : { fullname: `User ${userId}`, email: 'Unknown' };
      } catch (error) {
        userDetails = { fullname: `User ${userId}`, email: 'Unknown' };
      }
    }
    
    console.log(`🔍 Fetching enrollment data for user ID: ${userId}`);
    const enrollmentData = await api.getUserAllEnrollments(userId);
    
    if (!enrollmentData.success) {
      return NextResponse.json({
        response: `😔 **Oops! I couldn't find enrollment data for ${userDetails.fullname}**

**What I checked:**
• Course enrollments via: ${enrollmentData.courses?.endpoint || 'N/A'}
• Learning plan enrollments via: ${enrollmentData.learningPlans?.endpoint || 'N/A'}

**This might happen if:**
• The user isn't enrolled in anything yet
• API permissions don't allow access to enrollment data
• There's a temporary connectivity issue

**Want to try something else?**
• Check user profile: "Find user ${identifier}"
• Search for courses: "Find Python courses"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    let courseSection = '';
    if (enrollmentData.courses.success && enrollmentData.totalCourses > 0) {
      console.log(`📚 Processing ${enrollmentData.totalCourses} course enrollments`);
      
      const formattedCourses = enrollmentData.courses.enrollments.slice(0, 100).map((enrollment: any, i: number) => {
        const formatted = api.formatCourseEnrollment(enrollment);
        
        // Status with appropriate icons
        let statusIcon = '📚';
        let statusText = '';
        
        if (formatted.enrollmentStatus === 'completed') {
          statusIcon = '✅';
          statusText = 'Completed';
        } else if (formatted.enrollmentStatus === 'in_progress' || formatted.enrollmentStatus === 'in-progress') {
          statusIcon = '🔄';
          statusText = 'In Progress';
        } else if (formatted.enrollmentStatus === 'not_started' || formatted.enrollmentStatus === 'not-started') {
          statusIcon = '⏳';
          statusText = 'Not Started';
        } else if (formatted.enrollmentStatus === 'enrolled') {
          statusIcon = '📚';
          statusText = 'Enrolled';
        } else {
          statusIcon = '❓';
          statusText = formatted.enrollmentStatus || 'Unknown';
        }
        
        const progressText = formatted.progress > 0 ? ` (${formatted.progress}%)` : '';
        const scoreText = formatted.score ? ` | 🎯 ${formatted.score}` : '';
        
        // Format date nicely
        let dateText = '';
        if (formatted.enrollmentDate && formatted.enrollmentDate !== 'Unknown') {
          try {
            const date = new Date(formatted.enrollmentDate);
            dateText = date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
          } catch {
            dateText = formatted.enrollmentDate;
          }
        } else {
          dateText = 'Date not available';
        }
        
        return `${i + 1}. ${statusIcon} **${formatted.courseName}** - *${statusText}*${progressText}${scoreText}
   📅 Enrolled: ${dateText}${formatted.completionDate ? ` | ✅ Completed: ${formatted.completionDate}` : ''}`;
      }).join('\n\n');
      
      courseSection = `📚 **Courses** (${enrollmentData.totalCourses} total)

${formattedCourses}`;
    }
    
    let learningPlanSection = '';
    if (enrollmentData.learningPlans.success && enrollmentData.totalLearningPlans > 0) {
      console.log(`📋 Processing ${enrollmentData.totalLearningPlans} learning plan enrollments`);
      
      const formattedPlans = enrollmentData.learningPlans.enrollments.slice(0, 100).map((enrollment: any, i: number) => {
        const formatted = api.formatLearningPlanEnrollment(enrollment);
        
        // Status with appropriate icons
        let statusIcon = '📋';
        let statusText = '';
        
        if (formatted.enrollmentStatus === 'completed') {
          statusIcon = '✅';
          statusText = 'Completed';
        } else if (formatted.enrollmentStatus === 'in_progress' || formatted.enrollmentStatus === 'in-progress') {
          statusIcon = '🔄';
          statusText = 'In Progress';
        } else if (formatted.enrollmentStatus === 'not_started' || formatted.enrollmentStatus === 'not-started') {
          statusIcon = '⏳';
          statusText = 'Not Started';
        } else if (formatted.enrollmentStatus === 'enrolled') {
          statusIcon = '📋';
          statusText = 'Enrolled';
        } else {
          statusIcon = '❓';
          statusText = formatted.enrollmentStatus || 'Unknown';
        }
        
        const progressText = formatted.progress > 0 ? ` (${formatted.progress}%)` : '';
        const coursesText = formatted.totalCourses > 0 ? ` | 📚 ${formatted.completedCourses}/${formatted.totalCourses} courses` : '';
        
        // Format date nicely
        let dateText = '';
        if (formatted.enrollmentDate && formatted.enrollmentDate !== 'Unknown') {
          try {
            const date = new Date(formatted.enrollmentDate);
            dateText = date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
          } catch {
            dateText = formatted.enrollmentDate;
          }
        } else {
          dateText = 'Date not available';
        }
        
        return `${i + 1}. ${statusIcon} **${formatted.learningPlanName}** - *${statusText}*${progressText}${coursesText}
   📅 Enrolled: ${dateText}`;
      }).join('\n\n');
      
      learningPlanSection = `🎯 **Learning Plans** (${enrollmentData.totalLearningPlans} total)

${formattedPlans}`;
    } else {
      // Try to provide helpful info about why no learning plans were found
      learningPlanSection = `🎯 **Learning Plans**

🔍 No learning plan enrollments found using endpoint: ${enrollmentData.learningPlans?.endpoint || 'none available'}

*Note: This might mean ${userDetails.fullname} isn't enrolled in any learning plans, or they might be enrolled in individual courses instead of structured learning paths.*`;
    }
    
    const sections = [courseSection, learningPlanSection].filter(section => section).join('\n\n');
    
    if (!sections && enrollmentData.totalCourses === 0 && enrollmentData.totalLearningPlans === 0) {
      return NextResponse.json({
        response: `📊 **${userDetails.fullname}'s Learning Journey**

👋 Hi! Here's what I found for **${userDetails.fullname}** (${userDetails.email}):

🎒 **Currently Not Enrolled**
It looks like ${userDetails.fullname.split(' ')[0]} isn't enrolled in any courses or learning plans right now.

**Ready to get started?** Here are some options:
• Browse available courses: "Find Python courses"
• Search learning plans: "Find leadership learning plans"
• Check user profile: "Find user ${userDetails.email}"

*API checked: Course endpoint (${enrollmentData.courses?.endpoint}) and Learning Plan endpoint (${enrollmentData.learningPlans?.endpoint})*`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate comprehensive stats for courses
    const courseStats = {
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      enrolled: 0,
      unknown: 0
    };
    
    enrollmentData.courses.enrollments?.forEach((e: any) => {
      const status = api.formatCourseEnrollment(e).enrollmentStatus;
      if (status === 'completed') courseStats.completed++;
      else if (status === 'in_progress' || status === 'in-progress') courseStats.inProgress++;
      else if (status === 'not_started' || status === 'not-started') courseStats.notStarted++;
      else if (status === 'enrolled') courseStats.enrolled++;
      else courseStats.unknown++;
    });
    
    // Calculate comprehensive stats for learning plans
    const lpStats = {
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      enrolled: 0,
      unknown: 0
    };
    
    enrollmentData.learningPlans.enrollments?.forEach((e: any) => {
      const status = api.formatLearningPlanEnrollment(e).enrollmentStatus;
      if (status === 'completed') lpStats.completed++;
      else if (status === 'in_progress' || status === 'in-progress') lpStats.inProgress++;
      else if (status === 'not_started' || status === 'not-started') lpStats.notStarted++;
      else if (status === 'enrolled') lpStats.enrolled++;
      else lpStats.unknown++;
    });
    
    // Build comprehensive stats display
    let courseStatsText = '';
    if (enrollmentData.totalCourses > 0) {
      const statParts = [];
      if (courseStats.completed > 0) statParts.push(`${courseStats.completed} completed`);
      if (courseStats.inProgress > 0) statParts.push(`${courseStats.inProgress} in progress`);
      if (courseStats.notStarted > 0) statParts.push(`${courseStats.notStarted} not started`);
      if (courseStats.enrolled > 0) statParts.push(`${courseStats.enrolled} enrolled`);
      if (courseStats.unknown > 0) statParts.push(`${courseStats.unknown} other status`);
      courseStatsText = `**${enrollmentData.totalCourses} courses total** (${statParts.join(', ')})`;
    } else {
      courseStatsText = '**0 courses**';
    }
    
    let lpStatsText = '';
    if (enrollmentData.totalLearningPlans > 0) {
      const statParts = [];
      if (lpStats.completed > 0) statParts.push(`${lpStats.completed} completed`);
      if (lpStats.inProgress > 0) statParts.push(`${lpStats.inProgress} in progress`);
      if (lpStats.notStarted > 0) statParts.push(`${lpStats.notStarted} not started`);
      if (lpStats.enrolled > 0) statParts.push(`${lpStats.enrolled} enrolled`);
      if (lpStats.unknown > 0) statParts.push(`${lpStats.unknown} other status`);
      lpStatsText = `**${enrollmentData.totalLearningPlans} learning plans** (${statParts.join(', ')})`;
    } else {
      lpStatsText = '**0 learning plans**';
    }
    
    return NextResponse.json({
      response: `📊 **${userDetails.fullname}'s Learning Journey**

👋 Hi! Here's ${userDetails.fullname.split(' ')[0]}'s learning progress:

${sections}

🎉 **Quick Stats:**
• 📚 ${courseStatsText}
• 🎯 ${lpStatsText}
• 🏆 **Status**: ${userDetails.status} ${userDetails.level}

*Keep up the great work! 🌟*`,
      success: true,
      data: enrollmentData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Enrollment fetch error:', error);
    return NextResponse.json({
      response: `😔 **Oops! Something went wrong**

I had trouble getting enrollment info for "${identifier}".

**Error details**: ${error instanceof Error ? error.message : 'Unknown error'}

**Let's try something else:**
• Check if user exists: "Find user ${identifier}"
• Browse courses: "Find courses"
• Get help: "How to check enrollments"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleDoceboHelp(entities: any) {
  const query = entities.query;
  
  return NextResponse.json({
    response: `🎯 **Docebo Help Request**: "${query}"

📖 **Manual Search Required**

For immediate assistance, please visit:
**Direct Link**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

**Popular Help Topics:**
• User management and enrollment
• Course creation and publishing  
• Reports and analytics
• Mobile app configuration
• API and integrations
• Learning plans and paths

💡 **Tip**: Try specific keywords in the help center for better results.`,
    success: true,
    helpRequest: true,
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!api) {
      const config = getConfig();
      api = new DoceboAPI(config);
    }

    const body = await request.json();
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: '❌ Please provide a valid message',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🤖 Processing: "${message}"`);
    
    const analysis = IntentAnalyzer.analyzeIntent(message);
    console.log(`🎯 Intent: ${analysis.intent}, Confidence: ${analysis.confidence}`);
    
    try {
      switch (analysis.intent) {
        case 'get_course_info':
          return await handleCourseInfo(analysis.entities);
          
        case 'get_learning_plan_info':
          return await handleLearningPlanInfo(analysis.entities);
          
        case 'search_users':
          return await handleUserSearch(analysis.entities);
          
        case 'search_courses':
          return await handleCourseSearch(analysis.entities);
          
        case 'search_learning_plans':
          return await handleLearningPlanSearch(analysis.entities);

        case 'get_user_enrollments':
          return await handleUserEnrollments(analysis.entities);
          
        case 'docebo_help':
          return await handleDoceboHelp(analysis.entities);
          
        default:
          return NextResponse.json({
            response: `🤔 **I'm not sure what you're asking for**

Based on your message: "${message}"

**I can help you with:**
• **👥 Find Users**: "Find user email@company.com"
• **📊 User Enrollments**: "User enrollments email@company.com"
• **📚 Find/Info Courses**: "Find Python courses" or "Course info Working with Data in Python"  
• **📋 Find/Info Learning Plans**: "Find Python learning plans" or "Learning plan info Getting Started with Python"
• **🆘 Help**: "How to enroll users in Docebo"

**Try rephrasing your question or use one of the examples above.**`,
            success: false,
            intent: analysis.intent,
            confidence: analysis.confidence,
            timestamp: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('❌ Processing error:', error);
      return NextResponse.json({
        response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Enhanced Docebo Chat API with Enrollment Data',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Enhanced natural language processing',
      'Intent-based command detection',
      'Course info retrieval with enrollment data',
      'Learning plan info retrieval',
      'User enrollment tracking',
      'Comprehensive enrollment analysis',
      'User search and details with enrollment summary',
      'Course search with enrollment data', 
      'Learning plan search',
      'Docebo help integration'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans',
      'course_enrollments': '/course/v1/courses/enrollments',
      'lp_enrollments': '/learningplan/v1/learningplans/enrollments',
      'user_enrollments': '/learn/v1/enrollments'
    },
    nlp_capabilities: [
      'Course info: "Course info Working with Data in Python"',
      'Learning plan info: "Learning plan info Getting Started with Python"',
      'User enrollments: "User enrollments mike@company.com"',
      'Enrollment queries: "What courses is john@company.com enrolled in?"',
      'Learning progress: "Learning progress for sarah@company.com"',
      'User search: "Find user mike@company.com"',
      'Course search: "Find Python courses"',
      'Learning plan search: "Find Python learning plans"',
      'Help requests: "How to enroll users in Docebo"'
    ]
  });
}
