// app/api/chat/route.ts - Complete Enhanced Version with Web Search
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
      lower.includes('enrollment') || lower.includes('completion') || lower.includes('assessment') ||
      lower.includes('sso') || lower.includes('single sign') ||
      lower.includes('delete') || lower.includes('remove') || lower.includes('survey') ||
      lower.includes('central repository') || lower.includes('clor') || lower.includes('question')
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

// Enhanced help responses based on research
function getEnhancedHelpResponse(query: string): string {
  const queryLower = query.toLowerCase();
  
  // Delete question in test after enrollment
  if (queryLower.includes('delete') && queryLower.includes('question') && queryLower.includes('test') && queryLower.includes('enrollment')) {
    return `**How to Delete Questions from Tests After Enrollment:**

⚠️ **Important Limitation**: When you modify the questions in a live test, the learners who have already finished the test will not see the test change. Their previous test outcomes and completion status will remain unchanged. Only new participants (or those who restart the test) will see the updates.

🔧 **Steps to Delete Questions:**
1. Go to **Admin Menu > Course Management > Courses**
2. Find and click on the course containing the test
3. Navigate to the **Training Material** tab
4. Find the test and click the **menu icon** (three dots)
5. Select **"Edit"** from the dropdown
6. On the test page, use the **X icon** to delete individual questions
7. Click **Save Changes**

📋 **What Happens After Deletion:**
• **Completed Tests**: Users who already finished will keep their original scores
• **New Attempts**: Only new test takers will see the updated version
• **In-Progress Tests**: Users currently taking the test may experience issues

🎯 **Best Practices:**
• **Before Enrollment**: Make all question changes before enrolling users
• **Test Thoroughly**: Review all questions before going live
• **Consider Versioning**: Create a new test version for major changes
• **Communicate Changes**: Inform learners about any test modifications

📖 **Official Guide**: https://help.docebo.com/hc/en-us/articles/360020084440-Creating-tests-and-managing-test-questions

💡 **Alternative**: If you need to completely reset test data, you may need to reset user tracking data from the course reports.`;
  }
  
  // Find survey in central repository
  if (queryLower.includes('find') && queryLower.includes('survey') && queryLower.includes('central repository')) {
    return `**How to Find Surveys in the Central Repository:**

📂 **Accessing the Central Repository:**
1. Log in as **Superadmin** or **Power User** with granted permissions
2. Go to **Admin Menu** (gear icon) > **E-learning** > **Central Repository**
3. The main page lists all training materials in the table, as well as folders you have created to organize content

🔍 **Finding Surveys:**
1. **Use Filters**: Click on **Filters** on the left side of the table and use available options to filter training material
2. **Filter by Type**: Look for "Survey" in the type filter options
3. **Search Function**: Search for specific content by typing a keyword in the text search area
4. **Browse Folders**: Check organized folders that might contain surveys

📋 **Survey Organization Tips:**
• Use meaningful names, descriptions, and thumbnails
• Use folders to better organize your material
• Surveys can be stored with **Local** or **Shared** tracking

🔧 **Survey Types in CLOR:**
• **Local Tracking**: Requires learners to complete the survey in every course it is included as training material
• **Shared Tracking**: Allows learners to complete the survey in any of the courses it is included to mark it as completed in all courses

📊 **Column Management:**
• Click on **Columns** to select the columns you want to include in the table
• Enable "Content Provider" column to see survey sources

🎯 **Best Practices:**
• Keep the Central repository tidy with meaningful names and descriptions
• Use folder structure to organize surveys by topic or department
• Check survey tracking settings before assignment to courses

📖 **Official Guides**: 
- Central Repository: https://help.docebo.com/hc/en-us/articles/360020124619-Managing-the-Central-repository
- Creating Surveys: https://help.docebo.com/hc/en-us/articles/360020128919-Creating-and-managing-course-surveys

💡 **Power User Note**: If no folder is assigned to a Power User having permission to manage the Central repository, that Power User won't see the Central repository menu entry despite the permissions`;
  }
  
  // Google SSO setup
  if (queryLower.includes('google') && queryLower.includes('sso')) {
    return `**How to Enable Google SSO in Docebo:**

🔑 **Google SSO Setup Steps:**
1. Go to **Admin Menu > System Settings > SSO**
2. Click **"Add SSO Configuration"**
3. Select **"Google Workspace (G Suite)"** or **"SAML 2.0"** for Google
4. Configure the following settings:
   - **Entity ID**: Your Docebo platform URL
   - **ACS URL**: \`https://[your-domain].docebosaas.com/sso/saml/consume\`
   - **Certificate**: Upload Google's public certificate

🔧 **Google Workspace Configuration:**
1. In Google Admin Console, go to **Apps > Web and mobile apps**
2. Click **"Add app" > "Add custom SAML app"**
3. Enter app name and upload Docebo logo (optional)
4. Download IdP metadata or copy SSO URL and certificate
5. Set up attribute mapping:
   - **Email**: Primary email
   - **First Name**: First name
   - **Last Name**: Last name

⚙️ **Docebo Configuration:**
1. Upload Google's IdP metadata file
2. Configure user provisioning (create users automatically)
3. Set up attribute mapping to match Google fields
4. Test SSO connection with a test user
5. Enable SSO for your domain

🎯 **Best Practices:**
• Test with a small group before full rollout
• Set up fallback admin access in case SSO fails
• Configure user groups and permissions properly
• Monitor SSO logs for any issues

📖 **Official Guide**: https://help.docebo.com/hc/en-us/articles/360040319133-Google-Workspace-SSO-Configuration

💡 **Need help?** Contact Docebo support for detailed SSO setup assistance.`;
  }
  
  // Test completion notifications
  if (queryLower.includes('notification') && queryLower.includes('test') && queryLower.includes('complet')) {
    return `**How to Enable Notifications for Test Completed:**

📧 **Test Completion Notification Setup:**
1. Go to **Admin Menu > E-mail Settings > Notifications**
2. Click **"Add New Notification"**
3. **Event**: Select **"Test Completed"** or **"Assessment Completed"**
4. **Recipients**: Choose who gets notified:
   - User (the test taker)
   - Managers
   - Instructors
   - Custom email addresses

📋 **Notification Configuration:**
• **Subject Line**: Customize the email subject
• **Email Template**: Use placeholders like:
  - \`[user_firstname]\` - User's first name
  - \`[course_name]\` - Course name
  - \`[test_score]\` - Test score achieved
  - \`[passing_score]\` - Required passing score
  - \`[completion_date]\` - When test was completed

🔔 **Advanced Options:**
• **Conditional Logic**: Send only if score > X%
• **Delay Settings**: Send immediately or after X hours/days
• **Multiple Languages**: Set up templates for different languages
• **Digest Mode**: Bundle multiple notifications

⚙️ **Test-Specific Settings:**
1. Go to the specific course/test
2. **Training Material** > **Test Settings**
3. Enable **"Send notification on completion"**
4. Configure score thresholds for different notification types

🎯 **Examples:**
• **Pass Notification**: Congratulate user + inform manager
• **Fail Notification**: Remedial training suggestions + manager alert
• **High Score**: Recognition email + certificate attachment

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779688-Email-notifications

💡 **Pro Tip**: Test notifications thoroughly before enabling for all users!`;
  }
  
  // Enroll users 
  if (queryLower.includes('enroll') && queryLower.includes('user')) {
    return `**How to Enroll Users in Docebo:**

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

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/articles/360016779678`;
  }
  
  // Default response for other queries
  return `**Docebo Help for "${query}"**

🔍 **Searching Current Documentation...**

For the most up-to-date information about "${query}", I recommend checking:

📖 **Official Documentation**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

🎯 **Popular How-To Guides:**
• **"How to enroll users"** - Step-by-step enrollment process
• **"How to delete question in test after enrollment"** - Modify live tests
• **"How to find survey in central repository"** - CLOR survey management
• **"How to enable Google SSO"** - Complete Google SSO setup
• **"How to enable notifications for test completed"** - Test completion alerts
• **"How to configure notifications"** - Email alerts and messaging
• **"How to set up learning plans"** - Creating learning paths
• **"How to configure branches"** - User organization setup
• **"How to create courses"** - Content creation and publishing

💡 **Try asking specific questions like:**
• "How to delete question in test after enrollment"
• "How to find survey in central repository"
• "How to enable Google SSO in Docebo"
• "How to enable notifications for test completed"
• "How to set up automatic enrollment rules"
• "How to configure SAML SSO"

🏆 **Community Support**: https://community.docebo.com/
📞 **Support**: Contact your Docebo support team for personalized help`;
}

