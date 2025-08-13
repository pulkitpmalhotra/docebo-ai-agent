// app/api/chat/route.ts - Clean & Reliable - Working Features Only
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

// Simple patterns for working operations
const PATTERNS = {
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  },
  getUserInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('user info') || lower.includes('user details') || 
            lower.includes('tell me about user')) && !lower.includes('course');
  },
  getCourseInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('course info') || lower.includes('course details') || 
            lower.includes('tell me about course'));
  }
};

// Parsers
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

// Reliable Docebo API client
class ReliableDoceboAPI {
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
      throw new Error(`Docebo API error: ${response.status}`);
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
      id: user.user_id,
      fullname: user.fullname,
      email: user.email,
      username: user.username,
      status: user.status === '1' ? 'Active' : 'Inactive',
      level: user.level,
      branches: user.branches || [],
      groups: user.groups || [],
      creationDate: user.register_date,
      lastAccess: user.last_access_date,
      timezone: user.timezone,
      language: user.language
    };
  }

  async getCourseDetails(courseName: string): Promise<any> {
    const courses = await this.apiRequest('/course/v1/courses', {
      search_text: courseName,
      page_size: 10
    });
    
    const course = courses.data?.items?.find((c: any) => 
      c.course_name?.toLowerCase().includes(courseName.toLowerCase()) ||
      c.name?.toLowerCase().includes(courseName.toLowerCase())
    );
    
    if (!course) {
      throw new Error(`Course not found: ${courseName}`);
    }

    return {
      id: course.id || course.course_id || course.idCourse,
      name: course.title || course.course_name || course.name,
      description: course.description,
      type: course.course_type,
      status: course.status,
      language: course.lang_code,
      credits: course.credits,
      duration: course.mediumTime,
      category: course.category,
      creationDate: course.date_creation,
      modificationDate: course.date_modification
    };
  }

  getCourseId(course: any): number | null {
    return course.id || course.course_id || course.idCourse || null;
  }

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
  }
}

let api: ReliableDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    if (!api) {
      const config = getConfig();
      api = new ReliableDoceboAPI(config);
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
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}`);
    
    // 1. USER SEARCH (Enhanced with auto user details for email searches)
    if (PATTERNS.searchUsers(message)) {
      const searchTerm = email || message.replace(/find|user|search/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a name or email to search for.

**Example**: "Find user mike@company.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // If searching by email, provide detailed info automatically
      if (email) {
        try {
          console.log(`📧 Email search detected: ${email} - Getting detailed user info`);
          
          const users = await api.searchUsers(searchTerm, 10);
          const userDetails = await api.getUserDetails(email);
          
          return NextResponse.json({
            response: `👥 **User Found**: ${userDetails.fullname}

## 📋 **Complete User Information**

### 👤 **Basic Details**
📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
👤 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}

### 🌍 **Preferences**
🌍 **Language**: ${userDetails.language || 'Not specified'}
🕐 **Timezone**: ${userDetails.timezone || 'Not specified'}

### 📅 **Activity**
📅 **Created**: ${userDetails.creationDate || 'Not available'}
🔐 **Last Access**: ${userDetails.lastAccess || 'Not available'}

### 👥 **Organization**
🏛️ **Branches**: ${userDetails.branches?.length > 0 ? userDetails.branches.map((b: any) => b.name).join(', ') : 'None assigned'}
👥 **Groups**: ${userDetails.groups?.length > 0 ? userDetails.groups.map((g: any) => g.name).join(', ') : 'None assigned'}

💡 **Admin Complete**: All user information retrieved in one search!`,
            success: true,
            searchResults: users,
            userDetails: userDetails,
            autoDetailsFetched: true,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          // If detailed lookup fails, fall back to regular search
          console.log(`⚠️ Detailed lookup failed for ${email}, falling back to search results`);
          
          const users = await api.searchUsers(searchTerm, 50);
          
          if (users.length === 0) {
            return NextResponse.json({
              response: `👥 **No Users Found**: No users match "${searchTerm}"`,
              success: false,
              timestamp: new Date().toISOString()
            });
          }
          
          const displayCount = Math.min(users.length, 20);
          const userList = users.slice(0, displayCount).map((user, i) => {
            const statusIcon = user.status === '1' ? '✅' : '❌';
            return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
          }).join('\n');
          
          return NextResponse.json({
            response: `👥 **User Search Results**: Found ${users.length} users (Showing ${displayCount})

${userList}${users.length > 20 ? `\n\n... and ${users.length - 20} more users` : ''}

⚠️ **Note**: Could not retrieve detailed information for "${email}". ${error instanceof Error ? error.message : 'User may not exist.'}

