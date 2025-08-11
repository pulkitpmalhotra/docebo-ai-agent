// app/api/chat-enhanced/route.ts - Fixed compilation issues
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple interfaces for the enhanced chat
interface ChatRequest {
  message: string;
  userRole?: string;
  userId?: string;
}

interface ChatResponse {
  response: string;
  intent: string;
  success: boolean;
  data?: any;
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary';
    action: string;
  }>;
  suggestions?: string[];
  meta: {
    processing_time: number;
    timestamp: string;
    functions_called: string[];
  };
}

// Enhanced Docebo API client (simplified for compilation)
class DoceboAPIClient {
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

  private async apiRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, params?: any): Promise<any> {
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

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // Core API methods
  async searchUsers(searchText: string, limit: number = 25): Promise<any[]> {
    try {
      const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      return result.data?.items || [];
    } catch (error) {
      console.error('Search users failed:', error);
      return [];
    }
  }

  async searchCourses(searchText: string, limit: number = 25): Promise<any[]> {
    try {
      const result = await this.apiRequest('/learn/v1/courses', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      return result.data?.items || [];
    } catch (error) {
      console.error('Search courses failed:', error);
      return [];
    }
  }

  async getUserEnrollments(userId: string): Promise<any> {
    try {
      const result = await this.apiRequest(`/learn/v1/enrollments/users/${userId}`);
      return {
        courses: result.data?.items || [],
        total_enrollments: result.data?.items?.length || 0
      };
    } catch (error) {
      console.error('Get user enrollments failed:', error);
      return { courses: [], total_enrollments: 0 };
    }
  }

  async getCourseEnrollments(courseId: string): Promise<any> {
    try {
      const result = await this.apiRequest(`/learn/v1/enrollments/courses/${courseId}`);
      return {
        users: result.data?.items || [],
        total_enrolled: result.data?.items?.length || 0
      };
    } catch (error) {
      console.error('Get course enrollments failed:', error);
      return { users: [], total_enrolled: 0 };
    }
  }

  async enrollUser(userId: string, courseId: string, options: any = {}): Promise<any> {
    try {
      const enrollmentBody = {
        users: [userId],
        courses: [courseId],
        priority: options.priority || 'medium',
        due_date: options.due_date,
        enrollment_type: 'immediate'
      };

      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
      return { success: true, result: result.data };
    } catch (error) {
      console.error('Enroll user failed:', error);
      throw error;
    }
  }
}

// Enhanced chat processor
class EnhancedChatProcessor {
  private genAI: GoogleGenerativeAI;
  private doceboAPI: DoceboAPIClient;

  constructor(geminiApiKey: string, doceboConfig: any) {
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
    this.doceboAPI = new DoceboAPIClient(doceboConfig);
  }

  async processMessage(message: string, userRole: string): Promise<ChatResponse> {
    const startTime = Date.now();
    const functionsCalled: string[] = [];

    try {
      // Analyze intent
      const intent = await this.analyzeIntent(message);
      console.log(`Intent detected: ${intent.intent}`);

      // Execute based on intent
      let result: any = {};
      let success = true;

      switch (intent.intent) {
        case 'get_user_enrollments':
          functionsCalled.push('getUserEnrollments');
          result = await this.handleUserEnrollments(intent.entities);
          break;

        case 'get_course_enrollments':
          functionsCalled.push('getCourseEnrollments');
          result = await this.handleCourseEnrollments(intent.entities);
          break;

        case 'enroll_users':
          functionsCalled.push('enrollUsers');
          result = await this.handleEnrollUsers(intent.entities);
          break;

        case 'search_users':
          functionsCalled.push('searchUsers');
          result = await this.doceboAPI.searchUsers(intent.entities.query || intent.entities.user_identifier);
          break;

        case 'search_courses':
          functionsCalled.push('searchCourses');
          result = await this.doceboAPI.searchCourses(intent.entities.query || intent.entities.course_identifier);
          break;

        default:
          result = { message: "I can help you with enrollment management, user search, course search, and enrollment statistics. What would you like to do?" };
          intent.intent = 'help';
      }

      // Generate response
      const response = await this.generateResponse(intent, result, userRole);

      return {
        response,
        intent: intent.intent,
        success,
        data: result,
        actions: this.generateActions(intent.intent, userRole),
        suggestions: this.generateSuggestions(intent.intent, userRole),
        meta: {
          processing_time: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          functions_called: functionsCalled
        }
      };

    } catch (error) {
      console.error('Chat processing error:', error);
      return {
        response: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your request.`,
        intent: 'error',
        success: false,
        meta: {
          processing_time: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          functions_called: functionsCalled
        }
      };
    }
  }

  private async analyzeIntent(message: string): Promise<any> {
    const messageLower = message.toLowerCase();
    
    // Extract email if present
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    
    // Simple pattern matching for intents
    if (emailMatch) {
      if (messageLower.includes('enroll') && !messageLower.includes('unenroll')) {
        return {
          intent: 'enroll_users',
          entities: {
            users: [emailMatch[0]],
            courses: this.extractCourseNames(message)
          }
        };
      }
      
      if (messageLower.includes('enrolled') || messageLower.includes('enrollment')) {
        return {
          intent: 'get_user_enrollments',
          entities: { user_identifier: emailMatch[0] }
        };
      }
    }
    
    if (messageLower.includes('who is enrolled') || messageLower.includes('enrolled in')) {
      return {
        intent: 'get_course_enrollments',
        entities: { course_identifier: this.extractCourseNames(message)[0] }
      };
    }
    
    if (messageLower.includes('find') && messageLower.includes('user')) {
      return {
        intent: 'search_users',
        entities: { query: message.replace(/find|users?/gi, '').trim() }
      };
    }
    
    if (messageLower.includes('course') || messageLower.includes('training')) {
      return {
        intent: 'search_courses',
        entities: { query: message.replace(/search|courses?|find/gi, '').trim() }
      };
    }
    
    return {
      intent: 'help',
      entities: { topic: message }
    };
  }

  private extractCourseNames(message: string): string[] {
    // Extract course names from quotes or common patterns
    const quotedMatch = message.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return [quotedMatch[1]];
    }
    
    const courseMatch = message.match(/\b(?:course|training)[:\s]+([^,\n.!?]+)/i);
    if (courseMatch) {
      return [courseMatch[1].trim()];
    }
    
    // Common course keywords
    const keywords = ['python', 'javascript', 'excel', 'sql', 'leadership', 'management'];
    const found = keywords.filter(keyword => message.toLowerCase().includes(keyword));
    return found.length > 0 ? found : [''];
  }

  private async handleUserEnrollments(entities: any): Promise<any> {
    const userIdentifier = entities.user_identifier || entities.users?.[0];
    
    // Find user
    const users = await this.doceboAPI.searchUsers(userIdentifier, 5);
    const user = users.find((u: any) => 
      u.email?.toLowerCase() === userIdentifier.toLowerCase() ||
      u.fullname?.toLowerCase().includes(userIdentifier.toLowerCase())
    );
    
    if (!user) {
      throw new Error(`User not found: ${userIdentifier}`);
    }
    
    return await this.doceboAPI.getUserEnrollments(user.user_id);
  }

  private async handleCourseEnrollments(entities: any): Promise<any> {
    const courseIdentifier = entities.course_identifier || entities.courses?.[0];
    
    // Find course
    const courses = await this.doceboAPI.searchCourses(courseIdentifier, 5);
    const course = courses.find((c: any) => 
      c.course_name?.toLowerCase().includes(courseIdentifier.toLowerCase()) ||
      c.name?.toLowerCase().includes(courseIdentifier.toLowerCase())
    );
    
    if (!course) {
      throw new Error(`Course not found: ${courseIdentifier}`);
    }
    
    return await this.doceboAPI.getCourseEnrollments(course.course_id || course.idCourse);
  }

  private async handleEnrollUsers(entities: any): Promise<any> {
    const userIdentifier = entities.users?.[0];
    const courseIdentifier = entities.courses?.[0];
    
    if (!userIdentifier || !courseIdentifier) {
      throw new Error('Both user and course are required for enrollment');
    }
    
    // Find user and course
    const users = await this.doceboAPI.searchUsers(userIdentifier, 5);
    const user = users.find((u: any) => 
      u.email?.toLowerCase() === userIdentifier.toLowerCase() ||
      u.fullname?.toLowerCase().includes(userIdentifier.toLowerCase())
    );
    
    const courses = await this.doceboAPI.searchCourses(courseIdentifier, 5);
    const course = courses.find((c: any) => 
      c.course_name?.toLowerCase().includes(courseIdentifier.toLowerCase()) ||
      c.name?.toLowerCase().includes(courseIdentifier.toLowerCase())
    );
    
    if (!user) throw new Error(`User not found: ${userIdentifier}`);
    if (!course) throw new Error(`Course not found: ${courseIdentifier}`);
    
    return await this.doceboAPI.enrollUser(user.user_id, course.course_id || course.idCourse, {
      priority: entities.priority || 'medium',
      due_date: entities.due_date
    });
  }

  private async generateResponse(intent: any, result: any, userRole: string): Promise<string> {
    switch (intent.intent) {
      case 'get_user_enrollments':
        return `📚 **User Enrollments**: Found ${result.total_enrollments} total enrollments\n\n${result.courses.slice(0, 5).map((course: any) => `• ${course.course_name || course.name}`).join('\n')}`;
        
      case 'get_course_enrollments':
        return `👥 **Course Enrollments**: ${result.total_enrolled} users enrolled`;
        
      case 'enroll_users':
        return `✅ **Enrollment Successful**: User has been enrolled in the course.`;
        
      case 'search_users':
        return `👥 **User Search**: Found ${result.length} users\n\n${result.slice(0, 5).map((user: any) => `• ${user.fullname || user.first_name + ' ' + user.last_name} (${user.email})`).join('\n')}`;
        
      case 'search_courses':
        return `📚 **Course Search**: Found ${result.length} courses\n\n${result.slice(0, 5).map((course: any) => `• ${course.course_name || course.name}`).join('\n')}`;
        
      default:
        return "I can help you with:\n\n• **Check Enrollments**: \"Is john@company.com enrolled in Python course?\"\n• **Enroll Users**: \"Enroll sarah@test.com in Excel training\"\n• **Search**: \"Find users in marketing\" or \"Search Python courses\"\n• **View Course Enrollments**: \"Who is enrolled in Leadership Training?\"\n\nWhat would you like to do?";
    }
  }

  private generateActions(intent: string, userRole: string): Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> {
    const actions: Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> = [];
    
    if (userRole === 'superadmin') {
      actions.push(
        { id: 'enroll', label: 'Enroll Users', type: 'primary', action: 'enrollment_form' },
        { id: 'search', label: 'Search Users', type: 'secondary', action: 'user_search' }
      );
    } else if (userRole === 'power_user') {
      actions.push(
        { id: 'search', label: 'Search Courses', type: 'primary', action: 'course_search' }
      );
    }
    
    return actions;
  }

  private generateSuggestions(intent: string, userRole: string): string[] {
    const suggestions: Record<string, string[]> = {
      superadmin: [
        "Enroll john@company.com in Python Programming",
        "Who is enrolled in Leadership Training?",
        "Search for users in marketing department"
      ],
      power_user: [
        "Is sarah@test.com enrolled in Excel course?",
        "Search for JavaScript training courses",
        "Find users who completed SQL fundamentals"
      ],
      user_manager: [
        "Show my team's progress",
        "Find training for new employees"
      ],
      user: [
        "What courses am I enrolled in?",
        "Find Excel training courses"
      ]
    };
    
    return suggestions[userRole] || suggestions.user;
  }
}

// Role-based permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['get_user_enrollments', 'get_course_enrollments', 'enroll_users', 'search_users', 'search_courses'],
  power_user: ['get_user_enrollments', 'get_course_enrollments', 'search_users', 'search_courses'],
  user_manager: ['get_user_enrollments', 'search_users'],
  user: ['search_courses']
};

// Initialize the chat processor
const chatProcessor = new EnhancedChatProcessor(
  process.env.GOOGLE_GEMINI_API_KEY!,
  {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userRole = 'user', userId = 'anonymous' } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        error: 'Message is required and must be a string'
      }, { status: 400 });
    }

    // Basic security validation
    if (message.includes('<script>') || message.includes('javascript:')) {
      return NextResponse.json({
        error: 'Message contains potentially harmful content'
      }, { status: 400 });
    }

    console.log(`🤖 Processing: "${message}" for role: ${userRole}`);
    
    const result = await chatProcessor.processMessage(message, userRole);
    
    // Check permissions
    const allowedIntents = ROLE_PERMISSIONS[userRole] || [];
    if (result.intent && result.intent !== 'help' && result.intent !== 'error' && !allowedIntents.includes(result.intent)) {
      return NextResponse.json({
        response: `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to perform: ${result.intent}`,
        intent: 'permission_denied',
        success: false,
        meta: {
          processing_time: 0,
          timestamp: new Date().toISOString(),
          functions_called: []
        }
      });
    }
    
    console.log(`✅ Response generated: ${result.intent}`);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Chat error:', error);
    return NextResponse.json({
      response: 'I encountered an error processing your request. Please try again.',
      intent: 'error',
      success: false,
      meta: {
        timestamp: new Date().toISOString(),
        processing_time: 0,
        functions_called: []
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    name: 'Enhanced Docebo Chat API',
    version: '2.0.0',
    capabilities: [
      'Natural language enrollment management',
      'User and course search',
      'Enrollment status checking',
      'Role-based access control',
      'Real-time Docebo integration'
    ],
    examples: [
      "Is john@company.com enrolled in Python Programming?",
      "Enroll sarah@test.com in Excel course",
      "Who is enrolled in Leadership Training?",
      "Find users in marketing department",
      "Search for JavaScript courses"
    ],
    timestamp: new Date().toISOString()
  });
}
