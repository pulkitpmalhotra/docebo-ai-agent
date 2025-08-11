// app/api/chat-enhanced/route.ts - Complete Enrollment Management Chat API
import { NextRequest, NextResponse } from 'next/server';
import { EnhancedChatProcessor, ChatContext } from '@/lib/ai/enhanced-chat-processor';
import { InputValidator } from '@/lib/validation/input-validator';
import { ErrorHandler } from '@/lib/errors/error-handler';
import { rateLimiter, getClientIdentifier, getRateLimitHeaders } from '@/lib/middleware/rate-limit';

// Role-based permissions
const ROLE_PERMISSIONS = {
  superadmin: [
    'get_user_enrollments', 'get_course_enrollments', 'get_enrollment_stats',
    'enroll_users', 'enroll_groups', 'unenroll_users', 'update_enrollments',
    'search_users', 'search_courses', 'search_learning_plans', 'search_sessions', 'search_groups'
  ],
  power_user: [
    'get_user_enrollments', 'get_course_enrollments', 'get_enrollment_stats',
    'enroll_users', 'search_users', 'search_courses', 'search_learning_plans', 'search_sessions'
  ],
  user_manager: [
    'get_user_enrollments', 'get_course_enrollments', 'get_enrollment_stats',
    'search_users', 'search_courses'
  ],
  user: [
    'get_user_enrollments', 'search_courses', 'search_learning_plans'
  ]
};

// Initialize the enhanced chat processor
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
  const startTime = Date.now();
  
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const body = await request.json();
    const userRole = body.userRole || 'user';
    
    const rateLimit = rateLimiter.checkRateLimit(clientId, userRole);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please slow down.',
          retry_after: rateLimit.retryAfter 
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimit)
        }
      );
    }

    // Validate input
    const validation = InputValidator.validateChatRequest(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.errors
      }, { status: 400 });
    }

    const { message, userId = 'anonymous' } = validation.data!;

    // Security validation
    const security = InputValidator.validateSecurity(message);
    if (!security.safe) {
      return NextResponse.json({
        error: 'Message contains potentially harmful content',
        threats_detected: security.threats
      }, { status: 400 });
    }

    console.log(`🤖 Processing enhanced chat: "${message}" for role: ${userRole}`);

    // Create chat context
    const context: ChatContext = {
      userRole,
      userId,
      sessionId: `session_${Date.now()}`,
      previousRequests: [] // Could be stored in session/cache for context
    };

    // Process the message
    const result = await chatProcessor.processMessage(security.sanitized, context);

    // Check permissions for the detected intent
    const allowedIntents = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];
    if (result.intent && result.intent !== 'help' && result.intent !== 'error' && !allowedIntents.includes(result.intent)) {
      return NextResponse.json({
        response: `❌ **Access Denied**: Your role (${userRole}) doesn't have permission to perform: ${result.intent}`,
        intent: 'permission_denied',
        success: false,
        allowed_actions: allowedIntents,
        meta: {
          processing_time: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          functions_called: []
        }
      });
    }

    // Add role-specific guidance to the response
    if (result.success && result.data) {
      result.response = this.enhanceResponseForRole(result.response, result.intent, userRole, result.data);
    }

    // Add suggested actions based on role and result
    if (!result.actions) {
      result.actions = this.generateRoleBasedActions(result.intent, userRole, result.success);
    }

    console.log(`✅ Enhanced response generated: ${result.intent} (${Date.now() - startTime}ms)`);

    return NextResponse.json(result, {
      headers: getRateLimitHeaders(rateLimit)
    });

  } catch (error) {
    console.error('❌ Enhanced chat error:', error);
    
    const { statusCode, response } = ErrorHandler.handle(error, {
      endpoint: '/api/chat-enhanced',
      method: 'POST',
      ip: getClientIdentifier(request)
    });

    return NextResponse.json(response, { status: statusCode });
  }
}

// Helper function to enhance responses based on user role
function enhanceResponseForRole(response: string, intent: string, userRole: string, data: any): string {
  const roleConfig = {
    superadmin: { emoji: '🔧', title: 'Admin' },
    power_user: { emoji: '⚡', title: 'Power User' },
    user_manager: { emoji: '👥', title: 'Manager' },
    user: { emoji: '👤', title: 'User' }
  };

  const config = roleConfig[userRole as keyof typeof roleConfig] || roleConfig.user;
  
  let enhancedResponse = response;

  // Add role-specific context and actions
  if (intent === 'enroll_users' && userRole === 'superadmin') {
    enhancedResponse += `\n\n${config.emoji} **Admin Actions Available**:\n• Bulk enroll multiple users\n• Set custom due dates and priorities\n• Override enrollment restrictions\n• View detailed enrollment logs`;
  } else if (intent === 'get_enrollment_stats' && userRole === 'user_manager') {
    enhancedResponse += `\n\n${config.emoji} **Manager View**: Statistics limited to users under your management. Contact admin for system-wide reports.`;
  } else if (intent === 'enroll_users' && userRole === 'user') {
    enhancedResponse += `\n\n${config.emoji} **Note**: You can only view your own enrollments. Contact your manager for enrollment requests.`;
  }

  // Add data insights for successful operations
  if (data && intent === 'get_enrollment_stats') {
    const completionRate = data.completion_rate || 0;
    if (completionRate < 50) {
      enhancedResponse += `\n\n⚠️ **Alert**: Low completion rate (${completionRate}%). Consider reviewing course difficulty or providing additional support.`;
    } else if (completionRate > 80) {
      enhancedResponse += `\n\n🎉 **Excellent**: High completion rate (${completionRate}%)! Great engagement.`;
    }
  }

  return enhancedResponse;
}

