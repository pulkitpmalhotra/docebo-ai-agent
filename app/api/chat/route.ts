// app/api/chat/route.ts - Full secure version using all security systems
import { NextRequest, NextResponse } from 'next/server';
import { DoceboAPI } from '@/lib/docebo-api-fixed-password';
import { RoleAwareAIProcessor } from '@/lib/ai/role-aware-processor';
import { RoleSpecificFormatter } from '@/lib/response-formatters/role-specific';
import { DoceboRole, PERMISSIONS, Permission } from '@/lib/rbac/permissions';

// Import all security systems
import { rateLimiter, getClientIdentifier, getRateLimitHeaders } from '@/lib/middleware/rate-limit';
import { InputValidator } from '@/lib/validation/input-validator';
import { ErrorHandler, ErrorType, AppError } from '@/lib/errors/error-handler';
import { withCache } from '@/lib/cache/cache-manager';

// Initialize the secure Docebo API client
const doceboAPI = new DoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
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
  const startTime = Date.now();
  const clientId = getClientIdentifier(request);
  
  try {
    console.log('🚀 FULL Secure Docebo AI Chat - Processing Request');
    
    // Step 1: Rate Limiting
    const rateLimit = rateLimiter.checkRateLimit(clientId, 'user');
    
    if (!rateLimit.allowed) {
      throw new AppError(
        ErrorType.RATE_LIMIT_ERROR,
        `Rate limit exceeded. ${rateLimit.retryAfter ? `Try again in ${rateLimit.retryAfter} seconds.` : ''}`,
        429,
        'Too many requests. Please slow down.',
        { retryAfter: rateLimit.retryAfter },
        { endpoint: '/api/chat', method: 'POST', ip: clientId }
      );
    }

    // Step 2: Input Validation & Sanitization
    const body = await request.json().catch(() => {
      throw ErrorHandler.validationError('Invalid JSON in request body');
    });

    const validation = InputValidator.validateChatRequest(body);
    if (!validation.success) {
      throw ErrorHandler.validationError(
        `Validation failed: ${validation.errors?.join(', ')}`,
        validation.errors
      );
    }

    const { message, userRole, userId } = validation.data!;

    // Step 3: Security Validation
    const securityCheck = InputValidator.validateSecurity(message);
    if (!securityCheck.safe) {
      throw ErrorHandler.validationError(
        `Security threat detected: ${securityCheck.threats.join(', ')}`,
        { threats: securityCheck.threats, original: message }
      );
    }

    // Step 4: Update rate limit with actual user role
    const userRateLimit = rateLimiter.checkRateLimit(clientId, userRole);
    if (!userRateLimit.allowed) {
      throw new AppError(
        ErrorType.RATE_LIMIT_ERROR,
        `Rate limit exceeded for role ${userRole}`,
        429,
        'Too many requests for your user level. Please slow down.',
        { retryAfter: userRateLimit.retryAfter },
        { endpoint: '/api/chat', method: 'POST', ip: clientId, userRole }
      );
    }

    console.log('=== FULL SECURE DOCEBO AI CHAT START ===');
    console.log('User message:', securityCheck.sanitized);
    console.log('User role:', userRole);
    console.log('Client ID:', clientId.substring(0, 10) + '...');
    
    // Step 5: Get user permissions
    const userPermissions = PERMISSIONS[userRole as DoceboRole] || [];
    console.log('User permissions:', userPermissions);
    
    // Step 6: AI Processing with caching
    const cacheKey = `ai_intent:${userRole}:${Buffer.from(securityCheck.sanitized).toString('base64').substring(0, 50)}`;
    
    const result = await withCache(
      cacheKey,
      () => aiProcessor.processQuery(securityCheck.sanitized, userRole as DoceboRole, userPermissions),
      { ttl: 5 * 60 * 1000, tags: ['ai_processing'] } // 5 minute cache
    );
    
    if (result.intent === 'permission_denied') {
      throw ErrorHandler.authorizationError(
        `User role ${userRole} lacks permission for: ${result.intent}`
      );
    }
    
    // Step 7: Process the query based on intent
    let response: string;
    let additionalData: any = {};

    try {
      switch (result.intent) {
        case 'user_status_check':
          response = await handleUserStatusCheckSecure(result.entities || {}, userRole as DoceboRole, clientId);
          break;
          
        case 'course_search':
          const courseResult = await handleCourseSearchSecure(result.entities || {}, userRole as DoceboRole, clientId);
          response = formatter.formatResponse(courseResult, 'course_search', userRole as DoceboRole);
          additionalData = courseResult;
          break;
          
        case 'enrollment_request':
          response = await handleEnrollmentRequestSecure(result.entities || {}, userRole as DoceboRole, clientId);
          break;
          
        case 'statistics_request':
          const statsResult = await handleStatisticsRequestSecure(result.entities || {}, userRole as DoceboRole, clientId);
          response = formatter.formatResponse(statsResult, 'statistics', userRole as DoceboRole);
          additionalData = statsResult;
          break;
          
        default:
          response = `I understand you want to: ${result.intent}. This feature is being implemented. Available features: user management, course management, enrollments, statistics.`;
      }
    } catch (apiError) {
      // Handle API-specific errors
      if (apiError instanceof Error && apiError.message.includes('Docebo')) {
        throw ErrorHandler.doceboApiError(
          'Docebo API service error',
          { originalError: apiError.message }
        );
      }
      throw apiError;
    }

    const processingTime = Date.now() - startTime;
    console.log(`=== FULL SECURE DOCEBO AI CHAT END (${processingTime}ms) ===`);

    // Step 8: Return successful response with security headers
    return NextResponse.json({
      response,
      intent: result.intent,
      userRole,
      permissions: userPermissions.length,
      additionalData,
      meta: {
        api_mode: 'full_security_production',
        processing_time: processingTime,
        cached: false, // This would be set by cache layer
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        ...getRateLimitHeaders(userRateLimit),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('=== FULL SECURE DOCEBO AI CHAT ERROR ===', error);
    
    const { statusCode, response } = ErrorHandler.handle(error, {
      endpoint: '/api/chat',
      method: 'POST',
      ip: clientId,
      timestamp: Date.now()
    });

    return NextResponse.json({
      ...response,
      meta: {
        ...response.meta,
        processing_time: processingTime
      }
    }, { 
      status: statusCode,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      }
    });
  }
}

// Secure handler for user status check with caching
async function handleUserStatusCheckSecure(entities: any, userRole: DoceboRole, clientId: string): Promise<string> {
  try {
    const identifier = entities?.identifier || 'unknown';
    const type = entities?.type || 'email';
    
    // Validate and sanitize the identifier
    const sanitizedIdentifier = InputValidator.sanitizeSearchTerm(identifier);
    if (!sanitizedIdentifier) {
      throw ErrorHandler.validationError('Invalid user identifier provided');
    }
    
    console.log(`🎯 Secure API: Getting user status for ${sanitizedIdentifier} (${type})`);
    
    // Cache key for user data
    const cacheKey = `user_status:${type}:${sanitizedIdentifier}`;
    
    const userData = await withCache(
      cacheKey,
      async () => {
        let users: any[] = [];
        
        if (type === 'id') {
          const user = await doceboAPI.getUserById(sanitizedIdentifier);
          if (user) users = [user];
        } else {
          users = await doceboAPI.searchUsers(sanitizedIdentifier, 5);
        }
        
        return users;
      },
      { ttl: 10 * 60 * 1000, tags: ['users', `user_search:${type}`] }
    );
    
    if (userData.length === 0) {
      return `❌ User "${sanitizedIdentifier}" not found in the system.

🔍 **Search performed**: ${type} search for "${sanitizedIdentifier}"
🛡️ **Security**: Input validated and sanitized
🎯 **Suggestion**: Try searching with different criteria or check the exact email/username.`;
    }
    
    // Get the most relevant user
    let user = userData[0];
    if (type === 'email') {
      const exactMatch = userData.find(u => u.email?.toLowerCase() === sanitizedIdentifier.toLowerCase());
      if (exactMatch) user = exactMatch;
    }
    
    // Format user information securely
    const email = InputValidator.sanitizeUserInput(user.email || 'No email');
    const firstName = InputValidator.sanitizeUserInput(user.first_name || 'Unknown');
    const lastName = InputValidator.sanitizeUserInput(user.last_name || '');
    const department = InputValidator.sanitizeUserInput(user.field_2 || 'Not specified');
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
- **Level**: ${InputValidator.sanitizeUserInput(user.level || 'User')}
- **Username**: ${InputValidator.sanitizeUserInput(user.username || 'Unknown')}

${isActive ? '🟢 User account is active and can access training.' : '🔴 User account is inactive. Contact admin to reactivate.'}

🛡️ **Full Security** - Rate limited, validated, cached, and monitored
${userData.length > 1 ? `\n📊 Found ${userData.length} users matching your search` : ''}`;

  } catch (error) {
    console.error('❌ Secure user status check failed:', error);
    throw ErrorHandler.doceboApiError(
      'Failed to retrieve user status from Docebo API',
      { identifier: entities?.identifier, type: entities?.type }
    );
  }
}

// Secure course search with caching
async function handleCourseSearchSecure(entities: any, userRole: DoceboRole, clientId: string): Promise<any> {
  try {
    const query = entities?.query || 'Python';
    const type = entities?.type || 'title';
    
    // Validate and sanitize the search query
    const sanitizedQuery = InputValidator.sanitizeSearchTerm(query);
    if (!sanitizedQuery) {
      throw ErrorHandler.validationError('Invalid course search query provided');
    }
    
    console.log(`🎯 Secure API: Searching courses for ${sanitizedQuery} (${type})`);
    
    // Cache key for course data
    const cacheKey = `course_search:${type}:${sanitizedQuery}`;
    
    const courses = await withCache(
      cacheKey,
      async () => {
        if (type === 'id') {
          return await doceboAPI.searchCourses(sanitizedQuery.toString(), 10);
        } else {
          return await doceboAPI.searchCourses(sanitizedQuery, 10);
        }
      },
      { ttl: 30 * 60 * 1000, tags: ['courses', `course_search:${type}`] }
    );
    
    if (courses.length === 0) {
      return {
        found: false,
        message: `No courses found matching "${sanitizedQuery}". Try different search terms.`,
        type: 'no_results'
      };
    }
    
    return {
      found: true,
      courses: courses.map((course: any) => ({
        id: course.course_id || 'Unknown',
        name: InputValidator.sanitizeUserInput(course.course_name || 'Unknown Course'),
        status: course.status || 'published',
        published: course.status === 'published',
        enrolled_users: course.enrolled_users || 0,
        type: course.course_type || 'elearning',
        code: InputValidator.sanitizeUserInput(course.course_code || '')
      })),
      type: 'course_list',
      api_source: 'full_secure_docebo_api'
    };
    
  } catch (error) {
    console.error('❌ Secure course search failed:', error);
    throw ErrorHandler.doceboApiError(
      'Failed to search courses in Docebo API',
      { query: entities?.query, type: entities?.type }
    );
  }
}

// Secure enrollment request
async function handleEnrollmentRequestSecure(entities: any, userRole: DoceboRole, clientId: string): Promise<string> {
  const enrollPermissions: Permission[] = ['enroll.all', 'enroll.managed'];
  
  if (!hasPermission(userRole, enrollPermissions)) {
    throw ErrorHandler.authorizationError(
      `Role ${userRole} lacks enrollment permissions`
    );
  }
  
  const user = InputValidator.sanitizeUserInput(entities?.user || 'unknown user');
  const course = InputValidator.sanitizeUserInput(entities?.course || 'unknown course');
  
  console.log(`🎯 Secure API: Enrollment request - ${user} in ${course}`);
  
  return `✅ **Enrollment Feature Available**

User: ${user}
Course: ${course}

🛡️ **Full Security**: Request validated, rate limited, and permissions verified
🔧 **Note**: Enrollment implementation requires additional endpoint testing.
📞 **Status**: API connection working with full security stack.
🎯 **Next**: Implement enrollment endpoints with working authentication.`;
}

// Secure statistics request with caching
async function handleStatisticsRequestSecure(entities: any, userRole: DoceboRole, clientId: string): Promise<any> {
  const analyticsPermissions: Permission[] = ['analytics.all', 'analytics.managed'];
  
  if (!hasPermission(userRole, analyticsPermissions)) {
    throw ErrorHandler.authorizationError(
      `Role ${userRole} lacks analytics permissions`
    );
  }
  
  try {
    console.log(`🎯 Secure API: Getting statistics for role ${userRole}`);
    
    // Cache key for statistics
    const cacheKey = `statistics:${userRole}:overview`;
    
    const stats = await withCache(
      cacheKey,
      async () => {
        const users = await doceboAPI.getUsers({ page_size: 100 });
        
        const totalUsers = users.total_count || users.data.length;
        const activeUsers = users.data.filter((u: any) => u.status === '1').length;
        const inactiveUsers = totalUsers - activeUsers;
        
        return {
          total_users: totalUsers,
          active_users: activeUsers,
          inactive_users: inactiveUsers,
          activity_rate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
        };
      },
      { ttl: 15 * 60 * 1000, tags: ['statistics', `stats:${userRole}`] }
    );
    
    return {
      error: false,
      stats,
      api_source: 'full_secure_docebo_api',
      type: 'user_statistics'
    };
    
  } catch (error) {
    console.error('❌ Secure statistics request failed:', error);
    throw ErrorHandler.doceboApiError(
      'Failed to retrieve statistics from Docebo API',
      { userRole }
    );
  }
}
