// lib/ai/enhanced-chat-processor.ts - Complete Enrollment Management via Natural Language
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EnhancedDoceboAPI, EnrollmentRequest, EnrollmentUpdate } from '../docebo-api-enhanced';

export interface ChatContext {
  userRole: string;
  userId: string;
  sessionId: string;
  previousRequests: string[];
}

export interface ProcessedIntent {
  intent: string;
  entities: Record<string, any>;
  requires_confirmation: boolean;
  missing_required_fields: string[];
  confidence: number;
  natural_language_summary: string;
}

export interface ChatResponse {
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
  requires_input?: {
    field: string;
    message: string;
    type: 'text' | 'email' | 'date' | 'select';
    options?: string[];
  };
  meta: {
    processing_time: number;
    timestamp: string;
    functions_called: string[];
  };
}

export class EnhancedChatProcessor {
  private genAI: GoogleGenerativeAI;
  private doceboAPI: EnhancedDoceboAPI;

  constructor(geminiApiKey: string, doceboConfig: any) {
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
    this.doceboAPI = new EnhancedDoceboAPI(doceboConfig);
  }

  async processMessage(message: string, context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now();
    const functionsCalled: string[] = [];

    try {
      console.log(`🧠 Processing: "${message}" for role: ${context.userRole}`);

      // Step 1: Analyze intent with AI
      const intent = await this.analyzeIntentWithAI(message, context);
      console.log(`🎯 Intent detected: ${intent.intent}`);

      // Step 2: Validate and execute
      if (intent.missing_required_fields.length > 0) {
        return this.createMissingFieldsResponse(intent, startTime, functionsCalled);
      }

      if (intent.requires_confirmation) {
        return this.createConfirmationResponse(intent, startTime, functionsCalled);
      }

      // Step 3: Execute the function
      const result = await this.executeFunctionBasedOnIntent(intent, functionsCalled);

      // Step 4: Generate natural language response
      const response = await this.generateNaturalLanguageResponse(intent, result, context);

      return {
        response,
        intent: intent.intent,
        success: true,
        data: result,
        meta: {
          processing_time: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          functions_called: functionsCalled
        }
      };

    } catch (error) {
      console.error('❌ Chat processing error:', error);
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

  private async analyzeIntentWithAI(message: string, context: ChatContext): Promise<ProcessedIntent> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
      },
    });

    const prompt = `You are an expert at analyzing Docebo LMS requests. Analyze this message and extract the intent and entities.

User message: "${message}"
User role: ${context.userRole}

Available intents:
1. "get_user_enrollments" - Get what courses/plans/sessions a user is enrolled in
2. "get_course_enrollments" - Get who is enrolled in a course/plan/session
3. "get_enrollment_stats" - Get enrollment statistics and reports
4. "enroll_users" - Enroll users in courses/plans/sessions
5. "enroll_groups" - Enroll entire groups in courses/plans/sessions
6. "unenroll_users" - Remove users from enrollments
7. "update_enrollments" - Update enrollment details (priority, due date, status)
8. "search_users" - Find users by name, email, etc.
9. "search_courses" - Find courses by name, type, etc.
10. "search_learning_plans" - Find learning plans
11. "search_sessions" - Find ILT sessions
12. "search_groups" - Find user groups
13. "help" - Get help or general information

Entity extraction guidelines:
- Extract emails from patterns like "user@domain.com"
- Extract course names from quotes or "course named X"
- Extract dates from patterns like "by 2024-12-31" or "due December 31"
- Extract priorities from "high priority", "urgent", "low priority"
- Extract user identifiers (emails, names, IDs)
- Extract learning plan names and session names
- Extract group names for group enrollments

Required fields by intent:
- get_user_enrollments: user_identifier (email/name/id)
- get_course_enrollments: course_identifier (name/id)
- get_enrollment_stats: at least one of course_ids, learning_plan_ids, session_ids, or user_ids
- enroll_users: users (list), and at least one of courses, learning_plans, sessions
- enroll_groups: groups (list), and at least one of courses, learning_plans, sessions
- unenroll_users: users (list), and at least one of courses, learning_plans, sessions
- update_enrollments: user_id, and one of course_id/learning_plan_id/session_id

Examples:
"Is john@company.com enrolled in Python course?" → get_user_enrollments
"Who is enrolled in Leadership Training?" → get_course_enrollments
"Enroll sarah@test.com in Excel course with high priority due 2024-12-31" → enroll_users
"Remove mike@company.com from JavaScript training" → unenroll_users
"Show completion stats for all Python courses" → get_enrollment_stats
"Enroll the sales team group in Customer Service training" → enroll_groups

Respond with JSON in this exact format:
{
  "intent": "intent_name",
  "entities": {
    "users": ["email1", "email2"],
    "courses": ["course1", "course2"],
    "learning_plans": ["plan1"],
    "sessions": ["session1"],
    "groups": ["group1"],
    "priority": "high|medium|low",
    "due_date": "2024-12-31",
    "user_identifier": "john@company.com",
    "course_identifier": "Python Programming",
    "search_query": "python",
    "date_from": "2024-01-01",
    "date_to": "2024-12-31"
  },
  "requires_confirmation": false,
  "missing_required_fields": [],
  "confidence": 0.95,
  "natural_language_summary": "What I understand you want to do"
}

JSON Response:`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate required fields based on intent
        const missingFields = this.validateRequiredFields(parsed.intent, parsed.entities);
        parsed.missing_required_fields = missingFields;
        
        return parsed;
      }
      
      throw new Error('No valid JSON found in AI response');
    } catch (error) {
      console.error('AI intent analysis failed:', error);
      return this.fallbackIntentAnalysis(message);
    }
  }

  private validateRequiredFields(intent: string, entities: any): string[] {
    const missing: string[] = [];
    
    switch (intent) {
      case 'get_user_enrollments':
        if (!entities.user_identifier && (!entities.users || entities.users.length === 0)) {
          missing.push('user_identifier (email, name, or ID)');
        }
        break;
        
      case 'get_course_enrollments':
        if (!entities.course_identifier && (!entities.courses || entities.courses.length === 0)) {
          missing.push('course_identifier (course name or ID)');
        }
        break;
        
      case 'get_enrollment_stats':
        if (!entities.course_ids && !entities.learning_plan_ids && !entities.session_ids && 
            !entities.user_ids && !entities.courses && !entities.learning_plans && 
            !entities.sessions && !entities.users) {
          missing.push('at least one of: course names, learning plan names, session names, or user identifiers');
        }
        break;
        
      case 'enroll_users':
        if (!entities.users || entities.users.length === 0) {
          missing.push('user identifiers (emails, names, or IDs)');
        }
        if (!entities.courses && !entities.learning_plans && !entities.sessions) {
          missing.push('at least one of: courses, learning plans, or sessions to enroll in');
        }
        break;
        
      case 'enroll_groups':
        if (!entities.groups || entities.groups.length === 0) {
          missing.push('group names or IDs');
        }
        if (!entities.courses && !entities.learning_plans && !entities.sessions) {
          missing.push('at least one of: courses, learning plans, or sessions to enroll in');
        }
        break;
        
      case 'unenroll_users':
        if (!entities.users || entities.users.length === 0) {
          missing.push('user identifiers (emails, names, or IDs)');
        }
        if (!entities.courses && !entities.learning_plans && !entities.sessions) {
          missing.push('at least one of: courses, learning plans, or sessions to unenroll from');
        }
        break;
        
      case 'update_enrollments':
        if (!entities.users || entities.users.length === 0) {
          missing.push('user identifiers (emails, names, or IDs)');
        }
        if (!entities.courses && !entities.learning_plans && !entities.sessions) {
          missing.push('at least one of: courses, learning plans, or sessions to update');
        }
        break;
    }
    
    return missing;
  }

  private fallbackIntentAnalysis(message: string): ProcessedIntent {
    const messageLower = message.toLowerCase();
    
    // Extract email if present
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    
    if (emailMatch) {
      if (messageLower.includes('enroll') && !messageLower.includes('unenroll')) {
        return {
          intent: 'enroll_users',
          entities: { users: [emailMatch[0]] },
          requires_confirmation: false,
          missing_required_fields: ['at least one of: courses, learning plans, or sessions to enroll in'],
          confidence: 0.7,
          natural_language_summary: `Enroll ${emailMatch[0]} in something (need to specify what)`
        };
      }
      
      if (messageLower.includes('unenroll') || messageLower.includes('remove')) {
        return {
          intent: 'unenroll_users',
          entities: { users: [emailMatch[0]] },
          requires_confirmation: false,
          missing_required_fields: ['at least one of: courses, learning plans, or sessions to unenroll from'],
          confidence: 0.7,
          natural_language_summary: `Unenroll ${emailMatch[0]} from something (need to specify what)`
        };
      }
      
      if (messageLower.includes('enrolled') || messageLower.includes('enrollment')) {
        return {
          intent: 'get_user_enrollments',
          entities: { user_identifier: emailMatch[0] },
          requires_confirmation: false,
          missing_required_fields: [],
          confidence: 0.8,
          natural_language_summary: `Check enrollments for ${emailMatch[0]}`
        };
      }
    }
    
    if (messageLower.includes('who is enrolled') || messageLower.includes('enrolled in')) {
      return {
        intent: 'get_course_enrollments',
        entities: {},
        requires_confirmation: false,
        missing_required_fields: ['course_identifier (course name or ID)'],
        confidence: 0.6,
        natural_language_summary: 'Check who is enrolled in a course (need course name)'
      };
    }
    
    if (messageLower.includes('stats') || messageLower.includes('statistics') || messageLower.includes('report')) {
      return {
        intent: 'get_enrollment_stats',
        entities: {},
        requires_confirmation: false,
        missing_required_fields: ['at least one of: course names, learning plan names, session names, or user identifiers'],
        confidence: 0.6,
        natural_language_summary: 'Get enrollment statistics (need to specify what to analyze)'
      };
    }
    
    if (messageLower.includes('group') && messageLower.includes('enroll')) {
      return {
        intent: 'enroll_groups',
        entities: {},
        requires_confirmation: false,
        missing_required_fields: ['group names or IDs', 'at least one of: courses, learning plans, or sessions to enroll in'],
        confidence: 0.6,
        natural_language_summary: 'Enroll groups (need group names and what to enroll in)'
      };
    }
    
    // Default to help
    return {
      intent: 'help',
      entities: { topic: message },
      requires_confirmation: false,
      missing_required_fields: [],
      confidence: 0.3,
      natural_language_summary: 'General help request'
    };
  }

  private createMissingFieldsResponse(intent: ProcessedIntent, startTime: number, functionsCalled: string[]): ChatResponse {
    const fieldsText = intent.missing_required_fields.join(', ');
    
    return {
      response: `❓ **Missing Information**: To ${intent.natural_language_summary}, I need the following information:\n\n${intent.missing_required_fields.map(field => `• ${field}`).join('\n')}\n\nPlease provide this information and I'll help you complete the request.`,
      intent: intent.intent,
      success: false,
      requires_input: {
        field: intent.missing_required_fields[0],
        message: `Please provide: ${intent.missing_required_fields[0]}`,
        type: intent.missing_required_fields[0].includes('email') ? 'email' : 
              intent.missing_required_fields[0].includes('date') ? 'date' : 'text'
      },
      meta: {
        processing_time: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        functions_called: functionsCalled
      }
    };
  }

  private createConfirmationResponse(intent: ProcessedIntent, startTime: number, functionsCalled: string[]): ChatResponse {
    return {
      response: `⚠️ **Confirmation Required**: ${intent.natural_language_summary}\n\nPlease confirm if you want to proceed with this action.`,
      intent: intent.intent,
      success: false,
      actions: [
        { id: 'confirm', label: 'Yes, Proceed', type: 'primary', action: 'confirm_action' },
        { id: 'cancel', label: 'Cancel', type: 'secondary', action: 'cancel_action' }
      ],
      meta: {
        processing_time: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        functions_called: functionsCalled
      }
    };
  }

  private async executeFunctionBasedOnIntent(intent: ProcessedIntent, functionsCalled: string[]): Promise<any> {
    const entities = intent.entities;
    
    switch (intent.intent) {
      case 'get_user_enrollments':
        functionsCalled.push('getUserEnrollments');
        const userIdentifier = entities.user_identifier || entities.users?.[0];
        
        // First, find the user
        const users = await this.doceboAPI.searchUsers(userIdentifier, 5);
        const user = users.find(u => 
          u.email.toLowerCase() === userIdentifier.toLowerCase() ||
          u.fullname.toLowerCase().includes(userIdentifier.toLowerCase()) ||
          u.username.toLowerCase() === userIdentifier.toLowerCase()
        );
        
        if (!user) {
          throw new Error(`User not found: ${userIdentifier}`);
        }
        
        return await this.doceboAPI.getUserEnrollments(user.user_id, true);
        
      case 'get_course_enrollments':
        functionsCalled.push('getCourseEnrollments');
        const courseIdentifier = entities.course_identifier || entities.courses?.[0];
        
        // First, find the course
        const courses = await this.doceboAPI.searchCourses(courseIdentifier, 5);
        const course = courses.find(c => 
          c.course_name.toLowerCase().includes(courseIdentifier.toLowerCase()) ||
          c.course_code?.toLowerCase() === courseIdentifier.toLowerCase()
        );
        
        if (!course) {
          throw new Error(`Course not found: ${courseIdentifier}`);
        }
        
        return await this.doceboAPI.getCourseEnrollments(course.course_id, true);
        
      case 'get_enrollment_stats':
        functionsCalled.push('getEnrollmentStats');
        return await this.doceboAPI.getEnrollmentStats({
          course_ids: entities.courses,
          learning_plan_ids: entities.learning_plans,
          session_ids: entities.sessions,
          user_ids: entities.users,
          date_from: entities.date_from,
          date_to: entities.date_to
        });
        
      case 'enroll_users':
        functionsCalled.push('enrollUsers');
        
        // Resolve user identifiers to IDs
        const userIds = await this.resolveUserIdentifiers(entities.users);
        
        // Resolve course/plan/session identifiers to IDs
        const courseIds = entities.courses ? await this.resolveCourseIdentifiers(entities.courses) : undefined;
        const lpIds = entities.learning_plans ? await this.resolveLearningPlanIdentifiers(entities.learning_plans) : undefined;
        const sessionIds = entities.sessions ? await this.resolveSessionIdentifiers(entities.sessions) : undefined;
        
        const enrollmentRequest: EnrollmentRequest = {
          users: userIds,
          courses: courseIds,
          learning_plans: lpIds,
          sessions: sessionIds,
          priority: entities.priority || 'medium',
          due_date: entities.due_date,
          enrollment_type: 'immediate',
          notification: true
        };
        
        return await this.doceboAPI.enrollUsers(enrollmentRequest);
        
      case 'enroll_groups':
        functionsCalled.push('enrollGroups');
        
        const groupIds = await this.resolveGroupIdentifiers(entities.groups);
        const groupCourseIds = entities.courses ? await this.resolveCourseIdentifiers(entities.courses) : undefined;
        const groupLpIds = entities.learning_plans ? await this.resolveLearningPlanIdentifiers(entities.learning_plans) : undefined;
        const groupSessionIds = entities.sessions ? await this.resolveSessionIdentifiers(entities.sessions) : undefined;
        
        const groupEnrollmentRequest = {
          users: [], // Will be populated from groups
          groups: groupIds,
          courses: groupCourseIds,
          learning_plans: groupLpIds,
          sessions: groupSessionIds,
          priority: entities.priority || 'medium',
          due_date: entities.due_date,
          enrollment_type: 'immediate' as const,
          notification: true
        };
        
        return await this.doceboAPI.enrollGroups(groupEnrollmentRequest);
        
      case 'unenroll_users':
        functionsCalled.push('unenrollUsers');
        
        const unenrollUserIds = await this.resolveUserIdentifiers(entities.users);
        const unenrollCourseIds = entities.courses ? await this.resolveCourseIdentifiers(entities.courses) : undefined;
        const unenrollLpIds = entities.learning_plans ? await this.resolveLearningPlanIdentifiers(entities.learning_plans) : undefined;
        const unenrollSessionIds = entities.sessions ? await this.resolveSessionIdentifiers(entities.sessions) : undefined;
        
        return await this.doceboAPI.unenrollUsers({
          users: unenrollUserIds,
          courses: unenrollCourseIds,
          learning_plans: unenrollLpIds,
          sessions: unenrollSessionIds,
          reason: entities.reason || 'Requested via AI assistant',
          notification: true
        });
        
      case 'update_enrollments':
        functionsCalled.push('updateEnrollments');
        
        const updateUserIds = await this.resolveUserIdentifiers(entities.users);
        const updateCourseIds = entities.courses ? await this.resolveCourseIdentifiers(entities.courses) : undefined;
        const updateLpIds = entities.learning_plans ? await this.resolveLearningPlanIdentifiers(entities.learning_plans) : undefined;
        const updateSessionIds = entities.sessions ? await this.resolveSessionIdentifiers(entities.sessions) : undefined;
        
        const updates: EnrollmentUpdate[] = [];
        
        for (const userId of updateUserIds) {
          if (updateCourseIds) {
            for (const courseId of updateCourseIds) {
              updates.push({
                user_id: userId,
                course_id: courseId,
                priority: entities.priority,
                due_date: entities.due_date,
                status: entities.status
              });
            }
          }
          
          if (updateLpIds) {
            for (const lpId of updateLpIds) {
              updates.push({
                user_id: userId,
                learning_plan_id: lpId,
                priority: entities.priority,
                due_date: entities.due_date,
                status: entities.status
              });
            }
          }
          
          if (updateSessionIds) {
            for (const sessionId of updateSessionIds) {
              updates.push({
                user_id: userId,
                session_id: sessionId,
                priority: entities.priority,
                due_date: entities.due_date,
                status: entities.status
              });
            }
          }
        }
        
        return await this.doceboAPI.updateEnrollments(updates);
        
      case 'search_users':
        functionsCalled.push('searchUsers');
        return await this.doceboAPI.searchUsers(entities.search_query || entities.user_identifier, 25);
        
      case 'search_courses':
        functionsCalled.push('searchCourses');
        return await this.doceboAPI.searchCourses(entities.search_query || entities.course_identifier, 25);
        
      case 'search_learning_plans':
        functionsCalled.push('searchLearningPlans');
        return await this.doceboAPI.searchLearningPlans(entities.search_query, 25);
        
      case 'search_sessions':
        functionsCalled.push('searchSessions');
        return await this.doceboAPI.searchSessions(entities.search_query, 25);
        
      default:
        throw new Error(`Unknown intent: ${intent.intent}`);
    }
  }

  // Helper methods to resolve identifiers to IDs
  private async resolveUserIdentifiers(identifiers: string[]): Promise<string[]> {
    const userIds: string[] = [];
    
    for (const identifier of identifiers) {
      const users = await this.doceboAPI.searchUsers(identifier, 5);
      const user = users.find(u => 
        u.email.toLowerCase() === identifier.toLowerCase() ||
        u.fullname.toLowerCase().includes(identifier.toLowerCase()) ||
        u.username.toLowerCase() === identifier.toLowerCase() ||
        u.user_id === identifier
      );
      
      if (user) {
        userIds.push(user.user_id);
      } else {
        throw new Error(`User not found: ${identifier}`);
      }
    }
    
    return userIds;
  }

  private async resolveCourseIdentifiers(identifiers: string[]): Promise<string[]> {
    const courseIds: string[] = [];
    
    for (const identifier of identifiers) {
      const courses = await this.doceboAPI.searchCourses(identifier, 5);
      const course = courses.find(c => 
        c.course_name.toLowerCase().includes(identifier.toLowerCase()) ||
        c.course_code?.toLowerCase() === identifier.toLowerCase() ||
        c.course_id === identifier
      );
      
      if (course) {
        courseIds.push(course.course_id);
      } else {
        throw new Error(`Course not found: ${identifier}`);
      }
    }
    
    return courseIds;
  }

  private async resolveLearningPlanIdentifiers(identifiers: string[]): Promise<string[]> {
    const lpIds: string[] = [];
    
    for (const identifier of identifiers) {
      const learningPlans = await this.doceboAPI.searchLearningPlans(identifier, 5);
      const lp = learningPlans.find(l => 
        l.name.toLowerCase().includes(identifier.toLowerCase()) ||
        l.learning_plan_id === identifier
      );
      
      if (lp) {
        lpIds.push(lp.learning_plan_id);
      } else {
        throw new Error(`Learning plan not found: ${identifier}`);
      }
    }
    
    return lpIds;
  }

  private async resolveSessionIdentifiers(identifiers: string[]): Promise<string[]> {
    const sessionIds: string[] = [];
    
    for (const identifier of identifiers) {
      const sessions = await this.doceboAPI.searchSessions(identifier, 5);
      const session = sessions.find(s => 
        s.session_name.toLowerCase().includes(identifier.toLowerCase()) ||
        s.session_id === identifier
      );
      
      if (session) {
        sessionIds.push(session.session_id);
      } else {
        throw new Error(`Session not found: ${identifier}`);
      }
    }
    
    return sessionIds;
  }

  private async resolveGroupIdentifiers(identifiers: string[]): Promise<string[]> {
    const groupIds: string[] = [];
    
    for (const identifier of identifiers) {
      const groups = await this.doceboAPI.getGroups({ search_text: identifier, page_size: 5 });
      const group = groups.data.find(g => 
        g.group_name.toLowerCase().includes(identifier.toLowerCase()) ||
        g.group_id === identifier
      );
      
      if (group) {
        groupIds.push(group.group_id);
      } else {
        throw new Error(`Group not found: ${identifier}`);
      }
    }
    
    return groupIds;
  }

  private async generateNaturalLanguageResponse(intent: ProcessedIntent, result: any, context: ChatContext): Promise<string> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    });

    const prompt = `Generate a helpful response for this Docebo LMS operation.

Intent: ${intent.intent}
User role: ${context.userRole}
Operation result: ${JSON.stringify(result, null, 2)}

Create a clear, professional response that:
1. Confirms what action was taken
2. Shows key results/data in an organized way
3. Uses appropriate formatting (bullets, numbers, headers)
4. Suggests relevant next actions
5. Is appropriate for the user's role level

Keep the response concise but informative. Use markdown formatting for better readability.

Response:`;

    try {
      const aiResult = await model.generateContent(prompt);
      return aiResult.response.text();
    } catch (error) {
      console.error('AI response generation failed:', error);
      return this.generateFallbackResponse(intent.intent, result);
    }
  }

  private generateFallbackResponse(intent: string, result: any): string {
    switch (intent) {
      case 'get_user_enrollments':
        const totalEnrollments = result.total_enrollments || 0;
        return `📚 **User Enrollments**: Found ${totalEnrollments} total enrollments\n\n• **Courses**: ${result.courses?.length || 0}\n• **Learning Plans**: ${result.learning_plans?.length || 0}\n• **Sessions**: ${result.sessions?.length || 0}`;
        
      case 'get_course_enrollments':
        return `👥 **Course Enrollments**: ${result.total_enrolled || 0} users enrolled\n\nCompletion rate: ${result.completion_stats?.completion_rate || 0}%`;
        
      case 'enroll_users':
        return `✅ **Enrollment Complete**: ${result.successful?.length || 0} successful, ${result.failed?.length || 0} failed\n\n${result.summary}`;
        
      case 'unenroll_users':
        return `✅ **Unenrollment Complete**: ${result.successful?.length || 0} successful, ${result.failed?.length || 0} failed\n\n${result.summary}`;
        
      default:
        return `✅ **Operation Complete**: ${intent} executed successfully`;
    }
  }
}