// Generate role-based action suggestions
function generateRoleBasedActions(intent: string, userRole: string, success: boolean): Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> {
  const actions: Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> = [];

  if (!success) {
    actions.push(
      { id: 'help', label: 'Get Help', type: 'primary', action: 'show_help' },
      { id: 'retry', label: 'Try Again', type: 'secondary', action: 'retry_request' }
    );
    return actions;
  }

  // Role-based actions
  const roleActions = {
    superadmin: [
      { id: 'bulk_enroll', label: 'Bulk Enroll', type: 'primary' as const, action: 'bulk_enrollment_form' },
      { id: 'advanced_stats', label: 'Advanced Analytics', type: 'primary' as const, action: 'show_analytics' },
      { id: 'manage_groups', label: 'Manage Groups', type: 'secondary' as const, action: 'group_management' },
      { id: 'export_data', label: 'Export Data', type: 'secondary' as const, action: 'export_enrollment_data' }
    ],
    power_user: [
      { id: 'enroll_users', label: 'Enroll Users', type: 'primary' as const, action: 'enrollment_form' },
      { id: 'view_stats', label: 'View Statistics', type: 'primary' as const, action: 'show_stats' },
      { id: 'search_courses', label: 'Search Courses', type: 'secondary' as const, action: 'course_search' }
    ],
    user_manager: [
      { id: 'team_stats', label: 'Team Statistics', type: 'primary' as const, action: 'team_analytics' },
      { id: 'user_progress', label: 'User Progress', type: 'primary' as const, action: 'progress_tracking' }
    ],
    user: [
      { id: 'my_courses', label: 'My Courses', type: 'primary' as const, action: 'view_my_courses' },
      { id: 'search_catalog', label: 'Course Catalog', type: 'secondary' as const, action: 'browse_catalog' }
    ]
  };

  const availableActions = roleActions[userRole as keyof typeof roleActions] || roleActions.user;
  
  // Add intent-specific actions
  if (intent === 'get_user_enrollments') {
    actions.push(
      { id: 'export_enrollments', label: 'Export List', type: 'secondary', action: 'export_user_enrollments' }
    );
  } else if (intent === 'get_course_enrollments') {
    actions.push(
      { id: 'enroll_more', label: 'Enroll More Users', type: 'primary', action: 'additional_enrollment' }
    );
  }

  // Add common actions based on role
  actions.push(...availableActions.slice(0, 3)); // Limit to 3 role-based actions

  return actions;
}

// GET endpoint for API health and capabilities
export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      name: 'Enhanced Docebo Chat API',
      version: '2.0.0',
      capabilities: {
        enrollment_management: [
          'Get user enrollments (courses, learning plans, sessions)',
          'Get course/plan/session enrollments',
          'Enroll users in courses/plans/sessions',
          'Enroll groups in courses/plans/sessions',
          'Unenroll users from courses/plans/sessions',
          'Update enrollment details (priority, due date, status)',
          'Get enrollment statistics and reports'
        ],
        search_capabilities: [
          'Search users by name, email, ID',
          'Search courses by name, type, code',
          'Search learning plans',
          'Search ILT sessions',
          'Search user groups'
        ],
        natural_language_features: [
          'Intent detection from natural language',
          'Missing field detection and prompting',
          'Entity extraction (emails, dates, priorities)',
          'Confirmation workflows for critical actions',
          'Role-based response formatting',
          'Error handling with specific guidance'
        ],
        supported_roles: Object.keys(ROLE_PERMISSIONS),
        security_features: [
          'Input sanitization',
          'XSS/SQL injection detection',
          'Rate limiting by role',
          'Role-based permission checking'
        ]
      },
      examples: {
        enrollment_queries: [
          "Is john@company.com enrolled in Python Programming?",
          "Who is enrolled in Leadership Training course?",
          "Enroll sarah@test.com in Excel course with high priority due 2024-12-31",
          "Enroll the sales team group in Customer Service training",
          "Remove mike@company.com from JavaScript course",
          "Update jane@company.com's enrollment in SQL course to high priority",
          "Show completion stats for all Python courses"
        ],
        search_queries: [
          "Find users in marketing department",
          "Search for courses about data analysis",
          "Show upcoming Excel training sessions",
          "Find learning plans for new employees"
        ]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'API health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
