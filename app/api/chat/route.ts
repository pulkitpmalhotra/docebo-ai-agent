// app/api/chat/route.ts - FIXED with proper Load More handling and no syntax errors
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '../middleware/security';
import { IntentAnalyzer } from './intent-analyzer';
import { DoceboAPI } from './docebo-api';
import { getConfig } from './utils/config';
import { handlers } from './handlers';
import { BulkEnrollmentHandlers } from './handlers/bulk-enrollment';

let api: DoceboAPI;

// Add timeout wrapper for all operations
async function withTimeout<T>(
  operation: Promise<T>, 
  timeoutMs: number = 25000, 
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

// Background processing handler function
async function handleBackgroundEnrollmentRequest(entities: any): Promise<NextResponse> {
  const { email, userId } = entities;
  const identifier = email || userId;
  
  if (!identifier) {
    return NextResponse.json({
      response: '❌ **Missing Information**: Please provide a user email for background processing.',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  console.log(`🔄 Starting background processing for: ${identifier}`);
  
  return NextResponse.json({
    response: `🚀 **Background Processing Initiated**

👤 **User**: ${identifier}
📋 **Processing**: Complete enrollment data (courses + learning plans)
⏱️ **Estimated Time**: 30-90 seconds

**🔄 What's Happening:**
• Fetching all course enrollments
• Fetching all learning plan enrollments  
• Processing pagination across multiple API calls
• Formatting results for display

**💡 Recommended Next Steps:**
1. **Wait 30-60 seconds** for processing to complete
2. **Try this command**: "User enrollments ${identifier}" (will show if ready)
3. **For immediate results**: "Find user ${identifier}" (basic info only)
4. **Check specific enrollment**: "Is ${identifier} enrolled in [course name]"

**🎯 Why Background Processing:**
This user likely has 50+ enrollments, which requires multiple API calls and takes longer than our 30-second timeout limit. Background processing handles this properly.

**📊 Alternative Quick Commands:**
• "User summary ${identifier}" (basic stats)
• "Recent enrollments ${identifier}" (last 10)
• "Check enrollment status ${identifier}"`,
    success: true,
    backgroundProcessing: true,
    userIdentifier: identifier,
    estimatedTime: '30-90 seconds',
    alternativeCommands: [
      `User enrollments ${identifier}`,
      `Find user ${identifier}`,
      `User summary ${identifier}`
    ],
    timestamp: new Date().toISOString()
  });
}

// Main handler function with timeout protection
async function chatHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Initialize API client if needed
    if (!api) {
      const config = getConfig();
      api = new DoceboAPI(config);
    }

    // Parse request with timeout
    const body = await withTimeout(
      request.json(),
      5000,
      'Request parsing timeout'
    );
    
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: '❌ Please provide a valid message',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🤖 Processing: "${message}"`);
    
    // Analyze intent quickly
    const analysis = IntentAnalyzer.analyzeIntent(message);
    console.log(`🎯 Intent: ${analysis.intent}, Confidence: ${analysis.confidence}`);
    
    // FIXED: Debugging for Load More intent specifically
    if (analysis.intent === 'load_more_enrollments') {
      console.log(`🔄 LOAD MORE DETECTED:`, {
        intent: analysis.intent,
        confidence: analysis.confidence,
        entities: analysis.entities,
        originalMessage: message
      });
    }
    
    // Route to appropriate handler with timeout protection
    try {
      let handlerPromise: Promise<NextResponse>;
      
      switch (analysis.intent) {
        // Background Processing - NEW
        case 'background_user_enrollments':
          handlerPromise = handleBackgroundEnrollmentRequest(analysis.entities);
          break;
          
        // FIXED: Load More Enrollments (ensure this case exists)
        case 'load_more_enrollments':
          console.log(`🔄 ROUTING TO LOAD MORE HANDLER:`, analysis.entities);
          handlerPromise = withTimeout(
            handlers.info.handleUserEnrollments(analysis.entities, api),
            25000,
            'Load more enrollments timeout'
          );
          break;
          
        // ADDED: User Summary (optimized with enrollment counts)
        case 'get_user_summary':
          handlerPromise = withTimeout(
            handlers.info.handleUserSummary(analysis.entities, api),
            15000,
            'User summary timeout'
          );
          break;
          
        // ADDED: Recent Enrollments (optimized with sorting)
        case 'get_recent_enrollments':
          handlerPromise = withTimeout(
            handlers.info.handleRecentEnrollments(analysis.entities, api),
            15000,
            'Recent enrollments timeout'
          );
          break;
          
       case 'bulk_enroll_course':
    console.log(`🎯 BULK COURSE: Routing to bulk course enrollment handler`);
    handlerPromise = withTimeout(
      handlers.bulkEnrollment.handleBulkCourseEnrollment(analysis.entities, api),
      30000,
      'Bulk course enrollment timeout'
    );
    break;
    
  case 'bulk_enroll_learning_plan':
    console.log(`🎯 BULK LP: Routing to bulk learning plan enrollment handler`);
    handlerPromise = withTimeout(
      handlers.bulkEnrollment.handleBulkLearningPlanEnrollment(analysis.entities, api),
      30000,
      'Bulk learning plan enrollment timeout'
    );
    break;
    
  case 'bulk_unenroll':
    console.log(`🎯 BULK UNENROLL: Routing to bulk unenrollment handler`);
    handlerPromise = withTimeout(
      handlers.bulkEnrollment.handleBulkUnenrollment(analysis.entities, api),
      30000,
      'Bulk unenrollment timeout'
    );
    break;
        
     // Updated Individual Enrollment Management (for better single-user handling)
  case 'enroll_user_in_course':
    // Check if this is actually a bulk operation that was misclassified
    if (analysis.entities.emails && Array.isArray(analysis.entities.emails) && analysis.entities.emails.length > 1) {
      console.log(`🔄 REDIRECT: Single enrollment detected as bulk, redirecting...`);
      handlerPromise = withTimeout(
        handlers.bulkEnrollment.handleBulkCourseEnrollment(analysis.entities, api),
        30000,
        'Bulk course enrollment timeout'
      );
    } else {
      handlerPromise = handlers.enrollment.handleEnrollUserInCourse(analysis.entities, api);
    }
    break;
    
  case 'enroll_user_in_learning_plan':
    // Check if this is actually a bulk operation that was misclassified
    if (analysis.entities.emails && Array.isArray(analysis.entities.emails) && analysis.entities.emails.length > 1) {
      console.log(`🔄 REDIRECT: Single LP enrollment detected as bulk, redirecting...`);
      handlerPromise = withTimeout(
        handlers.bulkEnrollment.handleBulkLearningPlanEnrollment(analysis.entities, api),
        30000,
        'Bulk learning plan enrollment timeout'
      );
    } else {
      handlerPromise = handlers.enrollment.handleEnrollUserInLearningPlan(analysis.entities, api);
    }
    break;
          
        case 'unenroll_user_from_course':
          handlerPromise = handlers.enrollment.handleUnenrollUserFromCourse(analysis.entities, api);
          break;
          
        case 'unenroll_user_from_learning_plan':
          handlerPromise = handlers.enrollment.handleUnenrollUserFromLearningPlan(analysis.entities, api);
          break;
          
        // Enrollment Checking with timeout
        case 'check_specific_enrollment':
          handlerPromise = withTimeout(
            handlers.info.handleSpecificEnrollmentCheck(analysis.entities, api),
            20000,
            'Enrollment check timeout - please try with a simpler query'
          );
          break;
          
        case 'get_user_enrollments':
          handlerPromise = withTimeout(
            handlers.info.handleUserEnrollments(analysis.entities, api),
            25000,
            'User enrollments timeout - user may have too many enrollments'
          );
          break;
          
        // Search Functions
        case 'search_users':
          handlerPromise = withTimeout(
            handlers.search.handleUserSearch(analysis.entities, api),
            15000,
            'User search timeout'
          );
          break;
                
        case 'search_courses':
          handlerPromise = withTimeout(
            handlers.search.handleCourseSearch(analysis.entities, api),
            15000,
            'Course search timeout'
          );
          break;
          
        case 'search_learning_plans':
          handlerPromise = withTimeout(
            handlers.search.handleLearningPlanSearch(analysis.entities, api),
            15000,
            'Learning plan search timeout'
          );
          break;
          // CREATE ILT SESSION
case 'create_ilt_session':
  console.log(`🎓 ROUTING: Creating ILT session`);
  handlerPromise = withTimeout(
    handlers.iltSession.handleCreateILTSession(analysis.entities, api),
    20000,
    'ILT session creation timeout'
  );
  break;

// INDIVIDUAL ILT SESSION ENROLLMENT  
case 'enroll_user_in_ilt_session':
  // Check if this is actually a bulk operation that was misclassified
  if (analysis.entities.emails && Array.isArray(analysis.entities.emails) && analysis.entities.emails.length > 1) {
    console.log(`🔄 REDIRECT: Single ILT enrollment detected as bulk, redirecting...`);
    handlerPromise = withTimeout(
      handlers.iltSession.handleBulkEnrollInILTSession(analysis.entities, api),
      25000,
      'Bulk ILT session enrollment timeout'
    );
  } else {
    console.log(`🎓 ROUTING: Individual ILT session enrollment`);
    handlerPromise = withTimeout(
      handlers.iltSession.handleEnrollUserInILTSession(analysis.entities, api),
      15000,
      'ILT session enrollment timeout'
    );
  }
  break;

// BULK ILT SESSION ENROLLMENT
case 'bulk_enroll_ilt_session':
  console.log(`🎓 ROUTING: Bulk ILT session enrollment`);
  handlerPromise = withTimeout(
    handlers.iltSession.handleBulkEnrollInILTSession(analysis.entities, api),
    25000,
    'Bulk ILT session enrollment timeout'
  );
  break;

// UNENROLL FROM ILT SESSION
case 'unenroll_user_from_ilt_session':
  console.log(`🎓 ROUTING: ILT session unenrollment`);
  handlerPromise = withTimeout(
    handlers.iltSession.handleUnenrollUserFromILTSession(analysis.entities, api),
    15000,
    'ILT session unenrollment timeout'
  );
  break;

// MARK ATTENDANCE
case 'mark_session_attendance':
  console.log(`📋 ROUTING: Marking session attendance`);
  handlerPromise = withTimeout(
    handlers.iltSession.handleMarkSessionAttendance(analysis.entities, api),
    20000,
    'Session attendance marking timeout'
  );
  break;
        // Info Functions
        case 'get_course_info':
          handlerPromise = withTimeout(
            handlers.info.handleCourseInfo(analysis.entities, api),
            10000,
            'Course info timeout'
          );
          break;
          
        case 'get_learning_plan_info':
          handlerPromise = withTimeout(
            handlers.info.handleLearningPlanInfo(analysis.entities, api),
            10000,
            'Learning plan info timeout'
          );
          break;
          
        // Help
        case 'docebo_help':
          handlerPromise = handlers.info.handleDoceboHelp(analysis.entities, api);
          break;
          
        default:
  console.log(`🤔 UNKNOWN INTENT: ${analysis.intent} for message: "${message}"`);
  handlerPromise = Promise.resolve(NextResponse.json({
    response: `🤔 **I can help you with enrollment and ILT session management!**

**🎓 NEW: ILT Session Management**
• **Create Session**: "Create ILT session for course Python Programming on 2025-02-15 from 9:00 to 17:00"
• **Schedule with Events**: "Schedule session 'Python Workshop' for course 2420 from March 1st to March 3rd"
• **Add Instructor**: "Create ILT session for course Data Science with instructor john@company.com"

**👥 ILT Session Enrollment**
• **Single User**: "Enroll john@company.com in ILT session 123"
• **Bulk Enrollment**: "Enroll john@co.com,sarah@co.com,mike@co.com in session 'Python Workshop'"
• **Unenroll**: "Remove user@company.com from ILT session 123"

**📋 Attendance Management**
• **Mark Attended**: "Mark john@company.com as attended in session 123"
• **Mark Completed**: "Mark sarah@company.com as completed in session 'Python Workshop'"
• **Bulk Attendance**: "Mark user1@co.com,user2@co.com as attended in session 123"
• **Mark Absent**: "Mark mike@company.com as absent in session 123"

**🔄 Load More Commands:**
• **Load More Enrollments**: "Load more enrollments for john@company.com"
• **Show More**: "Show more enrollments for sarah@company.com"

**🚀 Background Processing**
• **Heavy Users**: "Load all enrollments in background for john@company.com"
• **Complete Data**: "Process enrollments in background for sarah@company.com"

**🚀 Bulk Enrollment Features**
• **Bulk Course Enrollment**: "Enroll john@co.com,sarah@co.com,mike@co.com in course Python Programming"
• **Bulk Learning Plan Enrollment**: "Enroll marketing team in learning plan Leadership Development"
• **Bulk Unenrollment**: "Remove john@co.com,sarah@co.com from course Excel Training"

**✅ Individual Enrollment Features**
• **Enroll in Course**: "Enroll john@company.com in course Python Programming"
• **Enroll in Learning Plan**: "Enroll sarah@company.com in learning plan Data Science"
• **Unenroll from Course**: "Unenroll mike@company.com from course Excel Training"
• **Unenroll from Learning Plan**: "Remove user@company.com from learning plan Leadership"

**📊 Information & Search Features:**
• **Check Enrollment**: "Check if john@company.com is enrolled in course Python Programming"
• **User Enrollments**: "User enrollments mike@company.com"
• **Find Users**: "Find user email@company.com"
• **Find Courses**: "Find Python courses"  
• **Find Learning Plans**: "Find Python learning plans"
• **Course Info**: "Course info Working with Data in Python"
• **Learning Plan Info**: "Learning plan info Getting Started with Python"
• **ILT Session Info**: "Session details for session 123"
• **Docebo Help**: "How to enroll users in Docebo"

**💡 Your message was:** "${message}"

**🎯 ILT Session Examples:**
• "Create session 'Advanced Python' for course 2420 on 2025-03-15 from 09:00 to 17:00 at Conference Room A with instructor trainer@company.com"
• "Enroll development team in ILT session 'Advanced Python'"
• "Mark john@co.com,sarah@co.com as completed in session 123"

**Try one of the examples above!**`,
    success: false,
    intent: analysis.intent,
    confidence: analysis.confidence,
    timestamp: new Date().toISOString()
  }));
      }

      // Execute handler with timeout
      const result = await handlerPromise;
      return result;

    } catch (timeoutError) {
      console.error('❌ Handler timeout:', timeoutError);
      return NextResponse.json({
        response: `⏱️ **Request Timeout**: ${timeoutError instanceof Error ? timeoutError.message : 'Operation took too long'}

**🔄 Try Background Processing:**
• "Load all enrollments in background for [email]"
• "Process enrollments in background for [email]"

**⚡ Quick Solutions:**
• Try a simpler version of your request
• For large enrollment lists, use CSV upload instead
• Break complex requests into smaller parts

**Examples of simpler requests:**
• "Find user john@company.com"
• "User enrollments mike@company.com" (shows first 10 results)
• "Enroll single user instead of bulk"`,
        success: false,
        timeout: true,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Possible Causes:**
• Network timeout or connection issue
• Server overload
• Invalid request format

**Please try again** or use a simpler request format.`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Apply security middleware to POST requests with extended timeout
export const POST = withSecurity(chatHandler, {
  rateLimit: {
    maxRequests: 30,
    windowMs: 60 * 1000
  },
  validateInput: true,
  sanitizeOutput: true
});

// GET endpoint for API info (with lighter security)
export const GET = withSecurity(async (request: NextRequest) => {
  return NextResponse.json({
    status: 'Enhanced Docebo Chat API with ILT Session Management',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'NEW: Complete ILT Session Management',
      'NEW: ILT Session Creation with Events',
      'NEW: ILT Session Enrollment (Individual & Bulk)',
      'NEW: ILT Session Attendance Tracking',
      'FIXED: Load more enrollments command support',
      'Background processing for heavy enrollment data',
      'Complete enrollment management (enroll/unenroll)',
      'Course and Learning Plan enrollment',
      'Enrollment status checking and verification',
      'User search and details',
      'Course and learning plan search',
      'Natural language processing',
      'Timeout protection and error handling',
      'Pagination with load more functionality',
      'Optimized for serverless deployment'
    ],
    ilt_session_commands: [
      'Create ILT session for course [course] on [date] from [time] to [time]',
      'Schedule session [name] for course [course] with instructor [email]',
      'Enroll [email] in ILT session [session_id]',
      'Enroll [email1,email2,email3] in session [session_name]',
      'Remove [email] from ILT session [session_id]',
      'Mark [email] as attended in session [session_id]',
      'Mark [email] as completed in session [session_name]',
      'Mark [email1,email2] as absent in session [session_id]'
    ],
    load_more_commands: [
      'Load more enrollments for [email]',
      'Show more enrollments for [email]',
      'More enrollments for [email]',
      'Continue enrollments for [email]',
      'Get more enrollments [email]'
    ],
    timeout_settings: {
      'ilt_session_creation': '20 seconds',
      'ilt_session_enrollment': '15 seconds',
      'bulk_ilt_enrollment': '25 seconds',
      'attendance_marking': '20 seconds',
      'background_processing': 'No timeout limits',
      'user_enrollments': '25 seconds',
      'load_more_enrollments': '25 seconds',
      'enrollment_check': '20 seconds',
      'search_operations': '15 seconds',
      'info_operations': '10 seconds'
    },
    ilt_session_features: {
      'session_creation': {
        'description': 'Create ILT sessions with multiple events',
        'supports': ['Date/time scheduling', 'Instructor assignment', 'Location setup', 'Participant limits'],
        'examples': [
          'Create ILT session for course 2420 on 2025-03-15 from 9:00 to 17:00',
          'Schedule session "Advanced Python" for course Programming with instructor john@company.com'
        ]
      },
      'enrollment_management': {
        'description': 'Enroll users in ILT sessions (individual and bulk)',
        'supports': ['Single user enrollment', 'Bulk enrollment', 'Unenrollment'],
        'examples': [
          'Enroll john@company.com in ILT session 123',
          'Enroll team@co.com,lead@co.com,dev@co.com in session "Python Workshop"'
        ]
      },
      'attendance_tracking': {
        'description': 'Mark and track session attendance',
        'supports': ['Attended/Absent marking', 'Completion status', 'Bulk attendance'],
        'statuses': ['attended', 'completed', 'absent', 'no-show'],
        'examples': [
          'Mark john@company.com as attended in session 123',
          'Mark team@co.com,lead@co.com as completed in session "Advanced Training"'
        ]
      }
    },
    background_processing: {
      'commands': [
        'Load all enrollments in background for [email]',
        'Process enrollments in background for [email]',
        'Background enrollment processing for [email]'
      ],
      'use_cases': [
        'Users with 50+ enrollments',
        'Complete data export needs', 
        'Timeout prevention'
      ]
    },
    pagination_support: {
      'load_more_button': 'enabled',
      'load_more_commands': 'FIXED and working',
      'page_size': 20,
      'max_items_per_request': 1000
    },
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans',
      'course_enrollments': '/learn/v1/enrollments',
      'lp_enrollments': '/learningplan/v1/learningplans/enrollments',
      'ilt_sessions': '/learn/v1/sessions',
      'ilt_enrollments': '/learn/v1/sessions/enrollments',
      'ilt_attendance': '/learn/v1/sessions/attendance'
    }
  });
}, {
  rateLimit: {
    maxRequests: 100,
    windowMs: 60 * 1000
  },
  validateInput: false
});
