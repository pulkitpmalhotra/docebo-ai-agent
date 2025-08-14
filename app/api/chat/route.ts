// app/api/chat/route.ts - Fixed version with proper syntax
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
      
      // User search patterns
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details)/i,
          /(?:who is|tell me about).+@/i,
          /@[\w.-]+\.\w+/i
        ],
        extractEntities: () => ({
          email: email,
          searchTerm: email || this.extractAfterPattern(message, /(?:find user|search user|look up user|user info|user details)\s+(.+)/i)
        }),
        confidence: email ? 0.95 : 0.7
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
      
      // User enrollment patterns
      {
        intent: 'get_user_enrollments',
        patterns: [
          /(?:user enrollments|enrollments for user|what courses is|what learning plans is)/i,
          /(?:enrolled in|taking|assigned to)/i,
          /(?:user progress|learning progress)/i
        ],
        extractEntities: () => ({
          email: email,
          userId: this.extractAfterPattern(message, /(?:user|for)\s+(.+?)(?:\s|$)/i)
        }),
        confidence: email ? 0.95 : 0.8
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
    
    return NextResponse.json({
      response: `📚 **Course Details**: ${courseName}

🆔 **Course ID**: ${courseId}
📊 **Status**: ${statusText}
🎯 **Code**: ${course.code || 'Not specified'}

📝 **Description**: 
${course.description || 'No description available'}

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
• **📂 Catalogs**: ${lp.assigned_catalogs_count || 0}

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
🔐 **Last Access**: ${userDetails.lastAccess}

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

💡 **Get user details**: "Find user [email]"`,
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
      
      const status = course.status || course.course_status || 'Unknown';
      const statusText = status === 'published' ? 'Published ✅' : 
                        status === 'draft' ? 'Draft 📝' : 
                        status === 'suspended' ? 'Suspended 🚫' : 
                        `${status} ❓`;
      
      const enrollmentCount = course.enrolled_count !== undefined ? course.enrolled_count : 0;
      const courseType = course.type || course.course_type || 'Unknown';
      
      return `${i + 1}. **${courseName}** (ID: ${courseId})
   📊 ${statusText} | 👥 ${enrollmentCount} enrollments | 🔗 ${courseType}`;
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
      const enrollmentCount = plan.assigned_enrollments_count || 0;
      
      return `${i + 1}. **${planName}** (ID: ${planId})
   📊 ${status} | 👥 ${enrollmentCount} enrollments`;
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
• "Learning progress for john@company.com"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const userDetails = await api.getUserDetails(identifier);
    
    return NextResponse.json({
      response: `📊 **User Enrollments**: ${userDetails.fullname}

👥 **User**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}

📚 **Enrollment data retrieval is being implemented**

This feature will show:
- Course enrollments with progress
- Learning plan enrollments
- Completion status and scores

**Current Status**: User found and verified`,
      success: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Suggestions:**
• Verify the user email/ID is correct
• Try: "Find user ${identifier}" to confirm user exists`,
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
• Certifications and badges

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
    console.log(`🎯 Intent: ${analysis.intent}, Confidence: ${analysis.confidence}, Entities:`, analysis.entities);
    
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
• **📊 User Enrollments**: "User enrollments email@company.com" or "What courses is user@company.com enrolled in?"
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

// Updated GET endpoint
export async function GET() {
  return NextResponse.json({
    status: 'Docebo Chat API - Fixed Version',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Enhanced natural language processing',
      'Intent-based command detection',
      'Course info retrieval',
      'Learning plan info retrieval',
      'User search and details',
      'Course search', 
      'Learning plan search',
      'User enrollment tracking (in development)',
      'Docebo help integration'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans'
    },
    nlp_capabilities: [
      'Course info: "Course info Working with Data in Python"',
      'Learning plan info: "Learning plan info Getting Started with Python"',
      'User search: "Find user mike@company.com"',
      'Course search: "Find Python courses"',
      'Learning plan search: "Find Python learning plans"',
      'Help requests: "How to enroll users in Docebo"'
    ]
  });
}
