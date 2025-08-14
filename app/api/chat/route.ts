// app/api/chat/route.ts - Enhanced with better natural language processing
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
          /(?:info|details)\s+(.+)$/i // Catch "info XYZ" patterns
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
      
      // User search patterns
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details)/i,
          /(?:who is|tell me about).+@/i,
          /@[\w.-]+\.\w+/i // Email presence suggests user search
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
    // Look for "course id 123", "course ID: 123", "ID 123", etc.
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
    // Extract course names from various patterns
    const patterns = [
      /(?:course|course info|course details)\s+(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:in course|course named|course called)\s+(.+?)(?:\s|$)/i,
      /"([^"]+)"/,  // Quoted strings
      /\[([^\]]+)\]/ // Bracketed strings
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        return match[1].trim();
      }
    }
    return null;
  }
  
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      /(?:learning plan info|lp info|plan info)\s+(.+)/i,
      /(?:learning plan|lp)\s+(.+?)(?:\s|$)/i,
      /(?:info|details)\s+(.+?)(?:\s+learning plan)?$/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        // Clean up common false positives
        if (!name.match(/^(for|about|on|in|the|a|an)$/i)) {
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

// Docebo API client (enhanced)
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
    
    // Try direct ID lookup first if it's numeric
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
    
    // Search by name
    const courses = await this.searchCourses(identifier, 20);
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
    
    // Get additional course details
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
    
    // Try direct ID lookup first if it's numeric
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
    
    // Search by name
    const learningPlans = await this.searchLearningPlans(identifier, 20);
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

  async searchUsers(searchText: string, limit: number = 20): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 20): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchLearningPlans(searchText: string, limit: number = 20): Promise<any[]> {
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
      
      // Fallback: manual filtering
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

  getSessionName(session: any): string {
    return session.name || session.session_name || session.title || 'Unknown Session';
  }

  getMaterialName(material: any): string {
    return material.title || material.name || material.material_name || 'Unknown Material';
  }
}

