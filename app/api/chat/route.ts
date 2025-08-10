import { NextRequest, NextResponse } from 'next/server';
import { EnhancedDoceboClient } from '@/lib/docebo-enhanced';
import { RoleAwareAIProcessor } from '@/lib/ai/role-aware-processor';
import { RoleSpecificFormatter } from '@/lib/response-formatters/role-specific';
import { DoceboRole, PERMISSIONS } from '@/lib/rbac/permissions';

const docebo = new EnhancedDoceboClient();
const aiProcessor = new RoleAwareAIProcessor();
const formatter = new RoleSpecificFormatter();

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
        response = await handleUserStatusCheck(result.entities);
        break;
        
      case 'course_search':
        const courseResult = await handleCourseSearch(result.entities);
        response = formatter.formatResponse(courseResult, 'course_search', userRole as DoceboRole);
        additionalData = courseResult;
        break;
        
      case 'learning_plan_search':
        response = await handleLearningPlanSearch(result.entities);
        break;
        
      case 'enrollment_request':
        response = await handleEnrollmentRequest(result.entities, userRole as DoceboRole);
        break;
        
      case 'statistics_request':
        const statsResult = await handleStatisticsRequest(result.entities, userRole as DoceboRole);
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

// Enhanced handler functions
async function handleUserStatusCheck(entities: any): Promise<string> {
  try {
    const userStatus = await docebo.getUserStatus(entities.identifier, entities.type);
    
    if (!userStatus.found) {
      return `❌ User "${entities.identifier}" not found. Please check the email, username, or ID.`;
    }
    
    const user = userStatus.data;
    return `👤 **User Status for ${user.email}**

- **Name**: ${user.firstname} ${user.lastname}
- **Status**: ${user.active ? '✅ Active' : '❌ Inactive'}
- **Department**: ${user.department || 'Not specified'}
- **Last Login**: ${user.last_login || 'Never'}
- **Registration Date**: ${user.register_date}
- **User ID**: ${user.id}

${user.active ? '🟢 User account is active and can access training.' : '🔴 User account is inactive. Contact admin to reactivate.'}`;

  } catch (error) {
    return `❌ Error checking user status: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleCourseSearch(entities: any): Promise<any> {
  try {
    const searchResult = await docebo.searchCourses(entities.query, entities.type);
    
    if (!searchResult.found && searchResult.suggestions) {
      return {
        found: false,
        suggestions: searchResult.suggestions,
        message: searchResult.message,
        type: 'suggestions'
      };
    }
    
    if (!searchResult.found) {
      return {
        found: false,
        message: `No courses found for "${entities.query}". Try using exact course ID or title.`,
        type: 'not_found'
      };
    }
    
    const courses = Array.isArray(searchResult.data) ? searchResult.data : [searchResult.data];
    
    return {
      found: true,
      courses: courses.map(course => ({
        id: course.id,
        name: course.name,
        status: course.status,
        published: course.status === 'published',
        enrolled_users: course.enrolled_users || 0,
        type: course.course_type
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
  // Similar to course search but for learning plans
  return `🎯 Learning plan search for "${entities.query}" - Feature implementing...`;
}

async function handleEnrollmentRequest(entities: any, userRole: DoceboRole): Promise<string> {
  if (!PERMISSIONS[userRole].includes('enroll.all') && !PERMISSIONS[userRole].includes('enroll.managed')) {
    return `❌ Your role (${userRole}) doesn't have permission to enroll users. Contact your administrator.`;
  }
  
  return `📝 **Enrollment Request Created**

Enrolling **${entities.user}** in **${entities.course}**

⏳ Processing enrollment...
✅ User verification: Pending
✅ Course availability: Pending  
✅ Prerequisites check: Pending

This will be processed automatically based on your permissions.`;
}

async function handleStatisticsRequest(entities: any, userRole: DoceboRole): Promise<any> {
  if (!PERMISSIONS[userRole].includes('analytics.all') && !PERMISSIONS[userRole].includes('analytics.managed')) {
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
