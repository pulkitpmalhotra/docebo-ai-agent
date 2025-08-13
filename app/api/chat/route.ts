// app/api/chat/route.ts - Clean & Complete Version
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

const PATTERNS = {
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course') && !lower.includes('learning plan') && 
           !lower.includes('session') && !lower.includes('training material');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  },
  searchLearningPlans: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && (lower.includes('learning plan') || lower.includes('lp'))) ||
           (lower.includes('search') && (lower.includes('learning plan') || lower.includes('lp')));
  },
  searchSessions: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('session')) ||
           (lower.includes('search') && lower.includes('session'));
  },
  searchTrainingMaterials: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && (lower.includes('training material') || lower.includes('material'))) ||
           (lower.includes('search') && (lower.includes('training material') || lower.includes('material')));
  },
  doceboHelp: (msg: string) => {
    const lower = msg.toLowerCase();
    return (
      lower.includes('how to') || lower.includes('how do i') || lower.includes('how does') ||
      lower.includes('configure') || lower.includes('setup') || lower.includes('enable') ||
      lower.includes('help') || lower.includes('guide') || lower.includes('tutorial') ||
      lower.includes('documentation') || lower.includes('manual') ||
      lower.includes('process') || lower.includes('workflow') || lower.includes('steps') ||
      lower.includes('troubleshoot') || lower.includes('problem') || lower.includes('issue') ||
      lower.includes('error') || lower.includes('not working') ||
      lower.includes('best practice') || lower.includes('recommendation') ||
      lower.includes('admin') || lower.includes('administration') || lower.includes('manage') ||
      lower.includes('branch') || lower.includes('catalog') || lower.includes('certification') ||
      lower.includes('notification') || lower.includes('report') || lower.includes('analytics') ||
      lower.includes('enrollment') || lower.includes('completion') || lower.includes('assessment')
    ) && !lower.includes('find user') && !lower.includes('search user') && 
         !lower.includes('user info') && !lower.includes('course info');
  },
  getUserInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('user info') || lower.includes('user details') || 
            lower.includes('tell me about user')) && !lower.includes('course') &&
            !lower.includes('learning plan') && !lower.includes('session') && 
            !lower.includes('training material');
  },
  getCourseInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('course info') || lower.includes('course details') || 
            lower.includes('tell me about course'));
  },
  userQuestion: (msg: string) => {
    const lower = msg.toLowerCase();
    const hasEmail = msg.includes('@');
    
    return hasEmail && (
      lower.includes('what is') || lower.includes('when did') || 
      lower.includes('how many') || lower.includes('does') ||
      lower.includes('can ') || lower.includes('is ') ||
      lower.includes('what groups') || lower.includes('what branches') ||
      lower.includes('what level') || lower.includes('what status') ||
      lower.includes('last login') || lower.includes('last access') ||
      lower.includes('when ') || lower.includes('status') ||
      lower.includes('level') || lower.includes('groups') ||
      lower.includes('branches') || lower.includes('department')
    );
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
  
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  const courseInfoMatch = message.match(/course info\s+(.+)/i);
  if (courseInfoMatch) return courseInfoMatch[1].trim();
  
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}

function extractLearningPlan(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  const lpInfoMatch = message.match(/(?:learning plan info|lp info)\s+(.+)/i);
  if (lpInfoMatch) return lpInfoMatch[1].trim();
  
  const lpMatch = message.match(/find\s+(.+?)\s+(?:learning plan|lp)/i);
  if (lpMatch) return lpMatch[1].trim();
  
  return null;
}

function extractSession(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  const sessionInfoMatch = message.match(/session info\s+(.+)/i);
  if (sessionInfoMatch) return sessionInfoMatch[1].trim();
  
  const sessionMatch = message.match(/find\s+(.+?)\s+session/i);
  if (sessionMatch) return sessionMatch[1].trim();
  
  return null;
}

