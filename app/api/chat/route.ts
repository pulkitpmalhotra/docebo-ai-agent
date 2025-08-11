// app/api/chat/route.ts - Working version without complex dependencies
import { NextRequest, NextResponse } from 'next/server';

interface ChatRequest {
  message: string;
  userRole?: string;
  userId?: string;
  context?: string;
}

interface ChatResponse {
  response: string;
  intent: string;
  userRole: string;
  suggestions?: string[];
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary';
    action: string;
  }>;
  meta: {
    api_mode: string;
    processing_time: number;
    timestamp: string;
  };
}

// Main categories and their actions
const DOCEBO_CATEGORIES = {
  user_management: {
    name: 'User Management',
    actions: [
      'Search for a user',
      'Check user status',
      'View user profile',
      'Manage user enrollments',
      'Reset user password',
      'Deactivate/activate user'
    ]
  },
  course_management: {
    name: 'Course Management',
    actions: [
      'Search courses',
      'View course details',
      'Check course enrollments',
      'Manage course settings',
      'Course completion rates',
      'Export course data'
    ]
  },
  learning_plan_management: {
    name: 'Learning Plan Management',
    actions: [
      'View learning plans',
      'Check learning plan progress',
      'Manage learning plan enrollments',
      'Create learning plan reports',
      'Export learning plan data'
    ]
  },
  notifications: {
    name: 'Notifications',
    actions: [
      'Send notifications',
      'View notification history',
      'Create notification templates',
      'Schedule notifications',
      'Notification delivery reports'
    ]
  },
  enrollments: {
    name: 'Enrollments',
    actions: [
      'Enroll users in courses',
      'Bulk enrollment',
      'View enrollment history',
      'Cancel enrollments',
      'Enrollment reports'
    ]
  },
  central_repository: {
    name: 'Central Repository',
    actions: [
      'Search repository',
      'Upload content',
      'Manage assets',
      'Content usage reports',
      'Export repository data'
    ]
  },
  group_management: {
    name: 'Group Management',
    actions: [
      'Create groups',
      'Manage group members',
      'Group enrollment',
      'Group progress reports',
      'Export group data'
    ]
  },
  reports: {
    name: 'Reports',
    actions: [
      'Generate user reports',
      'Course completion reports',
      'Enrollment reports',
      'Custom reports',
      'Schedule reports',
      'Export reports'
    ]
  },
  analytics: {
    name: 'Analytics',
    actions: [
      'User analytics',
      'Course analytics',
      'Learning plan analytics',
      'System usage analytics',
      'Performance dashboards'
    ]
  }
};

// Role-based permissions
const ROLE_PERMISSIONS = {
  superadmin: Object.keys(DOCEBO_CATEGORIES),
  power_user: ['user_management', 'course_management', 'enrollments', 'reports', 'analytics'],
  user_manager: ['user_management', 'reports', 'analytics'],
  user: ['reports']
};

function validateRequest(body: any): { success: boolean; data?: ChatRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }

  if (!body.message || typeof body.message !== 'string') {
    return { success: false, error: 'Message is required' };
  }

  if (body.message.length > 2000) {
    return { success: false, error: 'Message too long (max 2000 characters)' };
  }

  return {
    success: true,
    data: {
      message: body.message.trim(),
      userRole: body.userRole || 'user',
      userId: body.userId || 'anonymous',
      context: body.context
    }
  };
}

function detectIntent(message: string): string {
  const messageLower = message.toLowerCase().trim();
  
  // Check for specific intents
  if (messageLower.includes('what') && (messageLower.includes('do') || messageLower.includes('can'))) {
    return 'category_selection';
  }
  
  // Category detection
  if (messageLower.includes('user') && (messageLower.includes('manage') || messageLower.includes('search') || messageLower.includes('status'))) {
    return 'user_management';
  }
  
  if (messageLower.includes('course') && (messageLower.includes('manage') || messageLower.includes('search') || messageLower.includes('find'))) {
    return 'course_management';
  }
  
  if (messageLower.includes('learning plan')) {
    return 'learning_plan_management';
  }
  
  if (messageLower.includes('notification') || messageLower.includes('notify')) {
    return 'notifications';
  }
  
  if (messageLower.includes('enroll')) {
    return 'enrollments';
  }
  
  if (messageLower.includes('repository') || messageLower.includes('content')) {
    return 'central_repository';
  }
  
  if (messageLower.includes('group')) {
    return 'group_management';
  }
  
  if (messageLower.includes('report')) {
    return 'reports';
  }
  
  if (messageLower.includes('analytics') || messageLower.includes('dashboard')) {
    return 'analytics';
  }
  
  // Default
  return 'category_selection';
}