let api: DoceboAPI;

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
    
    // Analyze intent using enhanced NLP
    const analysis = IntentAnalyzer.analyzeIntent(message);
    console.log(`🎯 Intent: ${analysis.intent}, Confidence: ${analysis.confidence}, Entities:`, analysis.entities);
    
    try {
      switch (analysis.intent) {
        case 'get_course_info':
          return await handleCourseInfo(analysis.entities);
          
        case 'get_learning_plan_info':
          return await handleLearningPlanInfo(analysis.entities);
          
        case 'search_sessions_in_course':
          return await handleSessionSearch(analysis.entities);
          
        case 'search_materials_in_course':
          return await handleMaterialSearch(analysis.entities);
          
        case 'search_users':
          return await handleUserSearch(analysis.entities);
          
        case 'search_courses':
          return await handleCourseSearch(analysis.entities);
          
        case 'search_learning_plans':
          return await handleLearningPlanSearch(analysis.entities);
          
        case 'docebo_help':
          return await handleDoceboHelp(analysis.entities);
          
        default:
          return NextResponse.json({
            response: `🤔 **I'm not sure what you're asking for**

Based on your message: "${message}"

**I can help you with:**
• **👥 Find Users**: "Find user email@company.com"
• **📚 Find/Info Courses**: "Find Python courses" or "Course info Working with Data in Python"  
• **📋 Find/Info Learning Plans**: "Find Python learning plans" or "Learning plan info Getting Started with Python"
• **🎯 Sessions**: "Search for sessions in course Python Programming"
• **📖 Materials**: "Search for materials in course Python Programming"
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
    const courseId = course.id || course.course_id;
    const status = course.status || course.course_status || 'Unknown';
    const description = course.description || 'No description available';
    
    return NextResponse.json({
      response: `📚 **Course Details**: ${courseName}

🆔 **Course ID**: ${courseId}
📊 **Status**: ${status}
📝 **Description**: ${description}

🔗 **Course Type**: ${course.course_type || 'Not specified'}
📅 **Created**: ${course.date_creation || 'Not available'}
👥 **Enrolled Users**: ${course.enrolled_count || 'Not available'}

**Course found successfully!**`,
      success: true,
      data: course,
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

async function handleSessionSearch(entities: any) {
  const courseIdentifier = entities.courseId || entities.courseName;
  const sessionFilter = entities.sessionFilter;
  
  if (!courseIdentifier) {
    return NextResponse.json({
      response: `❌ **Missing Course**: I need a course name or ID to search for sessions.

**Examples:**
• "Search for sessions in course id 944"
• "Search for sessions in course Python Programming"
• "Find Day 1 sessions in course Working with Data in Python"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const result = await api.searchSessionsInCourse(courseIdentifier, sessionFilter);
    
    if (result.totalSessions === 0) {
      return NextResponse.json({
        response: `🎯 **No Sessions Found**: Course "${api.getCourseName(result.course)}" has no sessions${sessionFilter ? ` matching "${sessionFilter}"` : ''}

**Course Details:**
• **Name**: ${api.getCourseName(result.course)}
• **ID**: ${result.course.id || result.course.course_id}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const sessionList = result.sessions.slice(0, 15).map((session: any, i: number) => {
      const sessionName = api.getSessionName(session);
      const sessionId = session.id || session.session_id || 'N/A';
      const instructor = session.instructor || 'Not assigned';
      const startDate = session.start_date || session.date_begin || 'Not scheduled';
      
      return `${i + 1}. **${sessionName}** (ID: ${sessionId})
   👨‍🏫 ${instructor} | 📅 ${startDate}`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `🎯 **Sessions in Course**: ${api.getCourseName(result.course)}

📚 **Course ID**: ${result.course.id || result.course.course_id}
${sessionFilter ? `🔍 **Filter**: "${sessionFilter}"\n` : ''}
📊 **Total Sessions**: ${result.totalSessions}

${sessionList}${result.totalSessions > 15 ? `\n\n... and ${result.totalSessions - 15} more sessions` : ''}`,
      success: true,
      totalCount: result.totalSessions,
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

async function handleMaterialSearch(entities: any) {
  const courseIdentifier = entities.courseId || entities.courseName;
  const materialFilter = entities.materialFilter;
  
  if (!courseIdentifier) {
    return NextResponse.json({
      response: `❌ **Missing Course**: I need a course name or ID to search for materials.

**Examples:**
• "Search for materials in course id 944"
• "Search for materials in course Python Programming"
• "Find Python materials in course Working with Data in Python"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const result = await api.searchMaterialsInCourse(courseIdentifier, materialFilter);
    
    if (result.totalMaterials === 0) {
      return NextResponse.json({
        response: `📖 **No Materials Found**: Course "${api.getCourseName(result.course)}" has no training materials${materialFilter ? ` matching "${materialFilter}"` : ''}

**Course Details:**
• **Name**: ${api.getCourseName(result.course)}
• **ID**: ${result.course.id || result.course.course_id}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const materialList = result.materials.slice(0, 15).map((material: any, i: number) => {
      const materialName = api.getMaterialName(material);
      const materialId = material.id || material.material_id || 'N/A';
      const type = material.type || material.material_type || 'Unknown';
      
      const typeIcon = type.toLowerCase() === 'video' ? '🎥' : 
                      type.toLowerCase() === 'pdf' ? '📄' : 
                      type.toLowerCase() === 'scorm' ? '📦' : '📖';
      
      return `${i + 1}. ${typeIcon} **${materialName}** (ID: ${materialId})
   📁 Type: ${type}`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `📖 **Materials in Course**: ${api.getCourseName(result.course)}

📚 **Course ID**: ${result.course.id || result.course.course_id}
${materialFilter ? `🔍 **Filter**: "${materialFilter}"\n` : ''}
📊 **Total Materials**: ${result.totalMaterials}

${materialList}${result.totalMaterials > 15 ? `\n\n... and ${result.totalMaterials - 15} more materials` : ''}`,
      success: true,
      totalCount: result.totalMaterials,
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
      // Specific user lookup by email
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
🔐 **Last Access**: ${userDetails.lastAccess}`,
        success: true,
        timestamp: new Date().toISOString()
      });
    } else {
      // General user search
      const users = await api.searchUsers(searchTerm, 20);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `👥 **No Users Found**: No users match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const userList = users.slice(0, 15).map((user, i) => {
        const statusIcon = user.status === '1' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users

${userList}${users.length > 15 ? `\n\n... and ${users.length - 15} more users` : ''}`,
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
    const courses = await api.searchCourses(searchTerm, 20);
    
    if (courses.length === 0) {
      return NextResponse.json({
        response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const courseList = courses.slice(0, 15).map((course, i) => {
      const courseName = api.getCourseName(course);
      const courseId = course.id || course.course_id || 'N/A';
      const status = course.status || course.course_status || 'Unknown';
      const statusIcon = status === 'published' ? '✅' : '📝';
      return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId})`;
    }).join('\n');
    
    return NextResponse.json({
      response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 15 ? `\n\n... and ${courses.length - 15} more courses` : ''}`,
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
    const learningPlans = await api.searchLearningPlans(searchTerm, 20);
    
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
    
    const planList = learningPlans.slice(0, 15).map((plan, i) => {
      const planName = api.getLearningPlanName(plan);
      const planId = plan.learning_plan_id || plan.id || 'N/A';
      const status = plan.is_published ? 'Published ✅' : 'Unpublished ❌';
      const enrollmentCount = plan.assigned_enrollments_count || 0;
      
      return `${i + 1}. **${planName}** (ID: ${planId})
   📊 ${status} | 👥 ${enrollmentCount} enrollments`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans

${planList}${learningPlans.length > 15 ? `\n\n... and ${learningPlans.length - 15} more learning plans` : ''}

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

export async function GET() {
  return NextResponse.json({
    status: 'Enhanced Docebo Chat API with NLP',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Enhanced natural language processing',
      'Intent-based command detection',
      'Course info retrieval',
      'Learning plan info retrieval',
      'Session search in courses',
      'Material search in courses',
      'User search and details',
      'Course search', 
      'Learning plan search',
      'Docebo help integration'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans',
      'sessions': '/course/v1/courses/{id}/sessions',
      'materials': '/course/v1/courses/{id}/lo'
    },
    nlp_capabilities: [
      'Course info: "Course info Working with Data in Python"',
      'Learning plan info: "Learning plan info Getting Started with Python"',
      'Session search: "Search for sessions in course Python Programming"',
      'Material search: "Search for materials in course Data Science"',
      'User search: "Find user mike@company.com"',
      'Course search: "Find Python courses"',
      'Learning plan search: "Find Python learning plans"',
      'Help requests: "How to enroll users in Docebo"'
    ]
  });
}Response.json({
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
    return Next