function extractTrainingMaterial(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  const materialInfoMatch = message.match(/(?:material info|training material info)\s+(.+)/i);
  if (materialInfoMatch) return materialInfoMatch[1].trim();
  
  const materialMatch = message.match(/find\s+(.+?)\s+(?:material|training material)/i);
  if (materialMatch) return materialMatch[1].trim();
  
  return null;
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

  async searchLearningPlans(searchText: string, limit: number = 20): Promise<any[]> {
    console.log(`🔍 Searching learning plans for: "${searchText}"`);
    
    // Try multiple endpoints for learning plans
    const endpoints = [
      '/learn/v1/learningplans',
      '/course/v1/learningplans', 
      '/manage/v1/learningplans',
      '/learn/v1/learning-plans'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying learning plan endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
        console.log(`📚 Learning plan response from ${endpoint}:`, JSON.stringify(result, null, 2));
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} learning plans from ${endpoint}`);
          return result.data.items;
        }
        
        // Also try without search filter to see if endpoint has any data
        if (searchText.length > 0) {
          const allResult = await this.apiRequest(endpoint, {
            page_size: 5  // Just get a few to test
          });
          console.log(`📊 Total learning plans available at ${endpoint}:`, allResult.data?.items?.length || 0);
        }
        
      } catch (error) {
        console.log(`⚠️ Learning plan endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ No learning plans found for "${searchText}" across all endpoints`);
    return [];
  }

  async searchSessions(searchText: string, limit: number = 20): Promise<any[]> {
    console.log(`🔍 Searching sessions for: "${searchText}"`);
    
    // Try multiple endpoints for sessions
    const endpoints = [
      '/course/v1/sessions',
      '/learn/v1/sessions',
      '/manage/v1/sessions',
      '/course/v1/session',
      '/learn/v1/session'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying session endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
        console.log(`🎯 Session response from ${endpoint}:`, JSON.stringify(result, null, 2));
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} sessions from ${endpoint}`);
          return result.data.items;
        }
        
        // Also try without search filter to see if endpoint has any data
        if (searchText.length > 0) {
          const allResult = await this.apiRequest(endpoint, {
            page_size: 5  // Just get a few to test
          });
          console.log(`📊 Total sessions available at ${endpoint}:`, allResult.data?.items?.length || 0);
        }
        
      } catch (error) {
        console.log(`⚠️ Session endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ No sessions found for "${searchText}" across all endpoints`);
    return [];
  }

  async searchTrainingMaterials(searchText: string, limit: number = 20): Promise<any[]> {
    console.log(`🔍 Searching training materials for: "${searchText}"`);
    
    // Try multiple endpoints for training materials
    const endpoints = [
      '/learn/v1/materials',
      '/course/v1/materials',
      '/manage/v1/materials',
      '/learn/v1/lo',  // Learning Objects
      '/course/v1/lo',
      '/learn/v1/learning-objects'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying material endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
        console.log(`📄 Material response from ${endpoint}:`, JSON.stringify(result, null, 2));
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} materials from ${endpoint}`);
          return result.data.items;
        }
        
        // Also try without search filter to see if endpoint has any data
        if (searchText.length > 0) {
          const allResult = await this.apiRequest(endpoint, {
            page_size: 5  // Just get a few to test
          });
          console.log(`📊 Total materials available at ${endpoint}:`, allResult.data?.items?.length || 0);
        }
        
      } catch (error) {
        console.log(`⚠️ Material endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ No training materials found for "${searchText}" across all endpoints`);
    return [];
  }

  async getDoceboHelpResponse(query: string): Promise<string> {
    const commonAnswers: Record<string, string> = {
      'enroll': `**How to Enroll Users in Docebo:**

🎯 **Quick Steps:**
1. Go to **Admin Menu > User Management > Users**
2. Find and select the user(s) you want to enroll
3. Click **"Actions" > "Enroll Users"**
4. Select the course(s) from the catalog
5. Set enrollment options (deadline, notifications)
6. Click **"Enroll"**

📋 **Alternative Methods:**
• **Bulk Enrollment**: Upload CSV with user emails and course codes
• **Group Enrollment**: Assign courses to entire groups at once
• **Enrollment Rules**: Set automatic enrollment based on user attributes
• **Self-Enrollment**: Enable catalog access for users to enroll themselves

🔧 **Pro Tips:**
• Use enrollment rules for new hires
• Set up notification templates for enrollment confirmations
• Track enrollment progress in Reports > Training Material Report

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779678`,

      'api': `**How to Set Up API and SSO in Docebo:**

🔑 **API Setup Steps:**
1. Go to **Admin Menu > System Settings > API & SSO**
2. Click **"Add API App"**
3. Enter app name and select permissions
4. Generate **Client ID** and **Client Secret**
5. Set redirect URIs for OAuth flow
6. Test connection with a simple API call

🔐 **SSO Configuration:**
1. Navigate to **Admin Menu > System Settings > SSO**
2. Choose your SSO protocol (SAML 2.0, LDAP, etc.)
3. Upload identity provider metadata
4. Configure attribute mapping (email, username, etc.)
5. Set up user provisioning rules
6. Test SSO login flow

⚙️ **Common Settings:**
• **API Permissions**: Read users, manage enrollments, access reports
• **Token Expiry**: Default 3600 seconds (1 hour)
• **Rate Limits**: 1000 requests per hour per app
• **User Mapping**: Map SSO attributes to Docebo user fields

📖 **API Documentation**: https://help.docebo.com/hc/en-us/articles/360016779658
📖 **SSO Guide**: https://help.docebo.com/hc/en-us/articles/360016779668`,

      'notification': `**How to Configure Notifications in Docebo:**

📧 **Email Notification Setup:**
1. Go to **Admin Menu > E-mail Settings > Notifications**
2. Click **"Add New Notification"** or edit existing ones
3. Choose trigger event (enrollment, completion, deadline, etc.)
4. Select recipient(s) (users, managers, admins)
5. Customize email template with placeholders
6. Set delivery timing and frequency

🔔 **Key Notification Types:**
• **Enrollment Confirmation**: Sent when user is enrolled
• **Course Completion**: Triggered when course is completed
• **Deadline Reminder**: Sent X days before due date
• **Certificate Available**: When certification is earned
• **Session Reminder**: For ILT sessions and webinars

⚙️ **Advanced Settings:**
• **Digest Notifications**: Bundle multiple notifications
• **Conditional Logic**: Send only if certain criteria met
• **Custom Fields**: Include user-specific information
• **Multi-language**: Set up templates for different languages

🎯 **Best Practices:**
• Test notifications with a small group first
• Use clear, actionable subject lines
• Include direct links to courses/content
• Set appropriate reminder timing (3-5 days before deadline)

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779688`,

      'learning plan': `**How to Set Up Learning Plans in Docebo:**

📚 **Creating Learning Plans:**
1. Go to **Admin Menu > Learning Plans & Certifications > Learning Plans**
2. Click **"Add Learning Plan"**
3. Enter plan name, description, and category
4. Add courses in the desired sequence
5. Set completion requirements and prerequisites
6. Configure enrollment options
7. Publish the learning plan

🔄 **Plan Structure Options:**
• **Sequential**: Courses must be completed in order
• **Flexible**: Courses can be completed in any order
• **Mixed**: Some sequential, some flexible sections
• **Prerequisites**: Set course dependencies

📋 **Assignment Methods:**
• **Manual Assignment**: Select specific users
• **Group Assignment**: Assign to entire user groups
• **Enrollment Rules**: Automatic assignment based on criteria
• **Self-Enrollment**: Users can enroll themselves

⏱️ **Completion Settings:**
• **All Courses**: User must complete every course
• **Minimum Courses**: Set minimum number to complete
• **Credit Hours**: Require specific credit total
• **Time Limits**: Set overall completion deadline

🏆 **Certification Options:**
• **Learning Plan Certificate**: Awarded upon completion
• **Expiry Settings**: Set certificate validity period
• **Renewal Requirements**: Define re-certification rules

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779698`,

      'branch': `**How to Configure User Branches in Docebo:**

🏢 **Branch Setup:**
1. Go to **Admin Menu > User Management > Branches**
2. Click **"Add Branch"**
3. Enter branch name and description
4. Set parent branch (if creating hierarchy)
5. Configure branch settings and permissions
6. Assign branch managers
7. Save and activate branch

👥 **User Assignment:**
• **Manual Assignment**: Edit user profile and select branch
• **Bulk Assignment**: Use CSV import to assign multiple users
• **Automatic Rules**: Set up rules based on user attributes
• **Self-Assignment**: Allow users to select their branch

🔐 **Branch Permissions:**
• **Branch Manager**: Can manage users in their branch only
• **Content Visibility**: Control what courses/materials branch sees
• **Reporting Access**: Limit reports to branch data only
• **Enrollment Rights**: Set who can enroll branch users

📊 **Branch Reporting:**
• **Branch Performance**: View training metrics by branch
• **User Progress**: Track completion rates per branch
• **Comparative Analytics**: Compare branch performance
• **Custom Reports**: Filter all reports by branch

🎯 **Best Practices:**
• Mirror your organizational structure
• Set clear branch naming conventions
• Use branch-specific catalogs for targeted content
• Regular review and cleanup of branch assignments

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779708`,

      'course creation': `**How to Create Courses in Docebo:**

📚 **Course Creation Steps:**
1. Go to **Admin Menu > Course Management > Courses**
2. Click **"Add Course"**
3. Choose course type (E-learning, ILT, Blended)
4. Enter course details (name, description, category)
5. Upload content (SCORM, videos, documents)
6. Set completion criteria and tracking
7. Configure enrollment and catalog settings
8. Publish the course

📁 **Content Types:**
• **SCORM Packages**: Interactive e-learning content
• **Videos**: MP4, streaming, YouTube links
• **Documents**: PDFs, presentations, manuals
• **Web Pages**: HTML content and external links
• **Assessments**: Quizzes and surveys

⚙️ **Course Settings:**
• **Completion Criteria**: Time-based, content completion, test scores
• **Attempts**: Limit number of retries
• **Time Limits**: Set maximum time for completion
• **Prerequisites**: Require other courses first
• **Certificates**: Award upon completion

🎯 **Publishing Options:**
• **Catalog Visibility**: Control who can see and enroll
• **Pricing**: Set up paid courses if enabled
• **Sessions**: Schedule instructor-led sessions
• **Enrollment Limits**: Cap the number of learners

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779718`
    };

    const queryLower = query.toLowerCase();
    for (const [topic, answer] of Object.entries(commonAnswers)) {
      if (queryLower.includes(topic)) {
        return answer;
      }
    }

    return `**Docebo Help for "${query}"**

I can provide detailed guidance on these topics:

🎯 **Popular How-To Guides:**
• **"How to enroll users"** - Step-by-step enrollment process
• **"How to set up API"** - Complete API and SSO configuration
• **"How to configure notifications"** - Email alerts and messaging
• **"How to set up learning plans"** - Creating learning paths
• **"How to configure branches"** - User organization setup
• **"How to create courses"** - Content creation and publishing

💡 **Try asking specific questions like:**
• "How to create SCORM courses"
• "How to set up automatic enrollment rules"
• "How to configure deadline reminders"
• "How to set up branch managers"

📖 **Official Documentation**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`;
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

    // Try to get additional user details
    let additionalDetails = null;
    try {
      additionalDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}`);
    } catch (error) {
      console.log(`User details endpoint failed:`, error);
    }

    const mergedUser = additionalDetails?.data || user;

    // Extract manager info
    const extractManager = (): string => {
      const managers = user.managers || mergedUser.managers || [];
      if (managers.length > 0) {
        const directManager = managers.find((m: any) => m.manager_type_id === 1) || managers[0];
        if (directManager && directManager.manager_name) {
          return directManager.manager_name;
        }
      }
      
      const managerNames = user.manager_names || mergedUser.manager_names || {};
      if (managerNames['1'] && managerNames['1'].manager_name) {
        return managerNames['1'].manager_name;
      }
      
      return 'Not assigned';
    };

    // Extract branch/organization info
    const extractBranches = (): string => {
      const additionalFields = mergedUser.additional_fields || [];
      const orgFields = [];
      
      for (const field of additionalFields) {
        if (field.title === 'Organization Name' && field.value) {
          orgFields.push(`Organization: ${field.value}`);
        }
        if (field.title === 'Team' && field.value) {
          orgFields.push(`Team: ${field.value}`);
        }
        if (field.title === 'Job Role' && field.value) {
          orgFields.push(`Role: ${field.value}`);
        }
      }
      
      if (orgFields.length > 0) {
        return orgFields.join(' | ');
      }
      
      const fallbackFields = [user.field_4, user.field_5, user.field_1].filter(Boolean);
      if (fallbackFields.length > 0) {
        return fallbackFields.join(' | ');
      }
      
      return 'None assigned';
    };

    return {
      id: user.user_id || user.id,
      fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Not available',
      email: user.email,
      username: user.username || 'Not available',
      status: user.status === '1' ? 'Active' : user.status === '0' ? 'Inactive' : `Status: ${user.status}`,
      level: user.level === 'godadmin' ? 'Superadmin' : user.level || 'User',
      branches: extractBranches(),
      manager: extractManager(),
      creationDate: user.register_date || user.creation_date || user.created_at || 'Not available',
      lastAccess: user.last_access_date || user.last_access || user.last_login || 'Not available',
      timezone: user.timezone || 'Not specified',
      language: user.language || user.lang_code || 'Not specified',
      department: user.department || 'Not specified'
    };
  }

  async getCourseDetails(courseName: string): Promise<any> {
    const courses = await this.apiRequest('/course/v1/courses', {
      search_text: courseName,
      page_size: 20
    });
    
    let course = courses.data?.items?.find((c: any) => {
      const cName = (c.course_name || c.name || c.title || '').toLowerCase();
      return cName === courseName.toLowerCase();
    });
    
    if (!course) {
      course = courses.data?.items?.find((c: any) => {
        const cName = (c.course_name || c.name || c.title || '').toLowerCase();
        return cName.includes(courseName.toLowerCase()) || courseName.toLowerCase().includes(cName);
      });
    }
    
    if (!course) {
      throw new Error(`Course not found: ${courseName}`);
    }

    const extractField = (fieldName: string, possibleKeys: string[] = []): string => {
      const allKeys = [fieldName, ...possibleKeys];
      for (const key of allKeys) {
        const value = course[key];
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'object' && value.fullname) return String(value.fullname);
          if (typeof value === 'object' && value.name) return String(value.name);
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        }
      }
      return 'Not available';
    };

    return {
      id: course.id || course.course_id || 'Not available',
      name: course.title || course.course_name || course.name || 'Unknown Course',
      description: extractField('description'),
      type: extractField('type', ['course_type', 'content_type']),
      status: extractField('status', ['course_status', 'publication_status']),
      language: extractField('language', ['lang_code', 'default_language']),
      credits: extractField('credits', ['credit_hours', 'points']),
      duration: extractField('duration', ['estimated_duration', 'average_completion_time']),
      category: extractField('category', ['category_name', 'course_category']),
      creationDate: extractField('created', ['date_creation', 'created_at']),
      modificationDate: extractField('modified', ['last_update', 'updated_on']),
      createdBy: extractField('created_by', ['creator', 'author', 'created_by_name']),
      lastUpdatedBy: extractField('updated_by', ['modified_by', 'last_updated_by']),
      enrollments: extractField('enrollments', ['enrolled_count', 'enrolled_users']),
      rating: extractField('rating', ['average_rating', 'score'])
    };
  }

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
  }

  getLearningPlanName(lp: any): string {
    return lp.title || lp.name || lp.learning_plan_name || 'Unknown Learning Plan';
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
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    const learningPlan = extractLearningPlan(message);
    const session = extractSession(message);
    const trainingMaterial = extractTrainingMaterial(message);
    
    // 1. DOCEBO HELP
    if (PATTERNS.doceboHelp(message)) {
      try {
        const helpResponse = await api.getDoceboHelpResponse(message);
        return NextResponse.json({
          response: helpResponse,
          success: true,
          helpRequest: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return NextResponse.json({
          response: `📖 **Docebo Help Available**

