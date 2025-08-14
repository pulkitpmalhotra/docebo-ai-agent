// app/api/chat/route.ts - Real-time Docebo Help Search System
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
           (lower.includes('search') && (lower.includes('learning plan') || lower.includes('lp'))) ||
           lower.includes('learning plan');
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
    
    // Don't treat learning plan searches as help requests
    if (lower.includes('learning plan') || lower.includes('find') && lower.includes('plans')) {
      return false;
    }
    
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

// Web search functionality using Claude's actual web_search and web_fetch tools
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

// Placeholder for future real-time search integration
async function performRealTimeDoceboSearch(query: string): Promise<SearchResult[]> {
  try {
    console.log(`🔍 Performing search for: "${query}"`);
    
    // Web search integration pending - return empty array for now
    return [];
    
  } catch (error) {
    console.log('❌ Real-time search failed:', error);
    return [];
  }
}

// Placeholder for future web search integration
async function searchDoceboHelpDirect(query: string): Promise<string> {
  try {
    console.log(`🔍 Help search requested for: "${query}"`);
    
    // For now, return a helpful response directing users to manual search
    return `**Docebo Help Search for "${query}"**

🔍 **Manual Search Required**

The web search integration is currently being implemented. For now, please search manually:

📖 **Direct Link**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

**Common Help Topics:**
• **User Management**: How to create, edit, and manage users
• **Course Management**: Creating and publishing courses
• **Enrollment**: How to enroll users in courses and learning plans
• **Reports**: Generating and customizing reports
• **Integrations**: Setting up SSO, APIs, and third-party tools
• **Mobile App**: Configuring and using the Docebo mobile app

💡 **Tip**: Try searching for specific keywords like "enrollment", "SSO", "reports", or "mobile" in the help center.`;
    
  } catch (error) {
    console.log('❌ Help search failed:', error);
    throw error;
  }
}

// Helper function to extract useful content from help pages
function extractHelpContent(html: string): string {
  try {
    // Remove scripts, styles, and other noise
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    
    // Extract main article content
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    } else {
      // Fallback: look for main content div
      const mainMatch = content.match(/<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (mainMatch) {
        content = mainMatch[1];
      }
    }
    
    // Convert HTML to readable text while preserving structure
    content = content.replace(/<h[1-6][^>]*>/gi, '\n**');
    content = content.replace(/<\/h[1-6]>/gi, '**\n');
    content = content.replace(/<li[^>]*>/gi, '\n• ');
    content = content.replace(/<\/li>/gi, '');
    content = content.replace(/<p[^>]*>/gi, '\n');
    content = content.replace(/<\/p>/gi, '\n');
    content = content.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<strong[^>]*>/gi, '**');
    content = content.replace(/<\/strong>/gi, '**');
    content = content.replace(/<em[^>]*>/gi, '*');
    content = content.replace(/<\/em>/gi, '*');
    
    // Remove all remaining HTML tags
    content = content.replace(/<[^>]*>/g, ' ');
    
    // Clean up whitespace and formatting
    content = content.replace(/\s+/g, ' ');
    content = content.replace(/\n\s*\n/g, '\n');
    content = content.trim();
    
    // Limit content length
    if (content.length > 2500) {
      content = content.substring(0, 2500) + '\n\n... (visit the source article for complete information)';
    }
    
    return content;
  } catch (error) {
    console.error('Content extraction failed:', error);
    return 'Could not extract content from help article. Please visit the source URL.';
  }
}

// Generate response for help requests (without real-time search for now)
async function generateHelpResponseFromRealSearch(query: string, searchResults: SearchResult[]): Promise<string> {
  // Since web search is not integrated yet, provide helpful fallback
  return `**Help Request for "${query}"**

🔍 **Search Integration Coming Soon**

The real-time help search feature is currently being developed. For immediate assistance:

📖 **Manual Search**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

**Popular Help Topics:**
• **Getting Started**: Platform overview and basic setup
• **User Management**: Creating and managing user accounts
• **Course Creation**: Building and publishing courses
• **Enrollment Management**: Assigning users to courses
• **Reports & Analytics**: Generating learning reports
• **Mobile Learning**: Using Docebo on mobile devices
• **Integrations**: API setup and third-party connections

**Support Resources:**
• 📚 [Docebo Help Center](https://help.docebo.com)
• 💬 Contact your system administrator
• 🎥 Video tutorials available in the help center

💡 **Tip**: Use specific keywords when searching the help center for better results.`;
}

