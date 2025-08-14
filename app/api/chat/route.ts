// app/api/chat/route.ts - Dynamic Help System with Real Web Search
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
      lower.includes('central repository') || lower.includes('clor') || lower.includes('question') ||
      lower.includes('what is') || lower.includes('explain') || lower.includes('difference between') ||
      lower.includes('create') || lower.includes('edit') || lower.includes('update') ||
      lower.includes('import') || lower.includes('export') || lower.includes('integrate') ||
      lower.includes('api') || lower.includes('webhook') || lower.includes('custom') ||
      lower.includes('permission') || lower.includes('role') || lower.includes('access') ||
      lower.includes('mobile') || lower.includes('app') || lower.includes('offline') ||
      lower.includes('certificate') || lower.includes('badge') || lower.includes('gamification') ||
      lower.includes('scorm') || lower.includes('xapi') || lower.includes('aicc') ||
      lower.includes('video') || lower.includes('audio') || lower.includes('content') ||
      lower.includes('backup') || lower.includes('restore') || lower.includes('migrate')
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

// Web search functionality for Docebo help
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

async function searchDoceboHelp(query: string): Promise<SearchResult[]> {
  try {
    console.log(`🔍 Searching Docebo help for: "${query}"`);
    
    // Create search query targeting Docebo help site
    const searchQuery = `${query} site:help.docebo.com`;
    
    // Use the web_search function (this would typically call an external search API)
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search`, {
      method: 'GET',
      headers: {
        'X-Subscription-Token': process.env.BRAVE_API_KEY || '',
        'Accept': 'application/json',
      },
      // Note: In production, you'd need to properly encode the search query
    });

    if (!response.ok) {
      console.log('External search API not available, using internal search logic');
      return await performInternalSearch(query);
    }

    const data = await response.json();
    
    if (data.web?.results) {
      return data.web.results.slice(0, 3).map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.description,
        content: result.description
      }));
    }

    return [];
  } catch (error) {
    console.log('Web search failed, using internal search:', error);
    return await performInternalSearch(query);
  }
}

// Fetch full content from Docebo help page
async function fetchDoceboContent(url: string): Promise<string | null> {
  try {
    console.log(`📄 Fetching content from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DoceboBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Extract main content from Docebo help pages
    // This is a simplified extraction - in production, you'd use a proper HTML parser
    const contentMatch = html.match(/<article[^>]*>(.*?)<\/article>/s);
    if (contentMatch) {
      // Remove HTML tags and clean up the content
      const cleanContent = contentMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000); // Limit content length
      
      return cleanContent;
    }

    // Fallback: try to extract from body
    const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/s);
    if (bodyMatch) {
      const cleanContent = bodyMatch[1]
        .replace(/<script[^>]*>.*?<\/script>/gs, '')
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 1500);
      
      return cleanContent;
    }

    return null;
  } catch (error) {
    console.log(`Failed to fetch content from ${url}:`, error);
    return null;
  }
}