I can help you with Docebo functionality questions! 

**Try asking:**
• "How to enroll users in Docebo"
• "How to create courses" 
• "How to set up learning plans"
• "How to configure notifications"
• "How to manage user branches"

📖 **Official Documentation**: https://help.docebo.com/hc/en-us`,
          success: true,
          helpRequest: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // 2. USER QUESTIONS
    if (PATTERNS.userQuestion(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to answer questions about a user.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const userDetails = await api.getUserDetails(email);
        const question = message.toLowerCase();
        
        let answer = '';
        if (question.includes('last login') || question.includes('last access')) {
          answer = `🔐 **Last Access**: ${userDetails.lastAccess}`;
        } else if (question.includes('status')) {
          answer = `📊 **Status**: ${userDetails.status}`;
        } else if (question.includes('level')) {
          answer = `🏢 **Level**: ${userDetails.level}`;
        } else if (question.includes('manager')) {
          answer = `👔 **Manager**: ${userDetails.manager}`;
        } else {
          answer = `👤 **${userDetails.fullname}** - Quick Info:
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}`;
        }
        
        return NextResponse.json({
          response: `💬 **Question About**: ${userDetails.fullname}

${answer}`,
          success: true,
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
    
    // 3. USER SEARCH
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
        try {
          const userDetails = await api.getUserDetails(email);
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
🏛️ **Branches**: ${userDetails.branches}
👔 **Manager**: ${userDetails.manager}`,
            success: true,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return NextResponse.json({
            response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      } else {
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

${userList}${users.length > 20 ? `\n\n... and ${users.length - 20} more users` : ''}`,
          success: true,
          totalCount: users.length,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 4. COURSE SEARCH
    if (PATTERNS.searchCourses(message)) {
      const searchTerm = course || message.replace(/find|search|course/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a course name to search for.`,
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
        const courseId = course.id || course.course_id || 'N/A';
        const status = course.status || course.course_status || 'Unknown';
        const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : '❓';
        return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses (Showing ${displayCount})

${courseList}${courses.length > 20 ? `\n\n... and ${courses.length - 20} more courses` : ''}`,
        success: true,
        totalCount: courses.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 5. LEARNING PLAN SEARCH
    if (PATTERNS.searchLearningPlans(message)) {
      const searchTerm = learningPlan || message.replace(/find|search|learning plan|lp/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a learning plan name to search for.

**Examples**: 
• "Find Python learning plans"
• "Find Navigate learning plans"
• "Find Google Solutions learning plans"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const learningPlans = await api.searchLearningPlans(searchTerm, 50);
      
      if (learningPlans.length === 0) {
        return NextResponse.json({
          response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"

**Possible reasons:**
• Learning plan name might be slightly different
• Learning plans might not be published or visible
• Your Docebo instance might not have learning plans enabled
• Try searching with partial names or keywords

**Suggestions:**
• Try "Find learning" to see all learning plans
• Try searching for course names instead: "Find [course name] courses"
• Contact your Docebo admin to verify learning plan availability

💡 **Alternative**: Try "Find ${searchTerm} courses" to search for individual courses`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(learningPlans.length, 20);
      const lpList = learningPlans.slice(0, displayCount).map((lp, i) => {
        const lpName = api.getLearningPlanName(lp);
        const lpId = lp.id || lp.learning_plan_id || 'N/A';
        const status = lp.status || 'Unknown';
        const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : '❓';
        return `${i + 1}. ${statusIcon} **${lpName}** (ID: ${lpId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans (Showing ${displayCount})

${lpList}${learningPlans.length > 20 ? `\n\n... and ${learningPlans.length - 20} more learning plans` : ''}`,
        success: true,
        totalCount: learningPlans.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 6. SESSION SEARCH
    if (PATTERNS.searchSessions(message)) {
      const searchTerm = session || message.replace(/find|search|session/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a session name to search for.

**Examples**: 
• "Find Python sessions"
• "Find training sessions"
• "Find workshop sessions"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const sessions = await api.searchSessions(searchTerm, 50);
      
      if (sessions.length === 0) {
        return NextResponse.json({
          response: `🎯 **No Sessions Found**: No sessions match "${searchTerm}"

**Possible reasons:**
• Session name might be different than expected
• Sessions might be past events that are archived
• Your Docebo instance might not use Instructor-Led Training (ILT)
• Sessions might be part of courses instead of standalone

**Suggestions:**
• Try "Find training" or "Find workshop" for broader search
• Try searching for course names: "Find ${searchTerm} courses"
• Contact your Docebo admin about available training sessions

💡 **Alternative**: Try "Find ${searchTerm} courses" to search for related courses`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(sessions.length, 20);
      const sessionList = sessions.slice(0, displayCount).map((sess, i) => {
        const sessName = api.getSessionName(sess);
        const sessId = sess.id || sess.session_id || 'N/A';
        const status = sess.status || 'Unknown';
        const statusIcon = status === 'active' ? '✅' : status === 'cancelled' ? '❌' : '❓';
        return `${i + 1}. ${statusIcon} **${sessName}** (ID: ${sessId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `🎯 **Session Search Results**: Found ${sessions.length} sessions (Showing ${displayCount})

${sessionList}${sessions.length > 20 ? `\n\n... and ${sessions.length - 20} more sessions` : ''}`,
        success: true,
        totalCount: sessions.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 7. TRAINING MATERIAL SEARCH
    if (PATTERNS.searchTrainingMaterials(message)) {
      const searchTerm = trainingMaterial || message.replace(/find|search|training material|material/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a material name to search for.

**Examples**: 
• "Find Python training materials"
• "Find video materials"
• "Find PDF materials"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const materials = await api.searchTrainingMaterials(searchTerm, 50);
      
      if (materials.length === 0) {
        return NextResponse.json({
          response: `📄 **No Training Materials Found**: No materials match "${searchTerm}"

**Possible reasons:**
• Materials might be embedded within courses
• Search term might need to be more specific
• Materials might be in a different format than expected
• Your Docebo instance might organize content differently

**Suggestions:**
• Try "Find ${searchTerm} courses" to find courses containing materials
• Try broader terms like "Find training" or "Find resources"
• Contact your Docebo admin about available training materials

💡 **Alternative**: Try "Find ${searchTerm} courses" to search for courses with related content`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(materials.length, 20);
      const materialList = materials.slice(0, displayCount).map((mat, i) => {
        const matName = api.getMaterialName(mat);
        const matId = mat.id || mat.material_id || 'N/A';
        const type = mat.type || mat.material_type || 'Unknown';
        const typeIcon = type === 'video' ? '🎥' : type === 'document' ? '📄' : '📁';
        return `${i + 1}. ${typeIcon} **${matName}** (ID: ${matId}) - *${type}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📄 **Training Material Search Results**: Found ${materials.length} materials (Showing ${displayCount})

${materialList}${materials.length > 20 ? `\n\n... and ${materials.length - 20} more materials` : ''}`,
        success: true,
        totalCount: materials.length,
        timestamp: new Date().toISOString()
      });
    }
      }
      
      const sessions = await api.searchSessions(searchTerm, 50);
      
      if (sessions.length === 0) {
        return NextResponse.json({
          response: `🎯 **No Sessions Found**: No sessions match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(sessions.length, 20);
      const sessionList = sessions.slice(0, displayCount).map((sess, i) => {
        const sessName = api.getSessionName(sess);
        const sessId = sess.id || sess.session_id || 'N/A';
        const status = sess.status || 'Unknown';
        const statusIcon = status === 'active' ? '✅' : status === 'cancelled' ? '❌' : '❓';
        return `${i + 1}. ${statusIcon} **${sessName}** (ID: ${sessId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `🎯 **Session Search Results**: Found ${sessions.length} sessions (Showing ${displayCount})

${sessionList}${sessions.length > 20 ? `\n\n... and ${sessions.length - 20} more sessions` : ''}`,
        success: true,
        totalCount: sessions.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 7. TRAINING MATERIAL SEARCH
    if (PATTERNS.searchTrainingMaterials(message)) {
      const searchTerm = trainingMaterial || message.replace(/find|search|training material|material/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a material name to search for.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const materials = await api.searchTrainingMaterials(searchTerm, 50);
      
      if (materials.length === 0) {
        return NextResponse.json({
          response: `📄 **No Training Materials Found**: No materials match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(materials.length, 20);
      const materialList = materials.slice(0, displayCount).map((mat, i) => {
        const matName = api.getMaterialName(mat);
        const matId = mat.id || mat.material_id || 'N/A';
        const type = mat.type || mat.material_type || 'Unknown';
        const typeIcon = type === 'video' ? '🎥' : type === 'document' ? '📄' : '📁';
        return `${i + 1}. ${typeIcon} **${matName}** (ID: ${matId}) - *${type}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📄 **Training Material Search Results**: Found ${materials.length} materials (Showing ${displayCount})

${materialList}${materials.length > 20 ? `\n\n... and ${materials.length - 20} more materials` : ''}`,
        success: true,
        totalCount: materials.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 8. USER INFO
    if (PATTERNS.getUserInfo(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to get user details.`,
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
🏛️ **Department**: ${userDetails.department}
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}
🏛️ **Branches**: ${userDetails.branches}
👔 **Manager**: ${userDetails.manager}`,
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
    
    // 9. COURSE INFO
    if (PATTERNS.getCourseInfo(message)) {
      const courseName = course || message.replace(/course info|course details|tell me about course/gi, '').trim();
      
      if (!courseName || courseName.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Course Name**: I need a course name to get details.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const courseDetails = await api.getCourseDetails(courseName);
        
        return NextResponse.json({
          response: `📚 **Course Details**: ${courseDetails.name}

🆔 **Course ID**: ${courseDetails.id}
📖 **Type**: ${courseDetails.type}
📊 **Status**: ${courseDetails.status}
🌍 **Language**: ${courseDetails.language}
🏆 **Credits**: ${courseDetails.credits}
⏱️ **Duration**: ${courseDetails.duration}
📂 **Category**: ${courseDetails.category}
👥 **Enrolled**: ${courseDetails.enrollments}
⭐ **Rating**: ${courseDetails.rating}
📅 **Created**: ${courseDetails.creationDate}
👤 **Created By**: ${courseDetails.createdBy}
📝 **Last Updated**: ${courseDetails.modificationDate}
👤 **Last Updated By**: ${courseDetails.lastUpdatedBy}

📋 **Description**: 
${courseDetails.description}`,
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
    
    // FALLBACK: Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Comprehensive Learning Management*

I can help you with these **working features**:

## 👥 **Users**
• **Find users**: "Find user mike@company.com"
• **User details**: "User info sarah@test.com"

## 📚 **Courses**
• **Find courses**: "Find Python courses"
• **Course details**: "Course info Python Programming"

## 📚 **Learning Plans**
• **Find learning plans**: "Find Python learning plans"

## 🎯 **Sessions**
• **Find sessions**: "Find Python sessions"

## 📄 **Training Materials**
• **Find materials**: "Find Python training materials"

## 📖 **Docebo Help & Guidance**
• **How-to questions**: "How to enroll users in Docebo"
• **Feature explanations**: "What is a learning plan in Docebo"
• **Configuration help**: "How to set up notifications"

**Your message**: "${message}"

**Examples:**
- "Find user pulkitmalhotra@gmail.com"
- "Course info Release Course Testing"
- "How to create courses in Docebo"
- "Find Python learning plans"

💡 **Smart Help**: Ask about any Docebo feature and get official guidance!`,
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
    status: 'Comprehensive Docebo Chat API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search and details',
      'Course search and details', 
      'Learning plan search',
      'Session search',
      'Training material search',
      'Docebo help and guidance',
      'Natural language processing'
    ]
  });
}
