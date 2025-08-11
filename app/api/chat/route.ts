// app/api/chat/route.ts - Minimal secure version (fixed)
import { NextRequest, NextResponse } from 'next/server';
import { DoceboAPI } from '@/lib/docebo-api-fixed-password';
import { RoleAwareAIProcessor } from '@/lib/ai/role-aware-processor';
import { RoleSpecificFormatter } from '@/lib/response-formatters/role-specific';
import { DoceboRole, PERMISSIONS, Permission } from '@/lib/rbac/permissions';

// Initialize the working Docebo API client
const doceboAPI = new DoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
});

const aiProcessor = new RoleAwareAIProcessor();
const formatter = new RoleSpecificFormatter();

// Simple validation function
function validateMessage(message: any): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message must be a string' };
  }
  
  if (message.length > 2000) {
    return { valid: false, error: 'Message too long (max 2000 characters)' };
  }
  
  // Basic security checks
  if (message.includes('<script>') || message.includes('javascript:')) {
    return { valid: false, error: 'Message contains potentially dangerous content' };
  }
  
  return { valid: true };
}

// Simple sanitization
function sanitizeMessage(message: string): string {
  return message
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/[<>'"]/g, '')
    .trim()
    .substring(0, 2000);
}

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
    console.log('🚀 Minimal Secure Docebo AI Chat - Processing Request');
    
    const body = await request.json();
    const { message, userRole = 'user', userId = 'demo-user' } = body;

    // Basic validation
    const validation = validateMessage(message);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Sanitize message
    const sanitizedMessage = sanitizeMessage(message);

    console.log('=== MINIMAL SECURE CHAT START ===');
    console.log('User message:', sanitizedMessage);
    console.log('User role:', userRole);
    
    // Get user permissions based on role
    const userPermissions = PERMISSIONS[userRole as DoceboRole] || [];
    console.log('User permissions:', userPermissions);
    
    // Process with role-aware AI
    const result = await aiProcessor.processQuery(sanitizedMessage, userRole as DoceboRole, userPermissions);
    
    if (result.intent === 'permission_denied') {
      return NextResponse.json({
        response: result.message || `Your role (${userRole}) doesn't have permission for this action.`,
        intent: 'permission_denied',
        userRole,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }
    
    // Process the query based on intent
    let response: string;
    let additionalData: any = {};

    try {
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
    } catch (apiError) {
      console.error('API Error:', apiError);
      return NextResponse.json({
        error: 'Sorry, I encountered an error with the Docebo API.',
        details: apiError instanceof Error ? apiError.message : 'Unknown API error',
        meta: {
          api_mode: 'minimal_secure',
          timestamp: new Date().toISOString()
        }
      }, { status: 502 });
    }

    console.log('=== MINIMAL SECURE CHAT END ===');

    return NextResponse.json({
      response,
      intent: result.intent,
      userRole,
      permissions: userPermissions.length,
      additionalData,
      meta: {
        api_mode: 'minimal_secure',
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('=== MINIMAL SECURE CHAT ERROR ===', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'Sorry, I encountered an error processing your request.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error',
      meta: {
        api_mode: 'minimal_secure',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

// Simplified handlers (same as before but without advanced error handling)
async function handleUserStatusCheck(entities: any, userRole: DoceboRole): Promise<string> {
  try {
    const identifier = entities?.identifier || 'susantha@google.com';
    const type = entities?.type || 'email';
    
    console.log(`🎯 Getting user status for ${identifier} (${type})`);
    
    let users: any[] = [];
    
    if (type === 'id') {
      const user = await doceboAPI.getUserById(identifier);
      if (user) users = [user];
    } else {
      users = await doceboAPI.searchUsers(identifier, 5);
    }
    
    if (users.length === 0) {
      return `❌ User "${identifier}" not found in the system.

🔍 **Search performed**: ${type} search for "${identifier}"
🛡️ **Security**: Input validated and sanitized
🎯 **Suggestion**: Try searching with different criteria or check the exact email/username.`;
    }
    
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

🛡️ **Secure Docebo API** - Minimal security implementation
${users.length > 1 ? `\n📊 Found ${users.length} users matching your search` : ''}`;

  } catch (error) {
    console.error('❌ User status check failed:', error);
    throw new Error(`Failed to get user status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleCourseSearch(entities: any, userRole: DoceboRole): Promise<any> {
  try {
    const query = entities?.query || 'Python';
    const type = entities?.type || 'title';
    
    console.log(`🎯 Searching courses for ${query} (${type})`);
    
    let courses: any[] = [];
    
    if (type === 'id') {
      courses = await doceboAPI.searchCourses(query.toString(), 10);
    } else {
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
      api_source: 'minimal_secure_api'
    };
    
  } catch (error) {
    console.error('❌ Course search failed:', error);
    throw new Error(`Failed to search courses: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleEnrollmentRequest(entities: any, userRole: DoceboRole): Promise<string> {
  const enrollPermissions: Permission[] = ['enroll.all', 'enroll.managed'];
  
  if (!hasPermission(userRole, enrollPermissions)) {
    return `❌ Your role (${userRole}) doesn't have permission to enroll users. Contact your administrator.`;
  }
  
  const user = entities?.user || 'unknown user';
  const course = entities?.course || 'unknown course';
  
  return `✅ **Enrollment Feature Available**

User: ${user}
Course: ${course}

🛡️ **Security**: Request validated and permissions verified
🔧 **Note**: Enrollment implementation requires additional endpoint testing.
📞 **Status**: API connection working with secure authentication.
🎯 **Next**: Implement enrollment endpoints with working authentication.`;
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
    console.log(`🎯 Getting statistics for role ${userRole}`);
    
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
      api_source: 'minimal_secure_api',
      type: 'user_statistics'
    };
    
  } catch (error) {
    console.error('❌ Statistics request failed:', error);
    throw new Error(`Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
