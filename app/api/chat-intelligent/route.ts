// app/api/chat-intelligent/route.ts - Truly Scalable AI Chat
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Comprehensive Docebo API Client
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

  async apiCall(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any, params?: Record<string, any>): Promise<any> {
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
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  // Dynamic endpoint discovery based on what we find works
  async findWorkingEndpoint(endpointCandidates: string[], method: 'GET' | 'POST' = 'GET', body?: any): Promise<{ endpoint: string; data: any } | null> {
    for (const endpoint of endpointCandidates) {
      try {
        const data = await this.apiCall(endpoint, method, body);
        return { endpoint, data };
      } catch (error) {
        console.log(`Endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    return null;
  }
}

// AI-Powered Intent Analysis and Function Calling
class IntelligentChatProcessor {
  private genAI: GoogleGenerativeAI;
  private doceboAPI: DoceboAPIClient;

  constructor(geminiApiKey: string, doceboConfig: any) {
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
    this.doceboAPI = new DoceboAPIClient(doceboConfig);
  }

  async processMessage(message: string, userRole: string = 'user'): Promise<any> {
    try {
      // Step 1: Let AI analyze the intent and determine function calls
      const intentAnalysis = await this.analyzeIntentWithAI(message);
      
      // Step 2: Execute the determined functions
      const functionResults = await this.executeFunctions(intentAnalysis.functions);
      
      // Step 3: Let AI generate the final response based on results
      const finalResponse = await this.generateResponseWithAI(message, intentAnalysis, functionResults, userRole);
      
      return {
        response: finalResponse,
        intent: intentAnalysis.intent,
        functions_called: intentAnalysis.functions?.map((f: any) => f.name) || [],
        user_role: userRole,
        data: functionResults,
        meta: {
          processing_time: Date.now(),
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('Intelligent chat processing error:', error);
      return {
        response: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your question.`,
        intent: 'error',
        error: true,
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private async analyzeIntentWithAI(message: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
      },
    });

    const prompt = `You are an AI assistant for Docebo LMS. Analyze this user message and determine what functions to call.

User message: "${message}"

Available functions:
1. searchUsers(query: string, limit?: number) - Search for users by name, email, or ID
2. searchCourses(query: string, limit?: number) - Search for courses by name or keyword  
3. searchLearningPlans(query: string, limit?: number) - Search learning plans
4. getUserEnrollments(userIdentifier: string) - Get user's enrollments and progress
5. getCourseEnrollments(courseIdentifier: string) - Get who's enrolled in a course
6. enrollUser(userIdentifier: string, courseIdentifier: string, type?: string) - Enroll user in course/plan
7. batchEnroll(userIdentifiers: string[], courseIdentifiers: string[]) - Batch enroll multiple users
8. getEnrollmentStatus(userIdentifier: string, courseIdentifier: string) - Check specific enrollment status
9. getEnrollmentReports(type?: string, filters?: object) - Get enrollment reports and analytics
10. getCompletionData(type: string, identifier?: string) - Get completion rates and progress
11. searchSessions(query?: string) - Search ILT sessions
12. enrollInSession(userIdentifier: string, sessionIdentifier: string) - Enroll in ILT session

Respond with JSON in this exact format:
{
  "intent": "brief_description_of_what_user_wants",
  "functions": [
    {
      "name": "function_name",
      "parameters": { "param1": "value1", "param2": "value2" },
      "reason": "why this function is needed"
    }
  ],
  "requires_confirmation": false,
  "natural_language_summary": "What I understand you want to do"
}

Examples:
"Is John enrolled in Python course?" → searchUsers(John), searchCourses(Python), getEnrollmentStatus(john_id, python_course_id)
"Enroll all sales team in Leadership training" → searchUsers(sales), searchCourses(Leadership), batchEnroll(sales_users, leadership_course)
"Show me completion rates for all courses" → getCompletionData("courses")

Important: Extract specific identifiers (emails, names, course names) from the message. If user mentions specific people or courses by name, use those exact values.

JSON Response:`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Clean up the response and parse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No valid JSON found in AI response');
    } catch (error) {
      console.error('AI intent analysis failed:', error);
      // Fallback to simple pattern matching
      return this.fallbackIntentAnalysis(message);
    }
  }

  private fallbackIntentAnalysis(message: string): any {
    const messageLower = message.toLowerCase();
    
    // Extract email if present
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    
    if (messageLower.includes('enroll') && emailMatch) {
      return {
        intent: 'enroll_user',
        functions: [
          {
            name: 'enrollUser',
            parameters: { userIdentifier: emailMatch[0], courseIdentifier: 'course' },
            reason: 'User wants to enroll someone'
          }
        ]
      };
    }
    
    if (messageLower.includes('search') && messageLower.includes('user')) {
      return {
        intent: 'search_users',
        functions: [
          {
            name: 'searchUsers',
            parameters: { query: message.replace(/search|users?/gi, '').trim() },
            reason: 'User wants to find users'
          }
        ]
      };
    }
    
    if (messageLower.includes('course')) {
      return {
        intent: 'search_courses',
        functions: [
          {
            name: 'searchCourses',
            parameters: { query: message.replace(/search|courses?/gi, '').trim() },
            reason: 'User asking about courses'
          }
        ]
      };
    }
    
    if (messageLower.includes('report') || messageLower.includes('completion') || messageLower.includes('analytics')) {
      return {
        intent: 'get_reports',
        functions: [
          {
            name: 'getEnrollmentReports',
            parameters: { type: 'general' },
            reason: 'User wants reports or analytics'
          }
        ]
      };
    }
    
    return {
      intent: 'general_help',
      functions: [],
      natural_language_summary: 'I need more specific information to help you.'
    };
  }

  private async executeFunctions(functions: any[]): Promise<any> {
    const results: any = {};
    
    for (const func of functions) {
      try {
        console.log(`Executing function: ${func.name} with params:`, func.parameters);
        
        const result = await this.callDoceboFunction(func.name, func.parameters);
        results[func.name] = {
          success: true,
          data: result,
          parameters: func.parameters
        };
      } catch (error) {
        console.error(`Function ${func.name} failed:`, error);
        results[func.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          parameters: func.parameters
        };
      }
    }
    
    return results;
  }

  private async callDoceboFunction(functionName: string, params: any): Promise<any> {
    switch (functionName) {
      case 'searchUsers':
        return await this.searchUsers(params.query, params.limit);
        
      case 'searchCourses':
        return await this.searchCourses(params.query, params.limit);
        
      case 'searchLearningPlans':
        return await this.searchLearningPlans(params.query, params.limit);
        
      case 'getUserEnrollments':
        return await this.getUserEnrollments(params.userIdentifier);
        
      case 'getCourseEnrollments':
        return await this.getCourseEnrollments(params.courseIdentifier);
        
      case 'enrollUser':
        return await this.enrollUser(params.userIdentifier, params.courseIdentifier, params.type);
        
      case 'batchEnroll':
        return await this.batchEnroll(params.userIdentifiers, params.courseIdentifiers);
        
      case 'getEnrollmentStatus':
        return await this.getEnrollmentStatus(params.userIdentifier, params.courseIdentifier);
        
      case 'getEnrollmentReports':
        return await this.getEnrollmentReports(params.type, params.filters);
        
      case 'getCompletionData':
        return await this.getCompletionData(params.type, params.identifier);
        
      case 'searchSessions':
        return await this.searchSessions(params.query);
        
      case 'enrollInSession':
        return await this.enrollInSession(params.userIdentifier, params.sessionIdentifier);
        
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  // Docebo API Function Implementations
  private async searchUsers(query: string, limit: number = 25): Promise<any> {
    const endpoints = [
      '/manage/v1/user',
      '/learn/v1/users',
      '/api/v1/users'
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working user search endpoint found');
    
    // Try with search parameter
    try {
      const searchResult = await this.doceboAPI.apiCall(result.endpoint, 'GET', null, {
        search_text: query,
        page_size: limit
      });
      return searchResult;
    } catch {
      // Fallback to getting all users if search doesn't work
      const allUsers = await this.doceboAPI.apiCall(result.endpoint, 'GET', null, { page_size: limit });
      return allUsers;
    }
  }

  private async searchCourses(query: string, limit: number = 25): Promise<any> {
    const endpoints = [
      '/learn/v1/courses',
      '/manage/v1/courses',
      '/api/v1/courses'
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working course search endpoint found');
    
    try {
      const searchResult = await this.doceboAPI.apiCall(result.endpoint, 'GET', null, {
        search_text: query,
        page_size: limit
      });
      return searchResult;
    } catch {
      const allCourses = await this.doceboAPI.apiCall(result.endpoint, 'GET', null, { page_size: limit });
      return allCourses;
    }
  }

  private async searchLearningPlans(query: string, limit: number = 25): Promise<any> {
    const endpoints = [
      '/learn/v1/learningplans',
      '/learn/v1/learning-plans',
      '/manage/v1/learningplans',
      '/api/v1/learningplans'
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working learning plan endpoint found');
    
    try {
      return await this.doceboAPI.apiCall(result.endpoint, 'GET', null, {
        search_text: query,
        page_size: limit
      });
    } catch {
      return await this.doceboAPI.apiCall(result.endpoint, 'GET', null, { page_size: limit });
    }
  }

  private async getUserEnrollments(userIdentifier: string): Promise<any> {
    // First, resolve user identifier to user ID if needed
    let userId = userIdentifier;
    if (userIdentifier.includes('@') || isNaN(Number(userIdentifier))) {
      const users = await this.searchUsers(userIdentifier, 5);
      const user = users.data?.items?.find((u: any) => 
        u.email?.toLowerCase() === userIdentifier.toLowerCase() ||
        u.username?.toLowerCase() === userIdentifier.toLowerCase() ||
        u.fullname?.toLowerCase().includes(userIdentifier.toLowerCase())
      );
      if (!user) throw new Error(`User not found: ${userIdentifier}`);
      userId = user.user_id || user.id;
    }

    const endpoints = [
      `/learn/v1/enrollments/users/${userId}`,
      `/learn/v1/users/${userId}/enrollments`,
      `/manage/v1/users/${userId}/enrollments`,
      `/api/v1/users/${userId}/enrollments`,
      `/learn/v1/users/${userId}/progress`,
      `/analytics/v1/users/${userId}/enrollments`
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working user enrollment endpoint found');
    
    return result.data;
  }

  private async getCourseEnrollments(courseIdentifier: string): Promise<any> {
    // First, resolve course identifier to course ID if needed
    let courseId = courseIdentifier;
    if (isNaN(Number(courseIdentifier))) {
      const courses = await this.searchCourses(courseIdentifier, 5);
      const course = courses.data?.items?.find((c: any) => 
        c.name?.toLowerCase().includes(courseIdentifier.toLowerCase()) ||
        c.course_name?.toLowerCase().includes(courseIdentifier.toLowerCase()) ||
        c.code?.toLowerCase() === courseIdentifier.toLowerCase()
      );
      if (!course) throw new Error(`Course not found: ${courseIdentifier}`);
      courseId = course.idCourse || course.course_id || course.id;
    }

    const endpoints = [
      `/learn/v1/enrollments/courses/${courseId}`,
      `/learn/v1/courses/${courseId}/enrollments`,
      `/manage/v1/courses/${courseId}/enrollments`,
      `/api/v1/courses/${courseId}/enrollments`,
      `/analytics/v1/courses/${courseId}/enrollments`
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working course enrollment endpoint found');
    
    return result.data;
  }

  private async enrollUser(userIdentifier: string, courseIdentifier: string, type: string = 'immediate'): Promise<any> {
    // Resolve identifiers to IDs
    const users = await this.searchUsers(userIdentifier, 5);
    const user = users.data?.items?.find((u: any) => 
      u.email?.toLowerCase() === userIdentifier.toLowerCase() ||
      u.username?.toLowerCase() === userIdentifier.toLowerCase() ||
      u.fullname?.toLowerCase().includes(userIdentifier.toLowerCase())
    );
    if (!user) throw new Error(`User not found: ${userIdentifier}`);
    
    const courses = await this.searchCourses(courseIdentifier, 5);
    const course = courses.data?.items?.find((c: any) => 
      c.name?.toLowerCase().includes(courseIdentifier.toLowerCase()) ||
      c.course_name?.toLowerCase().includes(courseIdentifier.toLowerCase())
    );
    if (!course) throw new Error(`Course not found: ${courseIdentifier}`);

    const userId = user.user_id || user.id;
    const courseId = course.idCourse || course.course_id || course.id;

    // Try multiple enrollment body formats
    const bodyFormats = [
      { users: [userId], courses: [courseId] },
      { user_id: userId, course_id: courseId },
      { userId: userId, courseId: courseId },
      { user: userId, course: courseId },
      { enrollments: [{ user_id: userId, course_id: courseId, enrollment_date: new Date().toISOString() }] }
    ];

    const endpoints = [
      '/learn/v1/enrollments',
      '/manage/v1/enrollments',
      '/api/v1/enrollments',
      `/learn/v1/courses/${courseId}/enrollments`,
      `/learn/v1/users/${userId}/enrollments`,
      '/enroll/v1/users'
    ];

    for (const endpoint of endpoints) {
      for (const body of bodyFormats) {
        try {
          const result = await this.doceboAPI.apiCall(endpoint, 'POST', body);
          return { success: true, result, user, course, endpoint_used: endpoint, body_format: body };
        } catch (error) {
          console.log(`Enrollment attempt failed: ${endpoint}`, error);
          continue;
        }
      }
    }

    throw new Error('All enrollment methods failed. User may already be enrolled or lack permissions.');
  }

  private async batchEnroll(userIdentifiers: string[], courseIdentifiers: string[]): Promise<any> {
    // This is a complex operation - for now, do individual enrollments
    const results = [];
    for (const userId of userIdentifiers) {
      for (const courseId of courseIdentifiers) {
        try {
          const result = await this.enrollUser(userId, courseId);
          results.push({ user: userId, course: courseId, success: true, result });
        } catch (error) {
          results.push({ user: userId, course: courseId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    }
    return results;
  }

  private async getEnrollmentStatus(userIdentifier: string, courseIdentifier: string): Promise<any> {
    try {
      const userEnrollments = await this.getUserEnrollments(userIdentifier);
      const courseEnrollments = await this.getCourseEnrollments(courseIdentifier);
      
      return {
        user_enrollments: userEnrollments,
        course_enrollments: courseEnrollments,
        status: 'Retrieved enrollment data for analysis'
      };
    } catch (error) {
      throw new Error(`Could not get enrollment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getEnrollmentReports(type: string = 'general', filters?: any): Promise<any> {
    const endpoints = [
      '/analytics/v1/reports/enrollments',
      '/analytics/v1/reports/enrollment-summary',
      '/analytics/v1/reports/course-enrollments',
      '/analytics/v1/reports/completion-rates',
      '/analytics/v1/reports/progress',
      '/manage/v1/reports/enrollments',
      '/analytics/v1/dashboard/enrollments',
      '/analytics/v1/statistics/enrollments'
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) {
      // Fallback: get basic data from other endpoints
      const [users, courses] = await Promise.all([
        this.searchUsers('', 100),
        this.searchCourses('', 100)
      ]);
      
      return {
        type: 'basic_report',
        users_count: users.data?.total_count || users.data?.items?.length || 0,
        courses_count: courses.data?.total_count || courses.data?.items?.length || 0,
        note: 'Limited report - analytics endpoints not available'
      };
    }
    
    return result.data;
  }

  private async getCompletionData(type: string, identifier?: string): Promise<any> {
    const endpoints = [
      '/analytics/v1/reports/completions',
      '/analytics/v1/reports/progress',
      '/analytics/v1/reports/completion-rates',
      '/learn/v1/reports/completions',
      '/analytics/v1/statistics/completions'
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working completion data endpoint found');
    
    return result.data;
  }

  private async searchSessions(query?: string): Promise<any> {
    const endpoints = [
      '/learn/v1/sessions',
      '/learn/v1/ilt/sessions',
      '/manage/v1/sessions',
      '/api/v1/sessions'
    ];
    
    const result = await this.doceboAPI.findWorkingEndpoint(endpoints, 'GET', null);
    if (!result) throw new Error('No working sessions endpoint found');
    
    return result.data;
  }

  private async enrollInSession(userIdentifier: string, sessionIdentifier: string): Promise<any> {
    // Similar to course enrollment but for ILT sessions
    const sessionEndpoints = [
      `/learn/v1/sessions/${sessionIdentifier}/enrollments`,
      `/learn/v1/ilt/${sessionIdentifier}/enrollments`,
      `/manage/v1/sessions/${sessionIdentifier}/enrollments`
    ];
    
    // Get user ID first
    const users = await this.searchUsers(userIdentifier, 5);
    const user = users.data?.items?.find((u: any) => 
      u.email?.toLowerCase() === userIdentifier.toLowerCase() ||
      u.fullname?.toLowerCase().includes(userIdentifier.toLowerCase())
    );
    if (!user) throw new Error(`User not found: ${userIdentifier}`);
    
    const userId = user.user_id || user.id;
    
    for (const endpoint of sessionEndpoints) {
      try {
        const result = await this.doceboAPI.apiCall(endpoint, 'POST', { users: [userId] });
        return { success: true, result, endpoint_used: endpoint };
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('Session enrollment failed - no working endpoint found');
  }

  private async generateResponseWithAI(originalMessage: string, intentAnalysis: any, functionResults: any, userRole: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    });

    const prompt = `You are a helpful Docebo LMS assistant. Generate a comprehensive response based on the function results.

Original user message: "${originalMessage}"
User role: ${userRole}
Intent analysis: ${JSON.stringify(intentAnalysis, null, 2)}
Function results: ${JSON.stringify(functionResults, null, 2)}

Generate a helpful, detailed response that:
1. Directly answers the user's question
2. Includes specific data from the function results
3. Uses appropriate formatting (bullets, numbers, headers)
4. Suggests follow-up actions when relevant
5. Is appropriate for the user's role level

If any functions failed, acknowledge it and provide what information is available.
If enrollment operations were performed, confirm what was done.
If searches were performed, summarize the results clearly.
If reports were requested, present the data in an organized way.

Response:`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('AI response generation failed:', error);
      return this.generateFallbackResponse(originalMessage, functionResults);
    }
  }

  private generateFallbackResponse(originalMessage: string, functionResults: any): string {
    let response = "Here's what I found:\n\n";
    
    // Function results should be safe to access
    for (const [funcName, result] of Object.entries(functionResults as Record<string, any>)) {
      if ((result as any).success) {
        response += `✅ **${funcName}**: Operation completed successfully\n`;
        if ((result as any).data?.data?.items) {
          response += `   Found ${(result as any).data.data.items.length} items\n`;
        }
      } else {
        response += `❌ **${funcName}**: ${(result as any).error}\n`;
      }
    }
    
    response += "\nIf you need more specific information, please try rephrasing your question.";
    return response;
  }
}

// Initialize the intelligent chat processor
const chatProcessor = new IntelligentChatProcessor(
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

    console.log(`🤖 Processing intelligent chat: "${message}" for role: ${userRole}`);
    
    const result = await chatProcessor.processMessage(message, userRole);
    
    console.log(`✅ Intelligent response generated for: ${result.intent}`);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Intelligent chat error:', error);
    return NextResponse.json({
      response: 'I encountered an error processing your request. Please try again.',
      intent: 'error',
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Intelligent Docebo Chat API is running',
    capabilities: [
      'Natural language processing with AI',
      'Dynamic endpoint discovery',
      'Intelligent function calling',
      'Comprehensive enrollment management',
      'Real-time user and course search',
      'Progress tracking and reporting',
      'Batch operations',
      'ILT session management',
      'Adaptive error handling',
      'Role-based responses'
    ],
    version: '2.0-intelligent',
    timestamp: new Date().toISOString()
  });
}
