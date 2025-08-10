// app/api/chat/route.ts - Updated to use working password authentication

import { NextRequest, NextResponse } from 'next/server';
import { DoceboAPI } from '@/lib/docebo-api-fixed-password';  // Use the working version
import { RoleAwareAIProcessor } from '@/lib/ai/role-aware-processor';
import { RoleSpecificFormatter } from '@/lib/response-formatters/role-specific';
import { DoceboRole, PERMISSIONS, Permission } from '@/lib/rbac/permissions';

// Initialize the WORKING Docebo API client with password authentication
const doceboAPI = new DoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,   // Required for working auth
  password: process.env.DOCEBO_PASSWORD!,   // Required for working auth
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
    console.log('🚀 WORKING Docebo API Chat Endpoint - Processing Request');
    
    const { message, userRole = 'superadmin', userId = 'demo-user' } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('=== WORKING DOCEBO API CHAT START ===');
    console.log('User message:', message);
    console.log('User role:', userRole);
    
    // Get user permissions based on role
    const userPermissions = PERMISSIONS[userRole as DoceboRole] || [];
    console.log('User permissions:', userPermissions);
    
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
        response = `I understand you want to: ${result.intent}. This feature is being implemented. Available features: user management, course management, enrollments, statistics.`;
    }

    console.log('=== WORKING DOCEBO API CHAT END ===');

    return NextResponse.json({
      response,
      intent: result.intent,
      userRole,
      permissions: userPermissions.length,
      additionalData,
      api_mode: 'production_password_auth',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== WORKING DOCEBO API CHAT ERROR ===', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'Sorry, I encountered an error processing your request.',
      details: errorMessage,
      api_mode: 'production_password_auth',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// WORKING handler for user status check
async function handleUserStatusCheck(entities: any, userRole: DoceboRole): Promise<string> {
  try {
    const identifier = entities?.identifier || 'susantha@google.com';
    const type = entities?.type || 'email';
    
    console.log(`🎯 WORKING API: Getting user status for ${identifier} (${type})`);
    
    let users: any[] = [];
    
    if (type === 'id') {
      const user = await doceboAPI.getUserById(identifier);
      if (user) users = [user];
    } else {
      // Search by email or other identifier
      users = await doceboAPI.searchUsers(identifier, 5);
    }
    
    if (users.length === 0) {
      return `❌ User "${identifier}" not found in the system.

🔍 **Search performed**: ${type} search for "${identifier}"
📊 **API Status**: Working with password authentication
🎯 **Suggestion**: Try searching with different criteria or check the exact email/username.`;
    }
    
    // Get the most relevant user (exact match preferred)
    let user = users[0];
    if (type === 'email') {
      const exactMatch = users.find(u => u.email?.toLowerCase() === identifier.toLowerCase());
      if (exactMatch) user = exactMatch;
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
- **Username**: ${user.username || 'Unknown'}

${isActive ? '🟢 User account is active and can access training.' : '🔴 User account is inactive. Contact admin to reactivate.'}

✅ **Live Docebo API** - Real data retrieved successfully
${users.length > 1 ? `\n📊 Found ${users.length} users matching your search` : ''}`;

  } catch (error) {
    console.error('❌ WORKING API user status check failed:', error);
    return `❌ Error checking user status: ${error instanceof Error ? error.message : 'Unknown error'}

🔧 **Debug Info**: Using password authentication, but encountered an API error.`;
  }
}

async function handleCourseSearch(entities: any, userRole: DoceboRole): Promise<any> {
  try {
    const query = entities?.query || 'Python';
    const type = entities?.type || 'title';
    
    console.log(`🎯 WORKING API: Searching courses for ${query} (${type})`);
    
    let courses: any[] = [];
    
    if (type === 'id') {
      // Search by course ID (convert to string)
      courses = await doceboAPI.searchCourses(query.toString(), 10);
    } else {
      // Search by title/name
      courses = await doceboAPI.searchCourses(query, 10);
    }
    
    if (courses.length === 0) {
      return {
        found: false,
        message: `No courses found matching "${query}". Try different search terms.`,
        type: 'no_results'
      };
    }
    
    return {
      found: true,
      courses: courses.map((course: any) => ({
        id: course.course_id || 'Unknown',
        name: course.course_name || 'Unknown Course',
        status: course.status || 'published',
        published: course.status === 'published',
        enrolled_users: course.enrolled_users || 0,
        type: course.course_type || 'elearning',
        code: course.course_code || ''
      })),
      type: 'course_list',
      api_source: 'working_docebo_api'
    };
    
  } catch (error) {
    console.error('❌ WORKING API course search failed:', error);
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
    
    console.log(`🎯 WORKING API: Enrolling ${user} in ${course}`);
    
    return `✅ **Enrollment Feature Available**

User: ${user}
Course: ${course}

🔧 **Note**: Enrollment implementation requires additional endpoint testing.
📞 **Status**: API connection working with password authentication.
🎯 **Next**: Implement enrollment endpoints with working authentication.`;
    
  } catch (error) {
    console.error('❌ WORKING API enrollment failed:', error);
    return `❌ Error processing enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    console.log(`🎯 WORKING API: Getting statistics`);
    
    // Get some basic user statistics
    const users = await doceboAPI.getUsers({ page_size: 100 });
    
    const totalUsers = users.total_count || users.data.length;
    const activeUsers = users.data.filter((u: any) => u.status === '1').length;
    const inactiveUsers = totalUsers - activeUsers;
    
    return {
      error: false,
      stats: {
        total_users: totalUsers,
        active_users: activeUsers,
        inactive_users: inactiveUsers,
        activity_rate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
      },
      api_source: 'working_docebo_api',
      type: 'user_statistics'
    };
    
  } catch (error) {
    console.error('❌ WORKING API statistics failed:', error);
    return {
      error: true,
      message: `Error getting statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
