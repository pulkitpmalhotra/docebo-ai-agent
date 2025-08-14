// app/api/chat/route.ts - Fixed and complete version
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
    console.log(`🔍 Searching learning plans with: "${searchText}"`);
    
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
}

// Pattern matching for different types of requests
const PATTERNS = {
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course') && !lower.includes('learning plan');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  },
  searchLearningPlans: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && (lower.includes('learning plan') || lower.includes('lp'))) ||
           (lower.includes('search') && (lower.includes('learning plan') || lower.includes('lp'))) ||
           lower.includes('learning plan');
  },
  doceboHelp: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('how to') || lower.includes('help') || lower.includes('configure') ||
           lower.includes('setup') || lower.includes('enable') || lower.includes('guide');
  }
};

// Helper functions to extract information from messages
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractCourse(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}

function extractLearningPlan(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const findLpPattern = /find\s+(.+?)\s+learning plan/i;
  const findLpMatch = message.match(findLpPattern);
  if (findLpMatch) return findLpMatch[1].trim();
  
  return null;
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
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    const learningPlan = extractLearningPlan(message);
    
    // Handle different types of requests
    try {
      // 1. USER SEARCH
      if (PATTERNS.searchUsers(message)) {
        const searchTerm = email || message.replace(/find|user|search/gi, '').trim();
        
        if (!searchTerm || searchTerm.length < 2) {
          return NextResponse.json({
            response: `❌ **Missing Search Term**: I need a name or email to search for.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        if (email) {
          const userDetails = await api.getUserDetails(email);
          return NextResponse.json({
            response: `👥 **User Found**: ${userDetails.fullname}

📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
👤 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
🏛️ **Department**: ${userDetails.department}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}`,
            success: true,
            timestamp: new Date().toISOString()
          });
        } else {
          const users = await api.searchUsers(searchTerm, 20);
          
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

${userList}${users.length > 10 ? `\n\n... and ${users.length - 10} more users` : ''}`,
            success: true,
            totalCount: users.length,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // 2. COURSE SEARCH
      if (PATTERNS.searchCourses(message)) {
        const searchTerm = course || message.replace(/find|search|course/gi, '').trim();
        
        if (!searchTerm || searchTerm.length < 2) {
          return NextResponse.json({
            response: `❌ **Missing Search Term**: I need a course name to search for.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        const courses = await api.searchCourses(searchTerm, 20);
        
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
          const statusIcon = status === 'published' ? '✅' : '📝';
          return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId})`;
        }).join('\n');
        
        return NextResponse.json({
          response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 10 ? `\n\n... and ${courses.length - 10} more courses` : ''}`,
          success: true,
          totalCount: courses.length,
          timestamp: new Date().toISOString()
        });
      }

      // 3. LEARNING PLAN SEARCH
      if (PATTERNS.searchLearningPlans(message)) {
        let searchTerm = learningPlan;
        
        if (!searchTerm) {
          searchTerm = message
            .toLowerCase()
            .replace(/find/g, '')
            .replace(/search/g, '')
            .replace(/learning plans?/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        if (!searchTerm || searchTerm.length < 2) {
          return NextResponse.json({
            response: `❌ **Missing Search Term**: I need a learning plan name to search for.

**Examples:**
• "Find Python learning plans"
• "Search Associate Memory Network learning plans"`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        const learningPlans = await api.searchLearningPlans(searchTerm, 20);
        
        if (learningPlans.length === 0) {
          return NextResponse.json({
            response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"

**API Endpoint Used**: \`/learningplan/v1/learningplans\``,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        const planList = learningPlans.slice(0, 10).map((plan, i) => {
          const planName = api.getLearningPlanName(plan);
          const planId = plan.learning_plan_id || plan.id || 'N/A';
          const status = plan.is_published ? 'Published ✅' : 'Unpublished ❌';
          return `${i + 1}. **${planName}** (ID: ${planId}) - ${status}`;
        }).join('\n');
        
        return NextResponse.json({
          response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans

${planList}${learningPlans.length > 10 ? `\n\n... and ${learningPlans.length - 10} more learning plans` : ''}

**API Endpoint Used**: \`/learningplan/v1/learningplans\``,
          success: true,
          totalCount: learningPlans.length,
          timestamp: new Date().toISOString()
        });
      }

      // 4. DOCEBO HELP
      if (PATTERNS.doceboHelp(message)) {
        return NextResponse.json({
          response: `🎯 **Docebo Help Request**: "${message}"

📖 **Manual Search Required**

For immediate assistance, please visit:
**Direct Link**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(message)}

**Popular Help Topics:**
• User management and enrollment
• Course creation and publishing  
• Reports and analytics
• Mobile app configuration
• API and integrations`,
          success: true,
          helpRequest: true,
          timestamp: new Date().toISOString()
        });
      }

      // 5. FALLBACK - Basic usage info
      return NextResponse.json({
        response: `🎯 **Docebo Assistant**

I can help you with:

## 👥 **Users**
• **Find users**: "Find user mike@company.com"

## 📚 **Courses**  
• **Find courses**: "Find Python courses"

## 📋 **Learning Plans**
• **Find learning plans**: "Find Python learning plans"

## 🌐 **Docebo Help**
• **Ask any question**: "How to enroll users in Docebo"

**Your message**: "${message}"`,
        success: false,
        timestamp: new Date().toISOString()
      });

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
    status: 'Docebo Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search and details',
      'Course search', 
      'Learning plan search',
      'Docebo help integration'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans'
    },
    usage_examples: [
      'Find user mike@company.com',
      'Find Python courses',
      'Find Python learning plans',
      'How to enroll users in Docebo'
    ]
  });
}