💡 **Try**: "User info [exact_email]" for detailed information`,
            success: true,
            totalCount: users.length,
            detailsError: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Regular name-based search (no email detected)
        const users = await api.searchUsers(searchTerm, 50);
        
        if (users.length === 0) {
          return NextResponse.json({
            response: `👥 **No Users Found**: No users match "${searchTerm}"`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        const displayCount = Math.min(users.length, 20);
        const userList = users.slice(0, displayCount).map((user, i) => {
          const statusIcon = user.status === '1' ? '✅' : '❌';
          return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
        }).join('\n');
        
        return NextResponse.json({
          response: `👥 **User Search Results**: Found ${users.length} users (Showing ${displayCount})

${userList}${users.length > 20 ? `\n\n... and ${users.length - 20} more users` : ''}

💡 **Get Details**: "Find user [email]" or "User info [email]" for complete information`,
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
          response: `❌ **Missing Search Term**: I need a course name to search for.

**Example**: "Find Python courses"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courses = await api.searchCourses(searchTerm, 50);
      
      if (courses.length === 0) {
        return NextResponse.json({
          response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(courses.length, 20);
      const courseList = courses.slice(0, displayCount).map((course, i) => {
        const courseName = api.getCourseName(course);
        const courseId = api.getCourseId(course);
        return `${i + 1}. **${courseName}** (ID: ${courseId})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses (Showing ${displayCount})

${courseList}${courses.length > 20 ? `\n\n... and ${courses.length - 20} more courses` : ''}

💡 **Get Details**: "Course info ${api.getCourseName(courses[0])}" for more information`,
        success: true,
        totalCount: courses.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. USER DETAILS
    if (PATTERNS.getUserInfo(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to get user details.

**Example**: "User info john@company.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const userDetails = await api.getUserDetails(email);
        
        return NextResponse.json({
          response: `👤 **User Details**: ${userDetails.fullname}

📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
👤 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
🌍 **Language**: ${userDetails.language || 'Not specified'}
🕐 **Timezone**: ${userDetails.timezone || 'Not specified'}
📅 **Created**: ${userDetails.creationDate || 'Not available'}
🔐 **Last Access**: ${userDetails.lastAccess || 'Not available'}
🏛️ **Branches**: ${userDetails.branches?.length > 0 ? userDetails.branches.map((b: any) => b.name).join(', ') : 'None'}
👥 **Groups**: ${userDetails.groups?.length > 0 ? userDetails.groups.map((g: any) => g.name).join(', ') : 'None'}`,
          success: true,
          data: userDetails,
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
    
    // 4. COURSE DETAILS
    if (PATTERNS.getCourseInfo(message)) {
      const courseName = course || message.replace(/course info|course details|tell me about course/gi, '').trim();
      
      if (!courseName || courseName.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Course Name**: I need a course name to get details.

**Example**: "Course info Python Programming"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const courseDetails = await api.getCourseDetails(courseName);
        
        return NextResponse.json({
          response: `📚 **Course Details**: ${courseDetails.name}

🆔 **Course ID**: ${courseDetails.id}
📖 **Type**: ${courseDetails.type || 'Not specified'}
📊 **Status**: ${courseDetails.status || 'Not specified'}
🌍 **Language**: ${courseDetails.language || 'Not specified'}
🏆 **Credits**: ${courseDetails.credits || 'Not specified'}
⏱️ **Duration**: ${courseDetails.duration ? `${courseDetails.duration} minutes` : 'Not specified'}
📂 **Category**: ${courseDetails.category || 'Not specified'}
📅 **Created**: ${courseDetails.creationDate || 'Not available'}
📝 **Modified**: ${courseDetails.modificationDate || 'Not available'}

📋 **Description**: 
${courseDetails.description || 'No description available'}`,
          success: true,
          data: courseDetails,
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
    
    // DEFAULT - Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Reliable & Fast*

I can help you with these **working features**:

• **👥 Find users**: "Find user mike@company.com"
  - **Email searches**: Get complete user details automatically
  - **Name searches**: Shows list of matching users
  - Smart detection: Email = full details, Name = search results

• **📖 Find courses**: "Find Python courses"
  - Search by course name or keyword
  - Shows up to 20 results

• **👤 User details**: "User info sarah@test.com"
  - Complete user profile information
  - Status, groups, branches, etc.

• **📚 Course details**: "Course info Python Programming"
  - Complete course information
  - Type, credits, duration, description

**Your message**: "${message}"

**Examples:**
- "Find user pulkitpmalhotra@gmail.com" *(Auto-details for emails)*
- "Find user mike" *(Search results for names)*
- "Find Python courses"
- "Course info Python Programming"

💡 **Admin Efficiency**: Email searches provide complete user info automatically!`,
      success: false,
      timestamp: new Date().toISOString()
    });

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
    status: 'Reliable Docebo Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search (up to 50 results, show 20)',
      'Course search (up to 50 results, show 20)', 
      'User details lookup',
      'Course details lookup',
      'Fast & reliable (10-15 seconds)',
      'No enrollment complications'
    ],
    workingOperations: [
      'Find user [name/email]',
      'Find [keyword] courses',
      'User info [email]',
      'Course info [name]'
    ]
  });
}
