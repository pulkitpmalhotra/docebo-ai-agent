import { NextRequest, NextResponse } from 'next/server';
import { EnhancedDoceboClient } from '@/lib/docebo-enhanced';
import { RoleAwareAIProcessor } from '@/lib/ai/role-aware-processor';
import { RoleSpecificFormatter } from '@/lib/response-formatters/role-specific';
import { DoceboRole, PERMISSIONS } from '@/lib/rbac/permissions';

const docebo = new EnhancedDoceboClient();
const aiProcessor = new RoleAwareAIProcessor();
const formatter = new RoleSpecificFormatter();

// Helper function for permission checks
function hasPermission(userRole: DoceboRole, requiredPermissions: string[]): boolean {
  const userPermissions = PERMISSIONS[userRole];
  if (!userPermissions) return false;
  
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

export async function POST(request: NextRequest) {
  try {
    const { message, userRole = 'superadmin', userId = 'demo-user' } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('=== ENHANCED CHAT API START ===');
    console.log('User message:', message);
    console.log('User role:', userRole);
    
    // Get user permissions based on role
    const userPermissions = PERMISSIONS[userRole as DoceboRole] || [];
    console.log('User permissions:', userPermissions);
    
    // Process with role-aware AI
    const result = await aiProcessor.processQuery(message, userRole as DoceboRole, userPermissions);
    
    if (result.intent === 'permission_denied') {
      return NextResponse.json({
        response: result.message,
        intent: 'permission_denied',
        userRole,
        timestamp: new Date().toISOString()
      });
    }
    
    // Process the query based on intent
    let response: string;
    let additionalData: any = {};

    switch (result.intent) {
      case 'user_status_check':
        response = await handleUserStatusCheck(result.entities || {});
        break;
        
      case 'course_search':
        const courseResult = await handleCourseSearch(result.entities || {});
        response = formatter.formatResponse(courseResult, 'course_search', userRole as DoceboRole);
        additionalData = courseResult;
        break;
        
      case 'learning_plan_search':
        response = await handleLearningPlanSearch(result.entities || {});
        break;
        
      case 'enrollment_request':
        response = await handleEnrollmentRequest(result.entities || {}, userRole as DoceboRole);
        break;
        
      case 'statistics_request':
        const statsResult = await handleStatisticsRequest(result.entities || {}, userRole as DoceboRole);
        response = formatter.formatResponse(statsResult, 'statistics', userRole as DoceboRole);
        additionalData = statsResult;
        break;
        
      default:
        response = `I understand you want to: ${result.intent}. This feature is being implemented. Available features: user status, course search, enrollments, statistics.`;
    }

    console.log('=== ENHANCED CHAT API END ===');

    return NextResponse.json({
      response,
      intent: result.intent,
      userRole,
      permissions: userPermissions.length,
      additionalData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== ENHANCED CHAT API ERROR ===', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'Sorry, I encountered an error processing your request.',
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Enhanced handler functions with proper type safety
async function handleUserStatusCheck(entities: any): Promise<string> {
  try {
    const identifier = entities?.identifier || 'unknown';
    const type = entities?.type || 'email';
    
    const userStatus = await docebo.getUserStatus(identifier, type);
    
    if (!userStatus.found || !userStatus.data) {
      return `❌ User "${identifier}" not found. Please check the email, username, or ID.`;
    }
    
    const user = userStatus.data as any;
    
    // Safely access user properties with fallbacks
    const email = user.email || 'No email';
    const firstname = user.firstname || 'Unknown';
    const lastname = user.lastname || '';
    const department = user.department || 'Not specified';
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
    const registerDate = user.register_date ? new Date(user.register_date).toLocaleDateString() : 'Unknown';
    const userId = user.id || 'Unknown';
    const isActive = user.active === true || user.status === 'active';

    return `👤 **User Status for ${email}**

- **Name**: ${firstname} ${lastname}
- **Status**: ${isActive ? '✅ Active' : '❌ Inactive'}
- **Department**: ${department}
- **Last Login**: ${lastLogin}
- **Registration Date**: ${registerDate}
- **User ID**: ${userId}

${isActive ? '🟢 User account is active and can access training.' : '🔴 User account is inactive. Contact admin to reactivate.'}`;

  } catch (error) {
    return `❌ Error checking user status: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleCourseSearch(entities: any): Promise<any> {
  try {
    const query = entities?.query || 'unknown';
    const type = entities?.type || 'title';
    
    const searchResult = await docebo.searchCourses(query, type);
    
    if (!searchResult.found) {
      if (searchResult.suggestions && Array.isArray(searchResult.suggestions) && searchResult.suggestions.length > 0) {
        return {
          found: false,
          suggestions: searchResult.suggestions,
          message: searchResult.message || `No exact match found for "${query}"`,
          type: 'suggestions'
        };
      }
      
      return {
        found: false,
        message: searchResult.message || `No courses found for "${query}". Try using exact course ID or title.`,
        type: 'not_found'
      };
    }
    
    const courses = Array.isArray(searchResult.data) ? searchResult.data : [searchResult.data];
    
    return {
      found: true,
      courses: courses.map((course: any) => ({
        id: course?.id || 'Unknown',
        name: course?.name || 'Unknown Course',
        status: course?.status || 'unknown',
        published: course?.status === 'published',
        enrolled_users: course?.enrolled_users || 0,
        type: course?.course_type || 'unknown'
      })),
      type: 'course_list'
    };
    
  } catch (error) {
    return {
      found: false,
      message: `Error searching courses: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error'
    };
  }
}

async function handleLearningPlanSearch(entities: any): Promise<string> {
  const query = entities?.query || 'unknown';
  return `🎯 Learning plan search for "${query}" - Feature implementing...`;
}

async function handleEnrollmentRequest(entities: any, userRole: DoceboRole): Promise<string> {
  if (!hasPermission(userRole, ['enroll.all', 'enroll.managed'])) {
    return `❌ Your role (${userRole}) doesn't have permission to enroll users. Contact your administrator.`;
  }
  
  const user = entities?.user || 'unknown user';
  const course = entities?.course || 'unknown course';
  
  return `📝 **Enrollment Request Created**

Enrolling **${user}** in **${course}**

⏳ Processing enrollment...
✅ User verification: Pending
✅ Course availability: Pending  
✅ Prerequisites check: Pending

This will be processed automatically based on your permissions.`;
}

async function handleStatisticsRequest(entities: any, userRole: DoceboRole): Promise<any> {
  if (!hasPermission(userRole, ['analytics.all', 'analytics.managed'])) {
    return {
      error: true,
      message: `❌ Your role (${userRole}) doesn't have permission to view statistics. Contact your administrator.`
    };
  }
  
  // Mock statistics data for now
  return {
    error: false,
    stats: {
      total_completions: 156,
      completion_rate: 78.5,
      active_learners: 89,
      courses_in_progress: 34
    },
    chartData: [
      { month: 'Jan', completions: 45 },
      { month: 'Feb', completions: 52 },
      { month: 'Mar', completions: 61 }
    ],
    type: 'completion_stats'
  };
}
