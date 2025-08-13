// Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    const learningPlan = extractLear// app/api/chat/route.ts - Clean & Reliable - Working Features Only
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

// Simple cache for storing search results
const searchCache = new Map();

// Generate cache key for storing results
function generateSearchCacheKey(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
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
      // Direct help requests
      lower.includes('how to') || lower.includes('how do i') || lower.includes('how does') ||
      // Feature questions
      lower.includes('what is') && (lower.includes('docebo') || lower.includes('feature')) ||
      // Configuration questions
      lower.includes('configure') || lower.includes('setup') || lower.includes('enable') ||
      // Functionality questions
      lower.includes('functionality') || lower.includes('feature') || lower.includes('capability') ||
      // Help keywords
      lower.includes('help') || lower.includes('guide') || lower.includes('tutorial') ||
      lower.includes('documentation') || lower.includes('manual') ||
      // Process questions
      lower.includes('process') || lower.includes('workflow') || lower.includes('steps') ||
      // Troubleshooting
      lower.includes('troubleshoot') || lower.includes('problem') || lower.includes('issue') ||
      lower.includes('error') || lower.includes('not working') ||
      // Best practices
      lower.includes('best practice') || lower.includes('recommendation') ||
      // Admin questions
      lower.includes('admin') || lower.includes('administration') || lower.includes('manage') ||
      // Specific Docebo features
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
  getLearningPlanInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('learning plan info') || lower.includes('lp info') || 
            lower.includes('learning plan details') || lower.includes('lp details') ||
            lower.includes('tell me about learning plan'));
  },
  getSessionInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('session info') || lower.includes('session details') || 
            lower.includes('tell me about session'));
  },
  getTrainingMaterialInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('material info') || lower.includes('training material info') || 
            lower.includes('material details') || lower.includes('training material details') ||
            lower.includes('tell me about material') || lower.includes('tell me about training material'));
  },
  userQuestion: (msg: string) => {
    const lower = msg.toLowerCase();
    const hasEmail = msg.includes('@');
    
    // Check for user-specific questions with email
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
  },
  showAllResults: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('show all') || lower.includes('all results') || 
            lower.includes('all courses') || lower.includes('all users') ||
            lower.includes('all learning plans') || lower.includes('all sessions') ||
            lower.includes('all materials')) &&
           lower.includes('search_');
  }
};

// Parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractSearchCacheKey(message: string): string | null {
  const match = message.match(/search_([a-f0-9A-F_]+)/);
  return match ? match[1] : null;
}

function extractLearningPlan(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "learning plan info" pattern
  const lpInfoMatch = message.match(/(?:learning plan info|lp info)\s+(.+)/i);
  if (lpInfoMatch) return lpInfoMatch[1].trim();
  
  // Try "find" pattern
  const lpMatch = message.match(/find\s+(.+?)\s+(?:learning plan|lp)/i);
  if (lpMatch) return lpMatch[1].trim();
  
  return null;
}

function extractSession(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "session info" pattern
  const sessionInfoMatch = message.match(/session info\s+(.+)/i);
  if (sessionInfoMatch) return sessionInfoMatch[1].trim();
  
  // Try "find" pattern
  const sessionMatch = message.match(/find\s+(.+?)\s+session/i);
  if (sessionMatch) return sessionMatch[1].trim();
  
  return null;
}