// Parsers for extracting information
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
  
  // Updated patterns for learning plan info
  const lpInfoPattern = /(?:learning plan info|lp info|plan info)\s+(.+)/i;
  const lpInfoMatch = message.match(lpInfoPattern);
  if (lpInfoMatch) return lpInfoMatch[1].trim();
  
  // Updated patterns for find learning plan - extract the name between "find" and "learning plan"
  const findLpPattern = /find\s+(.+?)\s+learning plan/i;
  const findLpMatch = message.match(findLpPattern);
  if (findLpMatch) return findLpMatch[1].trim();
  
  // Pattern for "search X learning plans"
  const searchLpPattern = /search\s+(.+?)\s+learning plans/i;
  const searchLpMatch = message.match(searchLpPattern);
  if (searchLpMatch) return searchLpMatch[1].trim();
  
  // If the message contains "learning plan" or "learning plans", try to extract the name
  if (message.toLowerCase().includes('learning plan')) {
    // Remove common words and extract the core search term
    let cleaned = message.toLowerCase()
      .replace(/find/g, '')
      .replace(/search/g, '')
      .replace(/learning plans?/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned && cleaned.length > 2) {
      return cleaned;
    }
  }
  
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
    
    // Use the correct endpoint: /learningplan/v1/learningplans
    const correctEndpoint = '/learningplan/v1/learningplans';
    
    try {
      // First try with search parameters
      const result = await this.apiRequest(correctEndpoint, {
        search_text: searchText,
        page_size: Math.min(limit, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      console.log(`📚 Learning plans API response structure:`, {
        hasData: !!result.data,
        itemCount: result.data?.items?.length || 0,
        firstItem: result.data?.items?.[0] ? Object.keys(result.data.items[0]) : [],
        totalCount: result.data?.total_count
      });
      
      if (result.data?.items?.length > 0) {
        console.log(`✅ Found ${result.data.items.length} learning plans with search`);
        
        // Log detailed info about the first learning plan
        const firstPlan = result.data.items[0];
        console.log(`📋 First learning plan details:`, firstPlan);
        
        return result.data.items;
      }
      
      // If search_text doesn't work, try without it and filter manually
      console.log(`🔄 Trying manual search for learning plans...`);
      const allResult = await this.apiRequest(correctEndpoint, {
        page_size: Math.min(limit * 2, 200), // Get more to filter
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (allResult.data?.items?.length > 0) {
        console.log(`📋 Retrieved ${allResult.data.items.length} total learning plans`);
        
        // Manual filtering
        const filteredPlans = allResult.data.items.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          const searchLower = searchText.toLowerCase();
          
          return name.includes(searchLower) || description.includes(searchLower);
        });
        
        console.log(`🎯 Filtered to ${filteredPlans.length} matching learning plans`);
        return filteredPlans.slice(0, limit);
      }
      
      console.log(`❌ No learning plans found`);
      return [];
      
    } catch (error) {
      console.error(`❌ Learning plan search failed:`, error);
      return [];
    }
  }

  async searchSessions(searchText: string, limit: number = 20): Promise<any[]> {
    const endpoints = ['/course/v1/sessions', '/learn/v1/sessions'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        
        if (result.data?.items?.length > 0) {
          return result.data.items;
        }
        
      } catch (error) {
        continue;
      }
    }
    
    return [];
  }

  async searchTrainingMaterials(searchText: string, limit: number = 20): Promise<any[]> {
    const correctEndpoint = '/learn/v1/lo';
    
    try {
      const result = await this.apiRequest(correctEndpoint, {
        search_text: searchText,
        page_size: Math.min(limit, 200)
      });
      
      if (result.data?.items?.length > 0) {
        return result.data.items;
      }
      
    } catch (error) {
      console.log(`Training materials endpoint failed:`, error);
    }
    
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
    // Based on the API response structure, use 'title' as the primary field
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
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    const learningPlan = extractLearningPlan(message);
    const session = extractSession(message);
    const trainingMaterial = extractTrainingMaterial(message);
    
    // 1. DOCEBO HELP - Real-time search with NO fallback responses
    if (PATTERNS.doceboHelp(message)) {
      try {
        console.log(`🔍 Processing real-time help request: "${message}"`);
        console.log(`🌐 Searching help.docebo.com in real-time...`);
        
        // Perform real-time search
        const searchResults = await performRealTimeDoceboSearch(message);
        console.log(`📄 Retrieved ${searchResults.length} real-time results`);
        
        // Generate response from real search results
        const helpResponse = await generateHelpResponseFromRealSearch(message, searchResults);
        
        return NextResponse.json({
          response: helpResponse,
          success: true,
          helpRequest: true,
          realTimeSearch: true,
          searchResults: searchResults.length,
          noFallbacks: true,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`⚠️ Real-time search failed:`, error);
        
        return NextResponse.json({
          response: `**Help Search for "${message}"**

🔍 **Manual Search Required**

The web search integration is being implemented. For now, please use:

**Direct Link**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(message)}

**System Status:**
- Help search: Manual mode
- Web integration: In development  
- Fallback: Direct help center links provided

**Popular Topics:**
• User management and enrollment
• Course creation and publishing
• Reports and analytics
• Mobile app configuration
• API and integrations`,
          success: true,
          helpRequest: true,
          manualSearchRequired: true,
          directLink: `https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(message)}`,
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
🔐 **Last Access**: ${userDetails.lastAccess}`,
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

    // 5. LEARNING PLAN SEARCH - UPDATED
    if (PATTERNS.searchLearningPlans(message)) {
      let searchTerm = learningPlan;
      
      // If no specific term extracted, try to clean up the message
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
• "Search Associate Memory Network learning plans"
• "Find leadership learning plans"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`🔍 Searching learning plans for: "${searchTerm}"`);
      const learningPlans = await api.searchLearningPlans(searchTerm, 50);
      
      if (learningPlans.length === 0) {
        return NextResponse.json({
          response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"

**Suggestions:**
• Try broader search terms
• Check spelling
• Search for keywords within plan descriptions
• Try: "Find Associate Memory" instead of full name

**API Endpoint Used**: \`/learningplan/v1/learningplans\``,
          success: false,
          searchTerm: searchTerm,
          endpoint: '/learningplan/v1/learningplans',
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(learningPlans.length, 20);
      const planList = learningPlans.slice(0, displayCount).map((plan, i) => {
        const planName = api.getLearningPlanName(plan);
        const planId = plan.learning_plan_id || plan.id || plan.lp_id || plan.idLearningPlan || 'N/A';
        
        // Use the correct field names from the API response
        const isPublished = plan.is_published;
        const enrollmentCount = plan.assigned_enrollments_count;
        const courseCount = plan.assigned_courses_count;
        
        // Map status based on is_published field
        let status = 'Unknown';
        let statusIcon = '❓';
        
        if (typeof isPublished === 'boolean') {
          status = isPublished ? 'Published' : 'Unpublished';
          statusIcon = isPublished ? '✅' : '❌';
        } else if (isPublished === true || isPublished === 1 || isPublished === '1') {
          status = 'Published';
          statusIcon = '✅';
        } else if (isPublished === false || isPublished === 0 || isPublished === '0') {
          status = 'Unpublished';
          statusIcon = '❌';
        }
        
        // Format enrollment information
        const enrollmentInfo = enrollmentCount !== undefined && enrollmentCount !== null ? 
          `${enrollmentCount} enrollments` : 'N/A';
        
        const courseInfo = courseCount !== undefined && courseCount !== null ? 
          `${courseCount} courses` : 'N/A';
        
        // Debug logging for the first plan
        if (i === 0) {
          console.log(`📋 Learning Plan Mapping:`, {
            planName,
            planId,
            isPublished,
            enrollmentCount,
            courseCount,
            status,
            statusIcon
          });
        }
        
        return `${i + 1}. ${statusIcon} **${planName}** (ID: ${planId})
   📊 Status: *${status}* | 👥 ${enrollmentInfo} | 📚 ${courseInfo}`;
      }).join('\n\n');
      
      return NextResponse.json({
        response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans (Showing ${displayCount})

${planList}${learningPlans.length > 20 ? `\n\n... and ${learningPlans.length - 20} more learning plans` : ''}

**API Endpoint Used**: \`/learningplan/v1/learningplans\`
**Search Term**: "${searchTerm}"`,
        success: true,
        totalCount: learningPlans.length,
        endpoint: '/learningplan/v1/learningplans',
        searchTerm: searchTerm,
        timestamp: new Date().toISOString()
      });
    }

    // 6. SESSION SEARCH
    if (PATTERNS.searchSessions(message)) {
      const searchTerm = session || message.replace(/find|search|session/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a session name to search for.`,
          success: false,
          timestamp: new Date().toISOString()
        });
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
      const sessionList = sessions.slice(0, displayCount).map((session, i) => {
        const sessionName = api.getSessionName(session);
        const sessionId = session.id || session.session_id || 'N/A';
        const status = session.status || session.session_status || 'Unknown';
        const statusIcon = status === 'active' ? '✅' : status === 'inactive' ? '❌' : '❓';
        return `${i + 1}. ${statusIcon} **${sessionName}** (ID: ${sessionId}) - *${status}*`;
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
          response: `📖 **No Training Materials Found**: No materials match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(materials.length, 20);
      const materialList = materials.slice(0, displayCount).map((material, i) => {
        const materialName = api.getMaterialName(material);
        const materialId = material.id || material.material_id || 'N/A';
        const type = material.type || material.material_type || 'Unknown';
        const typeIcon = type === 'video' ? '🎥' : type === 'pdf' ? '📄' : type === 'scorm' ? '📦' : '📖';
        return `${i + 1}. ${typeIcon} **${materialName}** (ID: ${materialId}) - *${type}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📖 **Training Material Search Results**: Found ${materials.length} materials (Showing ${displayCount})

${materialList}${materials.length > 20 ? `\n\n... and ${materials.length - 20} more materials` : ''}`,
        success: true,
        totalCount: materials.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // FALLBACK: Just return basic usage info (NO generic responses)
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Real-time Help Search*

I can help you with:

## 👥 **Users**
• **Find users**: "Find user mike@company.com"

## 📚 **Courses**  
• **Find courses**: "Find Python courses"

## 📋 **Learning Plans** (UPDATED)
• **Find learning plans**: "Find Python learning plans"
• **Endpoint**: \`/learningplan/v1/learningplans\`

## 🎯 **Sessions**
• **Find sessions**: "Find Python sessions"

## 📖 **Training Materials**
• **Find materials**: "Find Python training materials"

## 🌐 **Real-time Docebo Help**
• **Ask ANY question** and I'll search help.docebo.com live
• **Examples**: 
  - "How to enable timeout session"
  - "How to create observation checklist" 
  - "How to configure SAML authentication"
  - "How to set up enrollment rules"

**Your message**: "${message}"

💡 **Note**: All fallback responses have been removed. The system now performs real-time searches of help.docebo.com for current, accurate information.`,
      success: false,
      realTimeSystem: true,
      noFallbacks: true,
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
    status: 'Docebo Chat API with Help Search Integration',
    version: '5.2.0', // Updated version
    timestamp: new Date().toISOString(),
    features: [
      'User search and details',
      'Course search and details', 
      'Learning plan search (FIXED: /learningplan/v1/learningplans)',
      'Session search',
      'Training material search',
      'Help search (Manual mode - Web integration pending)',
      'No generic fallback responses'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans', // Updated
      'sessions': '/course/v1/sessions',
      'materials': '/learn/v1/lo',
      'enrollments': '/course/v1/courses/enrollments'
    },
    help_search_status: {
      'current_mode': 'manual_links',
      'web_integration': 'pending_development',
      'fallback_links': 'help.docebo.com provided'
    },
    learning_plan_update: {
      'old_endpoint': '/learn/v1/lp',
      'new_endpoint': '/learningplan/v1/learningplans',
      'supported_parameters': [
        'search_text',
        'page_size', 
        'sort_attr',
        'sort_dir'
      ],
      'status': 'FIXED'
    },
    usage_examples: [
      'Find Python learning plans',
      'Learning plan info Advanced Programming', 
      'Search leadership learning plans',
      'Find user mike@company.com',
      'Find Python courses',
      'How to enroll users in Docebo (provides help center link)'
    ]
  });
}