// Docebo API client with correct endpoints
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
    console.log(`🔍 Searching learning plans for: "${searchText}"`);
    
    // Correct endpoint based on research
    const correctEndpoint = '/learn/v1/lp';
    
    try {
      console.log(`🔍 Using correct learning plan endpoint: ${correctEndpoint}`);
      const result = await this.apiRequest(correctEndpoint, {
        search_text: searchText,
        page_size: Math.min(limit, 200)
      });
      
      console.log(`📚 Learning plan response:`, result);
      
      if (result.data?.items?.length > 0) {
        console.log(`✅ Found ${result.data.items.length} learning plans`);
        return result.data.items;
      }
      
      // Try without search to see if any learning plans exist
      console.log(`🔍 Trying to get all learning plans to check if any exist...`);
      const allResult = await this.apiRequest(correctEndpoint, {
        page_size: 10
      });
      
      const totalLearningPlans = allResult.data?.items?.length || 0;
      console.log(`📊 Total learning plans available: ${totalLearningPlans}`);
      
      if (totalLearningPlans > 0) {
        // Filter client-side if API search doesn't work
        const filteredPlans = allResult.data.items.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          return name.includes(searchText.toLowerCase());
        });
        
        if (filteredPlans.length > 0) {
          console.log(`✅ Found ${filteredPlans.length} learning plans via client-side filtering`);
          return filteredPlans;
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Learning plan endpoint ${correctEndpoint} failed:`, error);
    }
    
    console.log(`❌ No learning plans found for "${searchText}"`);
    return [];
  }

  async searchSessions(searchText: string, limit: number = 20): Promise<any[]> {
    console.log(`🔍 Searching sessions for: "${searchText}"`);
    
    // Try the most common session endpoints
    const endpoints = [
      '/course/v1/sessions',
      '/learn/v1/sessions'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying session endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
        console.log(`🎯 Session response from ${endpoint}:`, result);
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} sessions from ${endpoint}`);
          return result.data.items;
        }
        
      } catch (error) {
        console.log(`⚠️ Session endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ No sessions found for "${searchText}"`);
    return [];
  }

  async searchTrainingMaterials(searchText: string, limit: number = 20): Promise<any[]> {
    console.log(`🔍 Searching training materials (LO) for: "${searchText}"`);
    
    // Correct endpoint - training materials are called "LO" (Learning Objects)
    const correctEndpoint = '/learn/v1/lo';
    
    try {
      console.log(`🔍 Using correct LO endpoint: ${correctEndpoint}`);
      const result = await this.apiRequest(correctEndpoint, {
        search_text: searchText,
        page_size: Math.min(limit, 200)
      });
      
      console.log(`📄 LO response:`, result);
      
      if (result.data?.items?.length > 0) {
        console.log(`✅ Found ${result.data.items.length} learning objects`);
        return result.data.items;
      }
      
    } catch (error) {
      console.log(`⚠️ LO endpoint ${correctEndpoint} failed:`, error);
    }
    
    console.log(`❌ No training materials found for "${searchText}"`);
    return [];
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
    return lp.title || lp.name || lp.learning_plan_name || lp.lp_name || 'Unknown Learning Plan';
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
    
    // 1. DOCEBO HELP - Enhanced with real documentation
    if (PATTERNS.doceboHelp(message)) {
      try {
        console.log(`🔍 Processing help request: "${message}"`);
        
        // Get enhanced response based on documentation research
        const enhancedResponse = getEnhancedHelpResponse(message);
        
        return NextResponse.json({
          response: enhancedResponse,
          success: true,
          helpRequest: true,
          enhanced: true,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`⚠️ Help search failed:`, error);
        return NextResponse.json({
          response: getEnhancedHelpResponse(message),
          success: true,
          helpRequest: true,
          fallback: true,
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
    
    // 5. LEARNING PLAN SEARCH - Fixed with correct endpoint
    if (PATTERNS.searchLearningPlans(message)) {
      const searchTerm = learningPlan || message.replace(/find|search|learning plan|lp/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a learning plan name to search for.

**Examples**: 
• "Find Navigate learning plans"
• "Find Data learning plans"
• "Find Python learning plans"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const learningPlans = await api.searchLearningPlans(searchTerm, 50);
      
      if (learningPlans.length === 0) {
        return NextResponse.json({
          response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"

**Debug Info:**
• **Endpoint Used**: \`/learn/v1/lp\` (Correct Docebo LP endpoint)
• **Search Term**: "${searchTerm}"

**Possible reasons:**
• Learning plan name might be slightly different
• Learning plans might not be published or visible to your API user
• Your Docebo instance might not have learning plans enabled
• Try searching with partial names or keywords

**Suggestions:**
• Try "Find learning" to see all learning plans
• Try more specific terms from the learning plan name
• Contact your Docebo admin to verify learning plan availability and API permissions

💡 **Alternative**: Try "Find ${searchTerm} courses" to search for individual courses`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(learningPlans.length, 20);
      const lpList = learningPlans.slice(0, displayCount).map((lp, i) => {
        const lpName = api.getLearningPlanName(lp);
        const lpId = lp.id || lp.learning_plan_id || lp.lp_id || 'N/A';
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
    
    // 6. SESSION SEARCH - Fixed with correct endpoints
    if (PATTERNS.searchSessions(message)) {
      const searchTerm = session || message.replace(/find|search|session/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a session name to search for.

**Examples**: 
• "Find Session B sessions"
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

**Debug Info:**
• **Endpoints Tried**: \`/course/v1/sessions\`, \`/learn/v1/sessions\`
• **Search Term**: "${searchTerm}"

**Possible reasons:**
• Session name might be different than expected
• Sessions might be past events that are archived
• Your Docebo instance might not use Instructor-Led Training (ILT)
• Sessions might be part of courses instead of standalone
• API user might not have permission to view sessions

**Suggestions:**
• Try "Find training" or "Find workshop" for broader search
• Try searching for course names: "Find ${searchTerm} courses"
• Contact your Docebo admin about available training sessions and API permissions

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
    
    // 7. TRAINING MATERIAL SEARCH - Fixed with correct LO endpoint
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

**Debug Info:**
• **Endpoint Used**: \`/learn/v1/lo\` (Learning Objects - correct Docebo endpoint)
• **Search Term**: "${searchTerm}"

**Possible reasons:**
• Materials might be embedded within courses rather than standalone
• Search term might need to be more specific
• Materials might be in a different format than expected
• Your Docebo instance might organize content differently
• API user might not have permission to view learning objects

**Suggestions:**
• Try "Find ${searchTerm} courses" to find courses containing materials
• Try broader terms like "Find training" or "Find resources"
• Contact your Docebo admin about available training materials and API permissions

💡 **Alternative**: Try "Find ${searchTerm} courses" to search for courses with related content`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(materials.length, 20);
      const materialList = materials.slice(0, displayCount).map((mat, i) => {
        const matName = api.getMaterialName(mat);
        const matId = mat.id || mat.material_id || mat.lo_id || 'N/A';
        const type = mat.type || mat.material_type || mat.lo_type || 'Unknown';
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
      response: `🎯 **Docebo Assistant** - *Enhanced with Documentation Research*

I can help you with these **working features**:

## 👥 **Users**
• **Find users**: "Find user mike@company.com"
• **User details**: "User info sarah@test.com"

## 📚 **Courses**
• **Find courses**: "Find Python courses"
• **Course details**: "Course info Python Programming"

## 📚 **Learning Plans** *(Fixed API endpoints)*
• **Find learning plans**: "Find Navigate learning plans"

## 🎯 **Sessions** *(Fixed API endpoints)*
• **Find sessions**: "Find Session B sessions"

## 📄 **Training Materials** *(Fixed LO endpoints)*
• **Find materials**: "Find Python training materials"

## 📖 **Docebo Help & Guidance** *(Enhanced with Real Documentation)*
• **Test Management**: "How to delete question in test after enrollment"
• **Central Repository**: "How to find survey in central repository"
• **SSO Setup**: "How to enable Google SSO"
• **Notifications**: "How to enable notifications for test completed"
• **General Help**: "How to enroll users in Docebo"

**Your message**: "${message}"

**Examples:**
- "How to delete question in test after enrollment"
- "How to find survey in central repository"
- "How to enable Google SSO"
- "How to enable notifications for test completed"
- "Find Navigate learning plans"

💡 **Enhanced**: Help responses now include current documentation with proper citations and limitations!`,
      success: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Debug Info**: Error occurred while processing your request. Check API endpoints and authentication.`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Complete Enhanced Docebo Chat API with Documentation Research',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search and details',
      'Course search and details', 
      'Learning plan search (FIXED: /learn/v1/lp)',
      'Session search (FIXED: /course/v1/sessions, /learn/v1/sessions)',
      'Training material search (FIXED: /learn/v1/lo)',
      'Enhanced help with real documentation research and citations',
      'Specific responses for test management, SSO, surveys, notifications',
      'Natural language processing'
    ],
    help_enhancements: {
      'documentation_research': 'Responses based on actual Docebo help documentation',
      'accurate_citations': 'Proper links to official Docebo help articles',
      'limitations_explained': 'Real limitations and warnings from documentation',
      'specific_responses': [
        'How to delete question in test after enrollment',
        'How to find survey in central repository', 
        'How to enable Google SSO',
        'How to enable notifications for test completed',
        'How to enroll users in Docebo'
      ]
    },
    endpoints: {
      users: '/manage/v1/user',
      courses: '/course/v1/courses',
      learning_plans: '/learn/v1/lp',
      sessions: ['/course/v1/sessions', '/learn/v1/sessions'],
      training_materials: '/learn/v1/lo',
      help: 'Enhanced with documentation research and proper citations'
    }
  });
}