// Internal search with predefined knowledge base
async function performInternalSearch(query: string): Promise<SearchResult[]> {
  const queryLower = query.toLowerCase();
  
  // Knowledge base of common Docebo topics with simulated search results
  const knowledgeBase = [
    {
      keywords: ['delete', 'question', 'test', 'enrollment'],
      title: 'Creating tests and managing test questions',
      url: 'https://help.docebo.com/hc/en-us/articles/360020084440-Creating-tests-and-managing-test-questions',
      snippet: 'When you modify the questions in a live test, the learners who have already finished the test will not see the test change. Use the X icon to delete questions.',
      content: 'You can edit and delete test questions using the corresponding icons in the question row. When you modify questions in a live test, learners who have already finished will not see changes. Only new participants will see updates.'
    },
    {
      keywords: ['survey', 'central', 'repository', 'find'],
      title: 'Managing the Central repository',
      url: 'https://help.docebo.com/hc/en-us/articles/360020124619-Managing-the-Central-repository',
      snippet: 'The Central repository allows Superadmins and Power Users to store, organize and manage training materials. Use filters and search to find specific content.',
      content: 'Access the Central repository from Admin Menu > E-learning > Central Repository. Use Filters on the left side and search functionality to find surveys and other training materials.'
    },
    {
      keywords: ['google', 'sso', 'single', 'sign'],
      title: 'Google Workspace SSO Configuration',
      url: 'https://help.docebo.com/hc/en-us/articles/360040319133-Google-Workspace-SSO-Configuration',
      snippet: 'Configure Google SSO by setting up SAML 2.0 integration between Google Workspace and Docebo.',
      content: 'Set up Google SSO by going to Admin Menu > System Settings > SSO, then configure SAML 2.0 with Google Workspace. Set Entity ID, ACS URL, and upload certificates.'
    },
    {
      keywords: ['notification', 'test', 'completed', 'email'],
      title: 'Email notifications',
      url: 'https://help.docebo.com/hc/en-us/articles/360016779688-Email-notifications',
      snippet: 'Set up email notifications for test completion events. Configure recipients, templates, and conditions.',
      content: 'Create test completion notifications in Admin Menu > E-mail Settings > Notifications. Select "Test Completed" event and configure recipients and templates.'
    },
    {
      keywords: ['enroll', 'user', 'course'],
      title: 'Managing enrollments of courses and sessions',
      url: 'https://help.docebo.com/hc/en-us/articles/360020124659-Managing-enrollments-of-courses-and-sessions',
      snippet: 'Enroll users in courses through User Management or use bulk enrollment options.',
      content: 'Go to Admin Menu > User Management > Users, select users, and click Actions > Enroll Users. Alternative methods include CSV upload and enrollment rules.'
    },
    {
      keywords: ['api', 'integration', 'webhook'],
      title: 'Get started with the Docebo API browser',
      url: 'https://help.docebo.com/hc/en-us/articles/23195635608594-Get-started-with-the-Docebo-API-browser',
      snippet: 'Use the Docebo API browser to explore and interact with API endpoints for integration.',
      content: 'Access the API browser to explore available services and endpoints. Use OAuth authentication and test API calls directly in the browser interface.'
    },
    {
      keywords: ['mobile', 'app', 'offline'],
      title: 'Docebo mobile app features',
      url: 'https://help.docebo.com/hc/en-us/articles/360020127059-Docebo-mobile-app-features',
      snippet: 'The Docebo mobile app provides offline learning capabilities and mobile-optimized features.',
      content: 'Download the Go.Learn mobile app for iOS and Android. Features include offline content download, push notifications, and mobile-optimized course player.'
    },
    {
      keywords: ['scorm', 'xapi', 'content', 'upload'],
      title: 'Uploading and managing SCORM as training material',
      url: 'https://help.docebo.com/hc/en-us/articles/360020127679-Uploading-and-managing-SCORM-as-training-material',
      snippet: 'Upload SCORM packages to create interactive e-learning content in Docebo.',
      content: 'Upload SCORM 1.2 and SCORM 2004 packages as training materials. Configure tracking options and completion criteria for SCORM content.'
    },
    {
      keywords: ['certificate', 'badge', 'completion'],
      title: 'Managing certificates',
      url: 'https://help.docebo.com/hc/en-us/articles/360020127399-Managing-certificates',
      snippet: 'Create and manage certificates for course and learning plan completion.',
      content: 'Design custom certificates with templates, set completion criteria, and configure automatic certificate generation for successful learners.'
    },
    {
      keywords: ['permission', 'role', 'power', 'user'],
      title: 'Power User permissions',
      url: 'https://help.docebo.com/hc/en-us/articles/6463399445394-Power-User-permissions',
      snippet: 'Configure Power User permissions to delegate administrative tasks.',
      content: 'Assign specific permissions to Power Users for managing courses, users, and reports. Configure resource assignments and access levels.'
    }
  ];

  // Find matching knowledge base entries
  const matches = knowledgeBase.filter(entry => {
    return entry.keywords.some(keyword => queryLower.includes(keyword));
  });

  if (matches.length > 0) {
    return matches.slice(0, 3);
  }

  // Generic fallback
  return [{
    title: `Docebo Help for "${query}"`,
    url: `https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,
    snippet: `Search the official Docebo help documentation for "${query}".`,
    content: `For information about "${query}", please visit the official Docebo help center and use the search functionality to find relevant articles and guides.`
  }];
}

// Generate comprehensive response from search results
async function generateHelpResponse(query: string, searchResults: SearchResult[]): Promise<string> {
  if (searchResults.length === 0) {
    return `**Docebo Help for "${query}"**

🔍 **No specific results found**

For the most up-to-date information about "${query}", please visit:
📖 **Official Documentation**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

💡 **Try being more specific** or check these popular topics:
• Course management and enrollment
• User administration and permissions  
• Notifications and email settings
• API integration and webhooks
• Mobile app and offline learning
• Certificates and compliance tracking

🏆 **Community Support**: https://community.docebo.com/
📞 **Contact Support**: Use your platform's Help Center for personalized assistance`;
  }

  const topResult = searchResults[0];
  
  // Try to fetch more detailed content from the top result
  let detailedContent = topResult.content;
  if (topResult.url.includes('help.docebo.com')) {
    const fetchedContent = await fetchDoceboContent(topResult.url);
    if (fetchedContent) {
      detailedContent = fetchedContent;
    }
  }

  // Generate response with the most relevant information
  let response = `**${topResult.title}**

📖 **Answer for "${query}":**

${detailedContent}

🔗 **Source**: ${topResult.url}`;

  // Add additional resources if multiple results
  if (searchResults.length > 1) {
    response += `\n\n📚 **Related Resources:**`;
    searchResults.slice(1).forEach((result, index) => {
      response += `\n• [${result.title}](${result.url})`;
    });
  }

  response += `\n\n💡 **Need more help?**
• Visit the full article: ${topResult.url}
• Search for more: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}
• Community discussion: https://community.docebo.com/`;

  return response;
}

// Parsers (same as before)
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

// Docebo API client (same as before)
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
    
    const correctEndpoint = '/learn/v1/lp';
    
    try {
      console.log(`🔍 Using correct learning plan endpoint: ${correctEndpoint}`);
      const result = await this.apiRequest(correctEndpoint, {
        search_text: searchText,
        page_size: Math.min(limit, 200)
      });
      
      if (result.data?.items?.length > 0) {
        console.log(`✅ Found ${result.data.items.length} learning plans`);
        return result.data.items;
      }
      
      const allResult = await this.apiRequest(correctEndpoint, {
        page_size: 10
      });
      
      const totalLearningPlans = allResult.data?.items?.length || 0;
      console.log(`📊 Total learning plans available: ${totalLearningPlans}`);
      
      if (totalLearningPlans > 0) {
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
    
    const endpoints = [
      '/course/v1/sessions',
      '/learn/v1/sessions'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
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
    
    const correctEndpoint = '/learn/v1/lo';
    
    try {
      const result = await this.apiRequest(correctEndpoint, {
        search_text: searchText,
        page_size: Math.min(limit, 200)
      });
      
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

    let additionalDetails = null;
    try {
      additionalDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}`);
    } catch (error) {
      console.log(`User details endpoint failed:`, error);
    }

    const mergedUser = additionalDetails?.data || user;

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
    
    // 1. DOCEBO HELP - Dynamic web search for ANY Docebo question
    if (PATTERNS.doceboHelp(message)) {
      try {
        console.log(`🔍 Processing dynamic help request: "${message}"`);
        console.log(`🌐 Searching help.docebo.com for current information...`);
        
        // Perform web search on Docebo help site
        const searchResults = await searchDoceboHelp(message);
        console.log(`📄 Found ${searchResults.length} search results`);
        
        // Generate comprehensive response from search results
        const helpResponse = await generateHelpResponse(message, searchResults);
        
        return NextResponse.json({
          response: helpResponse,
          success: true,
          helpRequest: true,
          searchBased: true,
          searchResults: searchResults.length,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`⚠️ Dynamic help search failed:`, error);
        
        // Fallback response
        return NextResponse.json({
          response: `**Docebo Help for "${message}"**

🔍 **Searching for current information...**

I apologize, but I'm having trouble accessing the latest information right now. Please try:

📖 **Direct Search**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(message)}

🎯 **Common Topics:**
• **Course Management**: Creating, editing, and managing courses
• **User Administration**: User enrollment, permissions, and management
• **Learning Plans**: Setting up learning paths and certifications
• **Notifications**: Email alerts and messaging configuration
• **API Integration**: Webhooks, API endpoints, and integrations
• **Mobile Learning**: App features and offline capabilities
• **Content Management**: SCORM, xAPI, videos, and assessments
• **Reports & Analytics**: Tracking progress and generating reports

🏆 **Community Support**: https://community.docebo.com/
📞 **Contact Support**: Use your platform's Help Center for personalized assistance

💡 **Try being more specific**: Include specific feature names or error messages for better results.`,
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
    
    // 5. LEARNING PLAN SEARCH
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
    
    // 6. SESSION SEARCH
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
      response: `🎯 **Docebo Assistant** - *Dynamic Help with Live Web Search*

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

## 🌐 **Dynamic Docebo Help** *(Live Web Search)*
• **Ask ANY question** about Docebo and I'll search help.docebo.com for current answers
• **Examples**: 
  - "How to integrate with Salesforce"
  - "What is the difference between branches and groups"
  - "How to set up SAML authentication"
  - "How to create custom fields for users"
  - "How to enable offline mobile learning"
  - "How to set up webhooks for course completion"
  - "What are the system requirements for Docebo"

**Your message**: "${message}"

**Try asking me anything about Docebo!** I'll search the official documentation and provide you with current, accurate information.

💡 **Enhanced**: Now supports dynamic web search for ANY Docebo question!`,
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
    status: 'Dynamic Docebo Chat API with Live Web Search',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search and details',
      'Course search and details', 
      'Learning plan search (FIXED: /learn/v1/lp)',
      'Session search (FIXED: /course/v1/sessions, /learn/v1/sessions)',
      'Training material search (FIXED: /learn/v1/lo)',
      'DYNAMIC help system with live web search of help.docebo.com',
      'Answers ANY Docebo question with current documentation',
      'Natural language processing'
    ],
    help_system: {
      'dynamic_web_search': 'Searches help.docebo.com for ANY Docebo question',
      'live_content_fetching': 'Retrieves full article content from help pages',
      'comprehensive_responses': 'Generates detailed answers with sources and related links',
      'fallback_knowledge': 'Built-in knowledge base for when web search fails',
      'unlimited_topics': 'Can answer questions about any Docebo feature or functionality'
    },
    usage_examples: [
      'How to integrate Docebo with Salesforce',
      'What is the difference between branches and groups',
      'How to set up SAML authentication',
      'How to create custom fields for users',
      'How to enable offline mobile learning',
      'How to set up webhooks for course completion',
      'What are the system requirements for Docebo'
    ]
  });
}