function generateResponse(message: string, intent: string, userRole: string): ChatResponse {
  const startTime = Date.now();
  const allowedCategories = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];
  
  let response = '';
  let suggestions: string[] = [];
  let actions: Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> = [];

  switch (intent) {
    case 'category_selection':
      response = `👋 **Welcome to Docebo AI Assistant!**

I can help you with various LMS management tasks. What would you like to do today?

**Available Categories for ${userRole.replace('_', ' ').toUpperCase()}:**

${allowedCategories.map(cat => `🔹 **${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name}**`).join('\n')}

Please select a category or tell me specifically what you'd like to accomplish.`;

      suggestions = allowedCategories.map(cat => 
        `Help with ${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name.toLowerCase()}`
      );
      
      actions = allowedCategories.slice(0, 3).map(cat => ({
        id: cat,
        label: DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name,
        type: 'primary' as const,
        action: `category_${cat}`
      }));
      break;

    case 'user_management':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access User Management features.`;
      } else {
        response = `👥 **User Management**\n\nI can help you with the following user management tasks:\n\n${DOCEBO_CATEGORIES.user_management.actions.map(action => `• ${action}`).join('\n')}\n\nWhat specific user management task would you like to perform?`;
        
        suggestions = [
          'Search for user john@company.com',
          'Check user status for sarah@company.com',
          'Show all inactive users',
          'Reset password for user@domain.com'
        ];
        
        actions = [
          { id: 'search_user', label: 'Search User', type: 'primary', action: 'search_user_form' },
          { id: 'user_status', label: 'Check Status', type: 'primary', action: 'user_status_form' },
          { id: 'list_users', label: 'List Users', type: 'secondary', action: 'list_users_query' }
        ];
      }
      break;

    case 'course_management':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access Course Management features.`;
      } else {
        response = `📚 **Course Management**\n\nI can help you with the following course management tasks:\n\n${DOCEBO_CATEGORIES.course_management.actions.map(action => `• ${action}`).join('\n')}\n\nWhat specific course management task would you like to perform?`;
        
        suggestions = [
          'Search for Python courses',
          'Show course completion rates',
          'Find courses with low enrollment',
          'Export course data'
        ];
        
        actions = [
          { id: 'search_course', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'course_stats', label: 'Course Stats', type: 'primary', action: 'course_stats_query' },
          { id: 'export_courses', label: 'Export Data', type: 'secondary', action: 'export_courses_form' }
        ];
      }
      break;

    case 'enrollments':
      if (!allowedCategories.includes('enrollments')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access Enrollment features.`;
      } else {
        response = `✅ **Enrollment Management**\n\nI can help you with the following enrollment tasks:\n\n${DOCEBO_CATEGORIES.enrollments.actions.map(action => `• ${action}`).join('\n')}\n\nWhat specific enrollment task would you like to perform?`;
        
        suggestions = [
          'Enroll user@company.com in Safety Training',
          'Bulk enroll Marketing team in Excel course',
          'Show enrollment history for user',
          'Generate enrollment report'
        ];
        
        actions = [
          { id: 'enroll_user', label: 'Enroll User', type: 'primary', action: 'enroll_user_form' },
          { id: 'bulk_enroll', label: 'Bulk Enroll', type: 'primary', action: 'bulk_enroll_form' },
          { id: 'enrollment_report', label: 'View Reports', type: 'secondary', action: 'enrollment_report_query' }
        ];
      }
      break;

    case 'reports':
      if (!allowedCategories.includes('reports')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access Reporting features.`;
      } else {
        response = `📊 **Reports & Analytics**\n\nI can help you generate the following reports:\n\n${DOCEBO_CATEGORIES.reports.actions.map(action => `• ${action}`).join('\n')}\n\nWhat type of report would you like to generate?`;
        
        suggestions = [
          'Generate user completion report',
          'Course performance report for Q4',
          'Show analytics for my team',
          'Export enrollment data'
        ];
        
        actions = [
          { id: 'user_report', label: 'User Report', type: 'primary', action: 'user_report_form' },
          { id: 'course_report', label: 'Course Report', type: 'primary', action: 'course_report_form' },
          { id: 'custom_report', label: 'Custom Report', type: 'secondary', action: 'custom_report_form' }
        ];
      }
      break;

    default:
      response = `🤔 **I'm not sure what you're looking for.**\n\nCould you please clarify what you'd like to do? I can help with:\n\n${allowedCategories.map(cat => `• ${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name}`).join('\n')}\n\nTry asking: "What can you help me with?" or be more specific about your request.`;
      
      suggestions = [
        'What can you help me with?',
        'Show me user management options',
        'Help with course management',
        'I need to generate a report'
      ];
  }

  const processingTime = Date.now() - startTime;

  return {
    response,
    intent,
    userRole,
    suggestions,
    actions,
    meta: {
      api_mode: 'working',
      processing_time: processingTime,
      timestamp: new Date().toISOString()
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Chat API - Processing request');
    
    const body = await request.json().catch(() => {
      throw new Error('Invalid JSON in request body');
    });

    const validation = validateRequest(body);
    if (!validation.success) {
      return NextResponse.json({
        error: validation.error,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const { message, userRole, userId } = validation.data!;
    console.log(`🎯 Processing: "${message}" for ${userRole}`);

    const intent = detectIntent(message);
    const result = generateResponse(message, intent, userRole);

    console.log(`✅ Response generated (${result.meta.processing_time}ms)`);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    console.error('❌ Chat API Error:', error);

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
      meta: {
        api_mode: 'working',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Docebo Chat API is running',
    timestamp: new Date().toISOString(),
    available_categories: Object.keys(DOCEBO_CATEGORIES)
  });
}