function extractTrainingMaterial(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "material info" pattern
  const materialInfoMatch = message.match(/(?:material info|training material info)\s+(.+)/i);
  if (materialInfoMatch) return materialInfoMatch[1].trim();
  
  // Try "find" pattern
  const materialMatch = message.match(/find\s+(.+?)\s+(?:material|training material)/i);
  if (materialMatch) return materialMatch[1].trim();
  
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
    
    // 1.5. DOCEBO HELP AND FUNCTIONALITY
    if (PATTERNS.doceboHelp(message)) {
      console.log(`📖 Docebo help request detected: ${message}`);
      
      try {
        const helpResponse = await api.getDoceboHelpResponse(message);
        
        return NextResponse.json({
          response: helpResponse,
          success: true,
          helpRequest: true,
          query: message,
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

📖 **Official Documentation**: https://help.docebo.com/hc/en-us

For specific technical questions, please visit the Docebo Help Center for the most up-to-date information.`,
          success: true,
          helpRequest: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 9. LEARNING PLAN DETAILS
    if (PATTERNS.getLearningPlanInfo(message)) {
      const lpName = learningPlan || message.replace(/learning plan info|lp info|learning plan details|lp details|tell me about learning plan/gi, '').trim();
      
      if (!lpName || lpName.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Learning Plan Name**: I need a learning plan name to get details.

**Example**: "Learning plan info Python Fundamentals"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const lpDetails = await api.getLearningPlanDetails(lpName);
        
        return NextResponse.json({
          response: `📚 **Learning Plan Details**: ${lpDetails.name}

🆔 **Learning Plan ID**: ${lpDetails.id}
📖 **Type**: ${lpDetails.type}
📊 **Status**: ${lpDetails.status}
🌍 **Language**: ${lpDetails.language}
🏆 **Credits**: ${lpDetails.credits}
⏱️ **Duration**: ${lpDetails.duration}
📂 **Category**: ${lpDetails.category}
👥 **Enrolled**: ${lpDetails.enrollments}
📚 **Courses**: ${lpDetails.courses}
📅 **Created**: ${lpDetails.creationDate}
👤 **Created By**: ${lpDetails.createdBy}
📝 **Last Updated**: ${lpDetails.modificationDate}
👤 **Last Updated By**: ${lpDetails.lastUpdatedBy}

📋 **Description**: 
${lpDetails.description}`,
          success: true,
          data: lpDetails,
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
    
    // 10. SESSION DETAILS
    if (PATTERNS.getSessionInfo(message)) {
      const sessionName = session || message.replace(/session info|session details|tell me about session/gi, '').trim();
      
      if (!sessionName || sessionName.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Session Name**: I need a session name to get details.

**Example**: "Session info Python Workshop"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const sessionDetails = await api.getSessionDetails(sessionName);
        
        return NextResponse.json({
          response: `🎯 **Session Details**: ${sessionDetails.name}

🆔 **Session ID**: ${sessionDetails.id}
📊 **Status**: ${sessionDetails.status}
📚 **Course**: ${sessionDetails.course}
👨‍🏫 **Instructor**: ${sessionDetails.instructor}
📍 **Location**: ${sessionDetails.location}
🕐 **Timezone**: ${sessionDetails.timezone}
📅 **Start Date**: ${sessionDetails.startDate}
📅 **End Date**: ${sessionDetails.endDate}
👥 **Capacity**: ${sessionDetails.capacity}
✅ **Enrolled**: ${sessionDetails.enrolled}

📋 **Description**: 
${sessionDetails.description}`,
          success: true,
          data: sessionDetails,
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
    
    // 11. TRAINING MATERIAL DETAILS
    if (PATTERNS.getTrainingMaterialInfo(message)) {
      const materialName = trainingMaterial || message.replace(/material info|training material info|material details|training material details|tell me about material|tell me about training material/gi, '').trim();
      
      if (!materialName || materialName.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Material Name**: I need a material name to get details.

**Example**: "Material info Python Guide"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const materialDetails = await api.getTrainingMaterialDetails(materialName);
        
        return NextResponse.json({
          response: `📄 **Training Material Details**: ${materialDetails.name}

🆔 **Material ID**: ${materialDetails.id}
📁 **Type**: ${materialDetails.type}
📋 **Format**: ${materialDetails.format}
📊 **Status**: ${materialDetails.status}
💾 **Size**: ${materialDetails.size}
⏱️ **Duration**: ${materialDetails.duration}
🌍 **Language**: ${materialDetails.language}
📚 **Course**: ${materialDetails.course}
📥 **Downloads**: ${materialDetails.downloads}
📅 **Created**: ${materialDetails.creationDate}
👤 **Created By**: ${materialDetails.createdBy}
📝 **Last Updated**: ${materialDetails.modificationDate}
👤 **Last Updated By**: ${materialDetails.lastUpdatedBy}

📋 **Description**: 
${materialDetails.description}`,
          success: true,
          data: materialDetails,
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
    
    // 5. LEARNING PLAN SEARCH
    if (PATTERNS.searchLearningPlans(message)) {
      const searchTerm = learningPlan || message.replace(/find|search|learning plan|lp/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a learning plan name to search for.

**Example**: "Find Python learning plans"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const learningPlans = await api.searchLearningPlans(searchTerm, 50);
      
      if (learningPlans.length === 0) {
        return NextResponse.json({
          response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(learningPlans.length, 20);
      const lpList = learningPlans.slice(0, displayCount).map((lp, i) => {
        const lpName = api.getLearningPlanName(lp);
        const lpId = api.getLearningPlanId(lp);
        const status = lp.status || lp.learning_plan_status || 'Unknown';
        const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
        return `${i + 1}. ${statusIcon} **${lpName}** (ID: ${lpId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans (Showing ${displayCount})

${lpList}${learningPlans.length > 20 ? `\n\n... and ${learningPlans.length - 20} more learning plans` : ''}

💡 **Get Details**: "Learning plan info ${api.getLearningPlanName(learningPlans[0])}" for more information`,
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

**Example**: "Find Python sessions"`,
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
      const sessionList = sessions.slice(0, displayCount).map((sess, i) => {
        const sessName = api.getSessionName(sess);
        const sessId = api.getSessionId(sess);
        const status = sess.status || sess.session_status || 'Unknown';
        const statusIcon = status === 'active' ? '✅' : status === 'cancelled' ? '❌' : status === 'completed' ? '🏁' : '❓';
        return `${i + 1}. ${statusIcon} **${sessName}** (ID: ${sessId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `🎯 **Session Search Results**: Found ${sessions.length} sessions (Showing ${displayCount})

${sessionList}${sessions.length > 20 ? `\n\n... and ${sessions.length - 20} more sessions` : ''}

💡 **Get Details**: "Session info ${api.getSessionName(sessions[0])}" for more information`,
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

**Example**: "Find Python training materials"`,
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
        const matId = api.getMaterialId(mat);
        const type = mat.type || mat.material_type || 'Unknown';
        const typeIcon = type === 'video' ? '🎥' : type === 'document' ? '📄' : type === 'audio' ? '🎵' : '📁';
        return `${i + 1}. ${typeIcon} **${matName}** (ID: ${matId}) - *${type}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📄 **Training Material Search Results**: Found ${materials.length} materials (Showing ${displayCount})

${materialList}${materials.length > 20 ? `\n\n... and ${materials.length - 20} more materials` : ''}

💡 **Get Details**: "Material info ${api.getMaterialName(materials[0])}" for more information`,
        success: true,
        totalCount: materials.length,
        timestamp: new Date().toISOString()
      });
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
    const result = await this.apiRequest('/learn/v1/learningplans', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchSessions(searchText: string, limit: number = 20): Promise<any[]> {
    // Try multiple endpoints for sessions
    const endpoints = [
      '/course/v1/sessions',
      '/learn/v1/sessions',
      '/manage/v1/sessions'
    ];
    
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
        console.log(`⚠️ Session endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    return [];
  }

  async searchTrainingMaterials(searchText: string, limit: number = 20): Promise<any[]> {
    // Try multiple endpoints for training materials
    const endpoints = [
      '/learn/v1/materials',
      '/course/v1/materials',
      '/manage/v1/materials',
      '/learn/v1/lo'  // Learning Objects
    ];
    
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
        console.log(`⚠️ Training material endpoint ${endpoint} failed:`, error);
        continue;
      }
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

    console.log(`🔍 Raw user data for ${email}:`, JSON.stringify(user, null, 2));
    
    // **DEBUG MODE** - Log all user fields that might contain branch/manager info
    const debugFields = {
      allFields: Object.keys(user),
      branchFields: Object.keys(user).filter(k => k.toLowerCase().includes('branch') || k.toLowerCase().includes('office') || k.toLowerCase().includes('location')),
      managerFields: Object.keys(user).filter(k => k.toLowerCase().includes('manager') || k.toLowerCase().includes('supervisor') || k.toLowerCase().includes('report')),
      potentialBranchValues: {} as Record<string, any>,
      potentialManagerValues: {} as Record<string, any>
    };
    
    // Extract potential branch values
    debugFields.branchFields.forEach(field => {
      debugFields.potentialBranchValues[field] = (user as any)[field];
    });
    
    // Extract potential manager values  
    debugFields.managerFields.forEach(field => {
      debugFields.potentialManagerValues[field] = (user as any)[field];
    });
    
    console.log(`🔍 DEBUG FIELDS ANALYSIS:`, JSON.stringify(debugFields, null, 2));

    // Try multiple API endpoints to get complete user data
    let additionalDetails = null;
    let branchDetails = null;
    let groupDetails = null;
    let userOrgDetails = null;
    let managerDetails = null;
    let branchListDetails = null;

    // Try user-specific endpoint
    try {
      additionalDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}`);
      console.log(`📋 User-specific endpoint data:`, JSON.stringify(additionalDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ User-specific endpoint failed for ${user.user_id}:`, error);
    }

    // Try branches endpoint
    try {
      branchDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}/branches`);
      console.log(`🏛️ User branches endpoint:`, JSON.stringify(branchDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Branches endpoint failed for ${user.user_id}:`, error);
    }

    // Try alternative branches endpoint
    try {
      branchListDetails = await this.apiRequest('/manage/v1/branches', {
        user_id: user.user_id
      });
      console.log(`🏛️ Alternative branches endpoint:`, JSON.stringify(branchListDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Alternative branches endpoint failed:`, error);
    }

    // Try groups endpoint
    try {
      groupDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}/groups`);
      console.log(`👥 User groups endpoint:`, JSON.stringify(groupDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Groups endpoint failed for ${user.user_id}:`, error);
    }

    // Try organizational units endpoint
    try {
      userOrgDetails = await this.apiRequest(`/manage/v1/orgchart/user/${user.user_id}`);
      console.log(`🏢 User org chart endpoint:`, JSON.stringify(userOrgDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Org chart endpoint failed for ${user.user_id}:`, error);
    }

    // Try manager/supervisor endpoint
    try {
      managerDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}/manager`);
      console.log(`👔 Manager endpoint:`, JSON.stringify(managerDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Manager endpoint failed:`, error);
    }

    // Try alternative group/branch lookups
    let alternativeGroups = null;
    try {
      // Sometimes groups are in a different endpoint
      alternativeGroups = await this.apiRequest('/manage/v1/group', {
        user_id: user.user_id
      });
      console.log(`👥 Alternative groups search:`, JSON.stringify(alternativeGroups, null, 2));
    } catch (error) {
      console.log(`⚠️ Alternative groups search failed:`, error);
    }

    // Try to get all branches and filter by user
    let allBranches = null;
    try {
      allBranches = await this.apiRequest('/manage/v1/branches');
      console.log(`🏛️ All branches endpoint:`, JSON.stringify(allBranches, null, 2));
    } catch (error) {
      console.log(`⚠️ All branches endpoint failed:`, error);
    }

    // Merge data from all sources
    const mergedUser = additionalDetails?.data || user;

    // Map user level to readable format
    const getUserLevel = (level: any): string => {
      if (!level) return 'Not specified';
      
      const levelStr = level.toString().toLowerCase();
      const levelNum = parseInt(level);
      
      // Map common Docebo levels
      switch (levelNum) {
        case 1:
        case 1024:
          return 'Superadmin';
        case 4:
        case 256:
          return 'Power User';
        case 6:
        case 64:
          return 'User Manager';
        case 7:
        case 32:
          return 'User';
        default:
          // Check string-based levels
          if (levelStr.includes('admin') || levelStr.includes('super')) return 'Superadmin';
          if (levelStr.includes('power')) return 'Power User';
          if (levelStr.includes('manager')) return 'User Manager';
          if (levelStr.includes('user')) return 'User';
          return `Level ${level}`;
      }
    };

    // Extract branches from all possible sources with enhanced logic
    const extractBranches = (): string => {
      // Check if branches array exists and has data
      const branches = mergedUser.branches || user.branches || [];
      if (branches.length > 0) {
        const branchNames = branches.map((b: any) => b.name || b.branch_name || b.title || JSON.stringify(b)).join(', ');
        console.log(`🏛️ Found branches from branches array:`, branchNames);
        return branchNames;
      }
      
      // Check custom fields for organizational information
      const additionalFields = mergedUser.additional_fields || [];
      const orgFields = [];
      
      // Look for organization-related fields
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
        const orgInfo = orgFields.join(' | ');
        console.log(`🏛️ Found organizational info from custom fields:`, orgInfo);
        return orgInfo;
      }
      
      // Fallback to direct field values if custom fields not available
      const fallbackFields = [
        user.field_4, // Organization Name (GBO)
        user.field_5, // Team (Go to Market Operations)
        user.field_1  // Job Role
      ].filter(Boolean);
      
      if (fallbackFields.length > 0) {
        const fallbackInfo = fallbackFields.join(' | ');
        console.log(`🏛️ Found organizational info from direct fields:`, fallbackInfo);
        return fallbackInfo;
      }
      
      return 'None assigned';
    };

    // Extract direct manager information with enhanced logic
    const extractManager = (): string => {
      // Check managers array first (most reliable)
      const managers = user.managers || mergedUser.managers || [];
      if (managers.length > 0) {
        // Find direct manager (type_id 1) or take first manager
        const directManager = managers.find((m: any) => m.manager_type_id === 1) || managers[0];
        if (directManager && directManager.manager_name) {
          console.log(`👔 Found direct manager from managers array:`, directManager.manager_name);
          return directManager.manager_name;
        }
      }
      
      // Check manager_names object
      const managerNames = user.manager_names || mergedUser.manager_names || {};
      if (managerNames['1'] && managerNames['1'].manager_name) {
        console.log(`👔 Found manager from manager_names object:`, managerNames['1'].manager_name);
        return managerNames['1'].manager_name;
      }
      
      // Check individual manager fields from detailed user data
      const managerFields = [
        mergedUser.manager_first_name && mergedUser.manager_last_name ? 
          `${mergedUser.manager_first_name} ${mergedUser.manager_last_name}` : null,
        mergedUser.manager_name,
        user.manager_name
      ].filter(Boolean);
      
      if (managerFields.length > 0) {
        console.log(`👔 Found manager from individual fields:`, managerFields[0]);
        return managerFields[0];
      }
      
      return 'Not assigned';
    };

    // Extract groups from all possible sources  
    const extractGroups = (): string => {
      const sources = [
        groupDetails?.data?.items,
        groupDetails?.data,
        alternativeGroups?.data?.items,
        userOrgDetails?.data?.groups,
        mergedUser.groups,
        user.groups,
        mergedUser.group,
        user.group,
        user.group_name,
        mergedUser.group_name
      ];
      
      console.log(`👥 Checking group sources:`, sources.map(s => s ? (Array.isArray(s) ? `Array(${s.length})` : typeof s) : 'null'));
      
      for (const source of sources) {
        try {
          if (Array.isArray(source) && source.length > 0) {
            const result = source.map((g: any) => {
              if (typeof g === 'string') return g;
              if (g && typeof g === 'object') {
                return g.name || g.group_name || g.title || g.description || JSON.stringify(g);
              }
              return String(g);
            }).filter(Boolean).join(', ');
            console.log(`👥 Found groups from array:`, result);
            return result;
          }
          if (source && typeof source === 'object' && !Array.isArray(source)) {
            const result = source.name || source.group_name || source.title || JSON.stringify(source);
            console.log(`👥 Found groups from object:`, result);
            return result;
          }
          if (typeof source === 'string' && source.trim()) {
            console.log(`👥 Found groups from string:`, source);
            return source;
          }
        } catch (error) {
          console.log(`⚠️ Error processing group source:`, error);
          continue;
        }
      }
      return 'None assigned';
    };

    const branches = extractBranches();
    const groups = extractGroups();
    const manager = extractManager();

    return {
      id: user.user_id || user.id,
      fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Not available',
      email: user.email,
      username: user.username || 'Not available',
      status: user.status === '1' ? 'Active' : user.status === '0' ? 'Inactive' : `Status: ${user.status}`,
      level: getUserLevel(user.level || mergedUser.level),
      
      // Use improved extraction methods
      branches: branches,
      groups: groups,
      manager: manager,
      
      // Try multiple date field formats
      creationDate: user.register_date || user.creation_date || user.created_at || mergedUser.register_date || 'Not available',
      lastAccess: user.last_access_date || user.last_access || user.last_login || mergedUser.last_access_date || 'Not available',
      
      timezone: user.timezone || mergedUser.timezone || 'Not specified',
      language: user.language || user.lang_code || mergedUser.language || 'Not specified',
      
      // Additional fields that might be available
      department: user.department || mergedUser.department || userOrgDetails?.data?.department || 'Not specified',
      
      // Enhanced debug info to see all available data
      debug: {
        userFields: Object.keys(user),
        additionalFields: additionalDetails?.data ? Object.keys(additionalDetails.data) : [],
        branchApiCalled: branchDetails ? 'Success' : 'Failed',
        groupApiCalled: groupDetails ? 'Success' : 'Failed',
        orgChartApiCalled: userOrgDetails ? 'Success' : 'Failed',
        managerApiCalled: managerDetails ? 'Success' : 'Failed',
        alternativeGroupsApiCalled: alternativeGroups ? 'Success' : 'Failed',
        branchListApiCalled: branchListDetails ? 'Success' : 'Failed',
        allBranchesApiCalled: allBranches ? 'Success' : 'Failed',
        rawBranchData: branchDetails?.data || null,
        rawGroupData: groupDetails?.data || null,
        rawOrgData: userOrgDetails?.data || null,
        rawManagerData: managerDetails?.data || null,
        rawAlternativeGroups: alternativeGroups?.data || null,
        rawBranchList: branchListDetails?.data || null,
        // Show fields that might contain branch/manager info
        branchFields: Object.keys(user).filter(k => k.toLowerCase().includes('branch')),
        managerFields: Object.keys(user).filter(k => k.toLowerCase().includes('manager') || k.toLowerCase().includes('supervisor')),
        userFieldSample: Object.fromEntries(
          Object.entries(user).slice(0, 10).map(([k, v]) => [k, typeof v === 'object' ? '[object]' : v])
        )
      }
    };
  }

  async getCourseDetails(courseName: string): Promise<any> {
    console.log(`🔍 Searching for course: ${courseName}`);
    
    // Try multiple search approaches
    let course = null;
    let allCourseData = [];
    
    // Method 1: /course/v1/courses
    try {
      const courses1 = await this.apiRequest('/course/v1/courses', {
        search_text: courseName,
        page_size: 20
      });
      
      console.log(`📚 Method 1 (/course/v1/courses) found ${courses1.data?.items?.length || 0} courses`);
      if (courses1.data?.items?.length > 0) {
        console.log(`📋 Sample course data:`, JSON.stringify(courses1.data.items[0], null, 2));
        allCourseData.push(...courses1.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Method 1 failed:`, error);
    }
    
    // Method 2: /learn/v1/courses  
    try {
      const courses2 = await this.apiRequest('/learn/v1/courses', {
        search_text: courseName,
        page_size: 20
      });
      
      console.log(`📚 Method 2 (/learn/v1/courses) found ${courses2.data?.items?.length || 0} courses`);
      if (courses2.data?.items?.length > 0) {
        console.log(`📋 Sample course data:`, JSON.stringify(courses2.data.items[0], null, 2));
        allCourseData.push(...courses2.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Method 2 failed:`, error);
    }
    
    // Method 3: /manage/v1/courses (if it exists)
    try {
      const courses3 = await this.apiRequest('/manage/v1/courses', {
        search_text: courseName,
        page_size: 20
      });
      
      console.log(`📚 Method 3 (/manage/v1/courses) found ${courses3.data?.items?.length || 0} courses`);
      if (courses3.data?.items?.length > 0) {
        console.log(`📋 Sample course data:`, JSON.stringify(courses3.data.items[0], null, 2));
        allCourseData.push(...courses3.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Method 3 failed:`, error);
    }
    
    // Find best matching course from all results
    for (const courseList of [allCourseData]) {
      // Try exact match first
      course = courseList.find((c: any) => {
        const cName = (c.course_name || c.name || c.title || '').toLowerCase();
        return cName === courseName.toLowerCase();
      });
      
      // Then try partial match
      if (!course) {
        course = courseList.find((c: any) => {
          const cName = (c.course_name || c.name || c.title || '').toLowerCase();
          return cName.includes(courseName.toLowerCase()) || courseName.toLowerCase().includes(cName);
        });
      }
      
      if (course) break;
    }
    
    if (!course) {
      throw new Error(`Course not found: ${courseName}. Searched ${allCourseData.length} total courses.`);
    }

    console.log(`✅ Found course:`, JSON.stringify(course, null, 2));

    // Try to get detailed course information using course ID
    let detailedCourse = null;
    const courseId = course.id || course.course_id || course.idCourse;
    
    if (courseId) {
      // Try multiple endpoints for detailed info
      const detailEndpoints = [
        `/course/v1/courses/${courseId}`,
        `/learn/v1/courses/${courseId}`,
        `/manage/v1/courses/${courseId}`,
        `/course/v1/courses/${courseId}/info`,
        `/learn/v1/courses/${courseId}/info`
      ];
      
      for (const endpoint of detailEndpoints) {
        try {
          console.log(`🔍 Trying detailed endpoint: ${endpoint}`);
          detailedCourse = await this.apiRequest(endpoint);
          console.log(`✅ Got detailed data from ${endpoint}:`, JSON.stringify(detailedCourse, null, 2));
          break;
        } catch (error) {
          console.log(`⚠️ ${endpoint} failed:`, error);
        }
      }
    }

    // Extract all available fields with better mapping
    const extractField = (fieldName: string, possibleKeys: string[] = []): string => {
      const sources = [detailedCourse?.data, course];
      const allKeys = [
        fieldName,
        ...possibleKeys,
        fieldName.toLowerCase(),
        fieldName.replace(/_/g, ''),
        `course_${fieldName}`,
        `${fieldName}_name`
      ];
      
      for (const source of sources) {
        if (!source) continue;
        for (const key of allKeys) {
          const value = source[key];
          if (value !== undefined && value !== null && value !== '') {
            // Handle object values (like category or user objects)
            if (typeof value === 'object' && value.name) {
              return String(value.name);
            }
            if (typeof value === 'object' && value.title) {
              return String(value.title);
            }
            if (typeof value === 'object' && value.fullname) {
              return String(value.fullname);
            }
            if (typeof value === 'object' && value.username) {
              return String(value.username);
            }
            if (typeof value === 'object' && value.id) {
              // For user objects, try to get name or fallback to ID
              const userName = value.fullname || value.name || value.username || `User ID: ${value.id}`;
              return String(userName);
            }
            if (typeof value === 'object') {
              // Try to extract meaningful info from object
              const objStr = JSON.stringify(value);
              if (objStr.includes('fullname')) {
                try {
                  const parsed = JSON.parse(objStr);
                  return parsed.fullname || parsed.name || parsed.username || objStr;
                } catch {
                  return objStr;
                }
              }
              return objStr;
            }
            return String(value);
          }
        }
      }
      return 'Not available';
    };

    // Get all available field names for debugging
    const availableFields = new Set();
    [course, detailedCourse?.data].forEach(obj => {
      if (obj) Object.keys(obj).forEach(key => availableFields.add(key));
    });

    return {
      id: courseId || 'Not available',
      name: course.title || course.course_name || course.name || 'Unknown Course',
      description: extractField('description'),
      type: extractField('type', ['course_type', 'content_type', 'learning_object_type']),
      status: extractField('status', ['course_status', 'publication_status']),
      language: extractField('language', ['lang_code', 'default_language', 'course_language']),
      credits: extractField('credits', ['credit_hours', 'points']),
      duration: extractField('duration', ['mediumTime', 'estimated_duration', 'average_completion_time', 'time_estimation']),
      category: extractField('category', ['category_name', 'course_category']),
      creationDate: extractField('created', ['date_creation', 'created_at', 'creation_date', 'date_begin', 'created_on']),
      modificationDate: extractField('modified', ['last_update', 'updated_on', 'date_modification', 'modification_date']),
      createdBy: extractField('created_by', ['creator', 'author', 'created_by_name', 'creator_name', 'created_by_username', 'author_name', 'instructor']),
      lastUpdatedBy: extractField('updated_by', ['modified_by', 'last_updated_by', 'updated_by_name', 'modified_by_name', 'last_modified_by', 'updated_by_username']),
      code: extractField('code', ['course_code', 'sku']),
      level: extractField('level', ['difficulty_level', 'course_level']),
      price: extractField('price', ['cost', 'fee']),
      instructor: extractField('instructor', ['instructor_name', 'author', 'creator']),
      enrollments: extractField('enrollments', ['enrolled_count', 'enrolled_users', 'user_count']),
      rating: (() => {
        const rating = extractField('rating', ['average_rating', 'score']);
        try {
          const ratingObj = JSON.parse(rating);
          if (ratingObj.enabled === false) return 'Not enabled';
          return rating;
        } catch {
          return rating;
        }
      })(),
      // Additional fields that might be interesting
      certificate: extractField('certificate', ['has_certificate', 'certification']),
      // Debug information  
      debug: {
        foundFields: Array.from(availableFields).sort(),
        courseId: courseId,
        detailEndpointUsed: detailedCourse ? 'Success' : 'Failed',
        totalFieldsAvailable: availableFields.size,
        rawCourseKeys: Object.keys(course),
        rawDetailedKeys: detailedCourse?.data ? Object.keys(detailedCourse.data) : [],
        // Show first few raw values for debugging
        sampleData: Object.fromEntries(
          Object.entries(course).slice(0, 5).map(([k, v]) => [k, typeof v === 'object' ? '[object]' : v])
        )
      }
    };
  }

  async getLearningPlanDetails(lpName: string): Promise<any> {
    console.log(`🔍 Searching for learning plan: ${lpName}`);
    
    // Try multiple search approaches
    let learningPlan = null;
    let allLPData = [];
    
    // Method 1: /learn/v1/learningplans
    try {
      const lps1 = await this.apiRequest('/learn/v1/learningplans', {
        search_text: lpName,
        page_size: 20
      });
      
      if (lps1.data?.items?.length > 0) {
        allLPData.push(...lps1.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Learning plans search failed:`, error);
    }
    
    // Find best matching learning plan
    learningPlan = allLPData.find((lp: any) => {
      const lpTitle = (lp.title || lp.name || lp.learning_plan_name || '').toLowerCase();
      return lpTitle === lpName.toLowerCase();
    });
    
    if (!learningPlan) {
      learningPlan = allLPData.find((lp: any) => {
        const lpTitle = (lp.title || lp.name || lp.learning_plan_name || '').toLowerCase();
        return lpTitle.includes(lpName.toLowerCase()) || lpName.toLowerCase().includes(lpTitle);
      });
    }
    
    if (!learningPlan) {
      throw new Error(`Learning plan not found: ${lpName}. Searched ${allLPData.length} total learning plans.`);
    }

    const lpId = learningPlan.id || learningPlan.learning_plan_id || learningPlan.idLearningPlan;
    
    // Try to get detailed info
    let detailedLP = null;
    if (lpId) {
      try {
        detailedLP = await this.apiRequest(`/learn/v1/learningplans/${lpId}`);
      } catch (error) {
        console.log(`⚠️ Detailed LP endpoint failed:`, error);
      }
    }

    const extractLPField = (fieldName: string, possibleKeys: string[] = []): string => {
      const sources = [detailedLP?.data, learningPlan];
      const allKeys = [fieldName, ...possibleKeys];
      
      for (const source of sources) {
        if (!source) continue;
        for (const key of allKeys) {
          const value = source[key];
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'object' && value.fullname) return String(value.fullname);
            if (typeof value === 'object' && value.name) return String(value.name);
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          }
        }
      }
      return 'Not available';
    };

    return {
      id: lpId || 'Not available',
      name: learningPlan.title || learningPlan.name || learningPlan.learning_plan_name || 'Unknown Learning Plan',
      description: extractLPField('description'),
      status: extractLPField('status', ['learning_plan_status', 'publication_status']),
      language: extractLPField('language', ['lang_code', 'default_language']),
      credits: extractLPField('credits', ['credit_hours', 'points']),
      duration: extractLPField('duration', ['estimated_duration', 'average_completion_time']),
      category: extractLPField('category', ['category_name']),
      creationDate: extractLPField('created', ['date_creation', 'created_at', 'creation_date']),
      modificationDate: extractLPField('modified', ['last_update', 'updated_on', 'modification_date']),
      createdBy: extractLPField('created_by', ['creator', 'author', 'created_by_name']),
      lastUpdatedBy: extractLPField('updated_by', ['modified_by', 'last_updated_by']),
      enrollments: extractLPField('enrollments', ['enrolled_count', 'enrolled_users']),
      courses: extractLPField('courses', ['course_count', 'total_courses']),
      type: extractLPField('type', ['learning_plan_type'])
    };
  }

  async getSessionDetails(sessionName: string): Promise<any> {
    console.log(`🔍 Searching for session: ${sessionName}`);
    
    let session = null;
    let allSessionData = [];
    
    // Try multiple endpoints
    const endpoints = ['/course/v1/sessions', '/learn/v1/sessions'];
    
    for (const endpoint of endpoints) {
      try {
        const sessions = await this.apiRequest(endpoint, {
          search_text: sessionName,
          page_size: 20
        });
        
        if (sessions.data?.items?.length > 0) {
          allSessionData.push(...sessions.data.items);
        }
      } catch (error) {
        console.log(`⚠️ Session endpoint ${endpoint} failed:`, error);
      }
    }
    
    // Find best matching session
    session = allSessionData.find((s: any) => {
      const sName = (s.name || s.session_name || s.title || '').toLowerCase();
      return sName === sessionName.toLowerCase();
    });
    
    if (!session) {
      session = allSessionData.find((s: any) => {
        const sName = (s.name || s.session_name || s.title || '').toLowerCase();
        return sName.includes(sessionName.toLowerCase()) || sessionName.toLowerCase().includes(sName);
      });
    }
    
    if (!session) {
      throw new Error(`Session not found: ${sessionName}. Searched ${allSessionData.length} total sessions.`);
    }

    const extractSessionField = (fieldName: string, possibleKeys: string[] = []): string => {
      const allKeys = [fieldName, ...possibleKeys];
      for (const key of allKeys) {
        const value = session[key];
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
      id: session.id || session.session_id || 'Not available',
      name: session.name || session.session_name || session.title || 'Unknown Session',
      description: extractSessionField('description'),
      startDate: extractSessionField('start_date', ['date_begin', 'start_time']),
      endDate: extractSessionField('end_date', ['date_end', 'end_time']),
      location: extractSessionField('location', ['venue', 'place']),
      instructor: extractSessionField('instructor', ['instructor_name', 'teacher']),
      capacity: extractSessionField('capacity', ['max_participants', 'seats']),
      enrolled: extractSessionField('enrolled', ['enrolled_count', 'participants']),
      status: extractSessionField('status', ['session_status']),
      course: extractSessionField('course', ['course_name', 'course_title']),
      timezone: extractSessionField('timezone', ['time_zone'])
    };
  }

  async getTrainingMaterialDetails(materialName: string): Promise<any> {
    console.log(`🔍 Searching for training material: ${materialName}`);
    
    let material = null;
    let allMaterialData = [];
    
    // Try multiple endpoints
    const endpoints = ['/learn/v1/materials', '/learn/v1/lo', '/course/v1/materials'];
    
    for (const endpoint of endpoints) {
      try {
        const materials = await this.apiRequest(endpoint, {
          search_text: materialName,
          page_size: 20
        });
        
        if (materials.data?.items?.length > 0) {
          allMaterialData.push(...materials.data.items);
        }
      } catch (error) {
        console.log(`⚠️ Material endpoint ${endpoint} failed:`, error);
      }
    }
    
    // Find best matching material
    material = allMaterialData.find((m: any) => {
      const mName = (m.title || m.name || m.material_name || '').toLowerCase();
      return mName === materialName.toLowerCase();
    });
    
    if (!material) {
      material = allMaterialData.find((m: any) => {
        const mName = (m.title || m.name || m.material_name || '').toLowerCase();
        return mName.includes(materialName.toLowerCase()) || materialName.toLowerCase().includes(mName);
      });
    }
    
    if (!material) {
      throw new Error(`Training material not found: ${materialName}. Searched ${allMaterialData.length} total materials.`);
    }

    const extractMaterialField = (fieldName: string, possibleKeys: string[] = []): string => {
      const allKeys = [fieldName, ...possibleKeys];
      for (const key of allKeys) {
        const value = material[key];
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
      id: material.id || material.material_id || 'Not available',
      name: material.title || material.name || material.material_name || 'Unknown Material',
      description: extractMaterialField('description'),
      type: extractMaterialField('type', ['material_type', 'content_type']),
      format: extractMaterialField('format', ['file_format', 'mime_type']),
      size: extractMaterialField('size', ['file_size', 'filesize']),
      duration: extractMaterialField('duration', ['length', 'time']),
      language: extractMaterialField('language', ['lang_code']),
      creationDate: extractMaterialField('created', ['date_creation', 'created_at']),
      modificationDate: extractMaterialField('modified', ['last_update', 'updated_on']),
      createdBy: extractMaterialField('created_by', ['creator', 'author']),
      lastUpdatedBy: extractMaterialField('updated_by', ['modified_by']),
      course: extractMaterialField('course', ['course_name', 'parent_course']),
      downloads: extractMaterialField('downloads', ['download_count']),
      status: extractMaterialField('status', ['material_status', 'publication_status'])
    };
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
    const learningPlan = extractLearningPlan(message);
    const session = extractSession(message);
    const trainingMaterial = extractTrainingMaterial(message);
    const searchCacheKey = extractSearchCacheKey(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}, LP: ${learningPlan}, Session: ${session}, Material: ${trainingMaterial}, SearchCache: ${searchCacheKey}`);
    console.log(`🔍 Pattern matching - userQuestion: ${PATTERNS.userQuestion(message)}, searchUsers: ${PATTERNS.searchUsers(message)}, showAllResults: ${PATTERNS.showAllResults(message)}`);
    
    // 1. SHOW ALL SEARCH RESULTS
    if (PATTERNS.showAllResults(message) && searchCacheKey) {
      console.log(`📋 Show all results request for: ${searchCacheKey}`);
      
      const cachedSearch = searchCache.get(searchCacheKey);
      if (!cachedSearch) {
        return NextResponse.json({
          response: `❌ **Search Results Expired**: The search results are no longer available.

Please run your search again to get fresh results.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const { results, searchTerm, searchType } = cachedSearch;
      
      if (searchType === 'courses') {
        const courseList = results.map((course: any, i: number) => {
          const courseName = api.getCourseName(course);
          const courseId = api.getCourseId(course);
          const status = course.status || course.course_status || 'Unknown';
          const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
          return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId}) - *${status}*`;
        }).join('\n');
        
        return NextResponse.json({
          response: `📚 **All Course Search Results**: "${searchTerm}" (${results.length} total)

${courseList}

💡 **Get Details**: "Course info [course name]" for detailed information`,
          success: true,
          totalCount: results.length,
          showingAll: true,
          timestamp: new Date().toISOString()
        });
      } else if (searchType === 'users') {
        const userList = results.map((user: any, i: number) => {
          const statusIcon = user.status === '1' ? '✅' : '❌';
          return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
        }).join('\n');
        
        return NextResponse.json({
          response: `👥 **All User Search Results**: "${searchTerm}" (${results.length} total)

${userList}

💡 **Get Details**: "User info [email]" or "Find user [email]" for detailed information`,
          success: true,
          totalCount: results.length,
          showingAll: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 2. FLEXIBLE USER QUESTIONS (Check this first before other patterns)
    if (PATTERNS.userQuestion(message)) {
      console.log(`💬 User question detected: ${message}`);
      
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to answer questions about a user.

**Examples**: 
- "What is john@company.com's last login?"
- "When did sarah@test.com join?"
- "Is mike@company.com active?"`,
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
        } else if (question.includes('when') && (question.includes('join') || question.includes('creat'))) {
          answer = `📅 **Account Created**: ${userDetails.creationDate}`;
        } else if (question.includes('status') || question.includes('active') || question.includes('inactive')) {
          answer = `📊 **Status**: ${userDetails.status}`;
        } else if (question.includes('level') || question.includes('role') || question.includes('permission')) {
          answer = `🏢 **Level**: ${userDetails.level}`;
        } else if (question.includes('branch') || question.includes('department')) {
          answer = `🏛️ **Branches**: ${userDetails.branches}\n🏛️ **Department**: ${userDetails.department}`;
        } else if (question.includes('group')) {
          answer = `👥 **Groups**: ${userDetails.groups}`;
        } else if (question.includes('manager') || question.includes('supervisor') || question.includes('reports to')) {
          answer = `👔 **Manager**: ${userDetails.manager}`;
        } else if (question.includes('language') || question.includes('timezone')) {
          answer = `🌍 **Language**: ${userDetails.language}\n🕐 **Timezone**: ${userDetails.timezone}`;
        } else if (question.includes('email') || question.includes('contact')) {
          answer = `📧 **Email**: ${userDetails.email}\n👤 **Username**: ${userDetails.username}`;
        } else {
          // General fallback - provide relevant info based on keywords
          answer = `👤 **${userDetails.fullname}** - Quick Info:
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}`;
        }
        
        return NextResponse.json({
          response: `💬 **Question About**: ${userDetails.fullname}

${answer}

💡 **More Questions**: 
- "What is ${email}'s status?"
- "When did ${email} last login?"
- "What level is ${email}?"
- "What groups is ${email} in?"`,
          success: true,
          userDetails: userDetails,
          questionAnswered: true,
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
    
    // 3. USER SEARCH (Enhanced with auto user details for email searches)
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
🏛️ **Department**: ${userDetails.department}

### 🌍 **Preferences**
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}

### 📅 **Activity**
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}

### 👥 **Organization**
🏛️ **Branches**: ${userDetails.branches}
👥 **Groups**: ${userDetails.groups}
👔 **Manager**: ${userDetails.manager}

💡 **Admin Complete**: All available user information retrieved!
💬 **Ask More**: "What is ${userDetails.email}'s last login?" or "When did ${userDetails.email} join?"`,
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
    
    // 4. COURSE SEARCH  
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
        const status = course.status || course.course_status || 'Unknown';
        const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
        return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId}) - *${status}*`;
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
    
    // 5. USER DETAILS
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
🏛️ **Department**: ${userDetails.department}
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}
🏛️ **Branches**: ${userDetails.branches}
👥 **Groups**: ${userDetails.groups}
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
    
    // 6. COURSE DETAILS
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
📝 **Code**: ${courseDetails.code}
📖 **Type**: ${courseDetails.type}
📊 **Status**: ${courseDetails.status}
🌍 **Language**: ${courseDetails.language}
🏆 **Credits**: ${courseDetails.credits}
⏱️ **Duration**: ${courseDetails.duration !== 'Not available' ? `${courseDetails.duration} minutes` : courseDetails.duration}
📂 **Category**: ${courseDetails.category}
👥 **Enrolled**: ${courseDetails.enrollments}
⭐ **Rating**: ${courseDetails.rating}
🏆 **Certificate**: ${courseDetails.certificate}
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
  - **Email searches**: Get complete user details automatically
  - **Name searches**: Shows list of matching users
• **User details**: "User info sarah@test.com"
  - Complete profile, status, manager, organization

## 📚 **Courses**
• **Find courses**: "Find Python courses"
• **Course details**: "Course info Python Programming"
  - Complete course information with creator details

## 📚 **Learning Plans**
• **Find learning plans**: "Find Python learning plans"
• **Learning plan details**: "Learning plan info Python Fundamentals"
  - Complete learning path information

## 🎯 **Sessions**
• **Find sessions**: "Find Python sessions"  
• **Session details**: "Session info Python Workshop"
  - Instructor, schedule, location details

## 📄 **Training Materials**
• **Find materials**: "Find Python training materials"
• **Material details**: "Material info Python Guide"
  - File details, format, downloads

## 📖 **Docebo Help & Guidance**
• **How-to questions**: "How to enroll users in Docebo"
• **Feature explanations**: "What is a learning plan in Docebo"
• **Configuration help**: "How to set up notifications"
• **Best practices**: "How to organize users in branches"
• **Troubleshooting**: "How to fix enrollment issues"

**Your message**: "${message}"

**Examples:**
- "Find user pulkitmalhotra@gmail.com"
- "Course info Release Course Testing"
- "How to create courses in Docebo"
- "How to set up user branches"
- "What are learning plans in Docebo"

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
