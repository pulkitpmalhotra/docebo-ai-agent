import { NextRequest, NextResponse } from 'next/server';
import { DoceboChatAPI } from '@/lib/docebo-chat-api';
import { RoleAwareAIProcessor } from '@/lib/ai/role-aware-processor';
import { RoleSpecificFormatter } from '@/lib/response-formatters/role-specific';
import { DoceboRole, PERMISSIONS, Permission } from '@/lib/rbac/permissions';

// Initialize the real Docebo API client
const doceboAPI = new DoceboChatAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME,
  password: process.env.DOCEBO_PASSWORD
});

const aiProcessor = new RoleAwareAIProcessor();
const formatter = new RoleSpecificFormatter();

// Helper function for permission checking
function hasPermission(userRole: DoceboRole, requiredPermissions: Permission[]): boolean {
  const userPermissions = PERMISSIONS[userRole];
  if (!userPermissions) return false;
  
  return requiredPermissions.some((permission: Permission) => 
    userPermissions.includes(permission)
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Real Docebo API Chat Endpoint - Processing Request');
    
    const { message, userRole = 'superadmin', userId = 'demo-user' } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('=== REAL DOCEBO API CHAT START ===');
    console.log('User message:', message);
    console.log('User role:', userRole);
    
    // Get user permissions based on role
    const userPermissions = PERMISSIONS[userRole as DoceboRole] || [];
    console.log('User permissions:', userPermissions);
    
    // Check if this is a direct API command
    if (isDirectAPICommand(message)) {
      return await handleDirectAPICommand(message, userRole as DoceboRole, userPermissions);
    }
    
    // Process with role-aware AI for natural language queries
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
        response = await handleUserStatusCheck(result.entities || {}, userRole as DoceboRole);
        break;
        
      case 'course_search':
        const courseResult = await handleCourseSearch(result.entities || {}, userRole as DoceboRole);
        response = formatter.formatResponse(courseResult, 'course_search', userRole as DoceboRole);
        additionalData = courseResult;
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
        // Try to process as natural language API command
        try {
          const apiResponse = await doceboAPI.processNaturalLanguageQuery(message);
          response = doceboAPI.formatResponseForChat(apiResponse);
          additionalData = apiResponse;
        } catch (error) {
          response = `I understand you want to: ${result.intent}. This feature is being implemented. Available features: user management, course management, enrollments, statistics.`;
        }
    }

    console.log('=== REAL DOCEBO API CHAT END ===');

    return NextResponse.json({
      response,
      intent: result.intent,
      userRole,
      permissions: userPermissions.length,
      additionalData,
      api_mode: 'production',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== REAL DOCEBO API CHAT ERROR ===', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'Sorry, I encountered an error processing your request.',
      details: errorMessage,
      api_mode: 'production',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Check if message is a direct API command
function isDirectAPICommand(message: string): boolean {
  const apiCommands = [
    'get user', 'create user', 'update user', 'delete user',
    'get course', 'create course', 'update course', 'delete course',
    'enroll', 'unenroll', 'get enrollment', 'bulk'
  ];
  
  const msgLower = message.toLowerCase();
  return apiCommands.some(cmd => msgLower.includes(cmd));
}

// Handle direct API commands
async function handleDirectAPICommand(
  message: string, 
  userRole: DoceboRole, 
  userPermissions: Permission[]
): Promise<NextResponse> {
  try {
    // Check permissions for API operations
    const requiredPermissions: Permission[] = ['user.search', 'course.search', 'enroll.all'];
    if (!hasPermission(userRole, requiredPermissions)) {
      return NextResponse.json({
        response: `❌ Your role (${userRole}) doesn't have permission for direct API operations. Contact your administrator.`,
        intent: 'permission_denied',
        userRole,
        api_mode: 'production',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🎯 Processing direct API command:', message);
    
    const apiResponse = await doceboAPI.processNaturalLanguageQuery(message);
    const formattedResponse = doceboAPI.formatResponseForChat(apiResponse);
    
    return NextResponse.json({
      response: formattedResponse,
      intent: 'direct_api_command',
      userRole,
      api_response: apiResponse,
      api_mode: 'production',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Direct API command failed:', error);
    
    return NextResponse.json({
      response: `❌ **API Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      intent: 'api_error',
      userRole,
      api_mode: 'production',
      timestamp: new Date().toISOString()
    });
  }
}

// Enhanced handler functions that use real API
async function handleUserStatusCheck(entities: any, userRole: DoceboRole): Promise<string> {
  try {
    const identifier = entities?.identifier || 'john.smith@company.com';
    const type = entities?.type || 'email';
    
    console.log(`🎯 Real API: Getting user status for ${identifier} (${type})`);
    
    let apiResponse;
    if (type === 'id') {
      apiResponse = await doceboAPI.processNaturalLanguageQuery(`get user ${identifier}`);
    } else {
      apiResponse = await doceboAPI.processNaturalLanguageQuery(`get user ${identifier}`);
    }
    
    if (!apiResponse.success) {
      return `❌ User "${identifier}" not found. ${apiResponse.message}`;
    }
    
    const user = Array.isArray(apiResponse.data) ? apiResponse.data[0] : apiResponse.data;
    
    if (!user) {
      return `❌ User "${identifier}" not found in the system.`;
    }
    
    // Format user information
    const email = user.email || 'No email';
    const firstName = user.first_name || 'Unknown';
    const lastName = user.last_name || '';
    const department = user.field_2 || 'Not specified';
    const lastLogin = user.last_access_date ? new Date(user.last_access_date).toLocaleDateString() : 'Never';
    const registerDate = user.creation_date ? new Date(user.creation_date).toLocaleDateString() : 'Unknown';
    const userId = user.user_id || 'Unknown';
    const isActive = user.status === '1' || user.status === 'active';

    return `👤 **User Status for ${email}**

- **Name**: ${firstName} ${lastName}
- **Status**: ${isActive ? '✅ Active' : '❌ Inactive'}
- **Department**: ${department}
- **Last Login**: ${lastLogin}
- **Registration Date**: ${registerDate}
- **User ID**: ${userId}
- **Level**: ${user.level || 'User'}

${isActive ? '🟢 User account is active and can access training.' : '🔴 User account is inactive. Contact admin to reactivate.'}

🔗 **Real Docebo API** - Live data from your platform`;

  } catch (error) {
    console.error('❌ Real API user status check failed:', error);
    return `❌ Error checking user status via API: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleCourseSearch(entities: any, userRole: DoceboRole): Promise<any> {
  try {
    const query = entities?.query || 'Python';
    const type = entities?.type || 'title';
    
    console.log(`🎯 Real API: Searching courses for ${query} (${type})`);
    
    const apiResponse = await doceboAPI.processNaturalLanguageQuery(`get course ${query}`);
    
    if (!apiResponse.success) {
      return {
        found: false,
        message: apiResponse.message,
        type: 'api_error'
      };
    }
    
    const courses = Array.isArray(apiResponse.data) ? apiResponse.data : [apiResponse.data];
    
    return {
      found: true,
      courses: courses.map((course: any) => ({
        id: course.course_id || 'Unknown',
        name: course.course_name || 'Unknown Course',
        status: course.status || 'published',
        published: course.status === 'published',
        enrolled_users: course.enrolled_users || 0,
        type: course.course_type || 'elearning'
      })),
      type: 'course_list',
      api_source: 'real_docebo_api'
    };
    
  } catch (error) {
    console.error('❌ Real API course search failed:', error);
    return {
      found: false,
      message: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'api_error'
    };
  }
}

async function handleEnrollmentRequest(entities: any, userRole: DoceboRole): Promise<string> {
  const enrollPermissions: Permission[] = ['enroll.all', 'enroll.managed'];
  
  if (!hasPermission(userRole, enrollPermissions)) {
    return `❌ Your role (${userRole}) doesn't have permission to enroll users. Contact your administrator.`;
  }
  
  try {
    const user = entities?.user || 'unknown user';
    const course = entities?.course || 'unknown course';
    
    console.log(`🎯 Real API: Enrolling ${user} in ${course}`);
    
    const apiResponse = await doceboAPI.processNaturalLanguageQuery(`enroll ${user} in ${course}`);
    
    if (apiResponse.success) {
      return `✅ **Enrollment Successful**

${apiResponse.message}

🔗 **Real Docebo API** - Enrollment processed on your platform`;
    } else {
      return `❌ **Enrollment Failed**

${apiResponse.message}

Please check user and course details and try again.`;
    }
    
  } catch (error) {
    console.error('❌ Real API enrollment failed:', error);
    return `❌ Error processing enrollment via API: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleStatisticsRequest(entities: any, userRole: DoceboRole): Promise<any> {
  const analyticsPermissions: Permission[] = ['analytics.all', 'analytics.managed'];
  
  if (!hasPermission(userRole, analyticsPermissions)) {
    return {
      error: true,
      message: `❌ Your role (${userRole}) doesn't have permission to view statistics. Contact your administrator.`
    };
  }
  
  try {
    console.log(`🎯 Real API: Getting statistics`);
    
    const apiResponse = await doceboAPI.processNaturalLanguageQuery('get enrollments');
    
    if (apiResponse.success) {
      const enrollments = apiResponse.data || [];
      
      // Calculate basic statistics from real data
      const totalEnrollments = enrollments.length;
      const completedEnrollments = enrollments.filter((e: any) => e.completion_status === 'completed').length;
      const completionRate = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;
      
      return {
        error: false,
        stats: {
          total_enrollments: totalEnrollments,
          completed_enrollments: completedEnrollments,
          completion_rate: Math.round(completionRate * 10) / 10,
          active_enrollments: enrollments.filter((e: any) => e.enrollment_status === 'in_progress').length
        },
        api_source: 'real_docebo_api',
        type: 'real_time_stats'
      };
    } else {
      return {
        error: true,
        message: `API Error: ${apiResponse.message}`
      };
    }
    
  } catch (error) {
    console.error('❌ Real API statistics failed:', error);
    return {
      error: true,
      message: `Error getting statistics via API: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
