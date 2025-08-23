// app/api/chat/route.ts - Fixed with proper timeout handling
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
    
    // Route to appropriate handler with timeout protection
    try {
      let handlerPromise: Promise<NextResponse>;

      switch (analysis.intent) {
        // Bulk Enrollment Management
        case 'bulk_enroll_course':
          handlerPromise = BulkEnrollmentHandlers.handleBulkCourseEnrollment(analysis.entities, api);
          break;
          
        case 'bulk_enroll_learning_plan':
          handlerPromise = BulkEnrollmentHandlers.handleBulkLearningPlanEnrollment(analysis.entities, api);
          break;
          
        case 'bulk_unenroll_course':
        case 'bulk_unenroll_learning_plan':
          handlerPromise = BulkEnrollmentHandlers.handleBulkUnenrollment(analysis.entities, api);
          break;
        
        // Individual Enrollment Management
        case 'enroll_user_in_course':
          handlerPromise = handlers.enrollment.handleEnrollUserInCourse(analysis.entities, api);
          break;
          
        case 'enroll_user_in_learning_plan':
          handlerPromise = handlers.enrollment.handleEnrollUserInLearningPlan(analysis.entities, api);
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
          case 'background_user_enrollments':
  // Redirect to background processing endpoint
  handlerPromise = this.handleBackgroundEnrollmentRequest(analysis.entities);
  break;
          case 'check_background_status':
  handlerPromise = this.handleBackgroundStatusCheck(analysis.entities);
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
          handlerPromise = Promise.resolve(NextResponse.json({
            response: `🤔 **I can help you with enrollment management!**

**🚀 NEW: Bulk Enrollment Features**
• **Bulk Course Enrollment**: "Enroll john@co.com,sarah@co.com,mike@co.com in course Python Programming"
• **Bulk Learning Plan Enrollment**: "Enroll marketing team in learning plan Leadership Development"
• **Bulk Unenrollment**: "Remove john@co.com,sarah@co.com from course Excel Training"
• **Team Management**: "Enroll sales team in course Customer Service Excellence"

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
• **Docebo Help**: "How to enroll users in Docebo"

**💡 Examples of bulk commands:**
• "Enroll alice@co.com,bob@co.com,charlie@co.com in course Security Training"
• "Bulk enroll marketing team in learning plan Digital Marketing"
• "Remove support team from course Old Process Training"

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

**Quick Solutions:**
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

  try {
    console.log(`🔄 Redirecting to background processing for: ${identifier}`);
    
    // Make internal call to background endpoint
    const backgroundResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/chat-bg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `User enrollments ${identifier}` })
    });
    
    if (!backgroundResponse.ok) {
      throw new Error('Background processing request failed');
    }
    
    const backgroundData = await backgroundResponse.json();
    
    // Return the background processing response
    return NextResponse.json({
      response: `🚀 **Background Processing Started**

👤 **User**: ${identifier}
📋 **Job Type**: Complete enrollment data processing
⏱️ **Processing Time**: This may take 30-90 seconds

${backgroundData.response || ''}

💡 **Next Steps**: 
${backgroundData.jobId ? `• Check status: "Check status of ${backgroundData.jobId}"` : ''}
• Background processing handles users with 50+ enrollments
• You'll get complete results including courses AND learning plans`,
      success: true,
      jobId: backgroundData.jobId,
      processing: true,
      backgroundProcessing: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Background processing error:', error);
    
    return NextResponse.json({
      response: `❌ **Background Processing Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Alternative Options:**
• Try: "User enrollments ${identifier}" (first 10 results)  
• Try: "Find user ${identifier}" (user details only)
• Use CSV export for complete data`,
      success: false,
      timestamp: new Date().toISOString()
    });
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
    status: 'Enhanced Docebo Chat API with Complete Enrollment Management',
    version: '4.1.0',
    timestamp: new Date().toISOString(),
    features: [
      'Complete enrollment management (enroll/unenroll)',
      'Course and Learning Plan enrollment',
      'Enrollment status checking and verification',
      'User search and details',
      'Course and learning plan search',
      'Natural language processing',
      'Timeout protection and error handling',
      'Load more pagination support',
      'Optimized for serverless deployment'
    ],
    timeout_settings: {
      'user_enrollments': '25 seconds',
      'enrollment_check': '20 seconds',
      'search_operations': '15 seconds',
      'info_operations': '10 seconds'
    },
    pagination_support: {
      'load_more_button': 'enabled',
      'page_size': 10,
      'max_items_per_request': 1000
    },
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans',
      'course_enrollments': '/learn/v1/enrollments',
      'lp_enrollments': '/learningplan/v1/learningplans/enrollments'
    }
  });
}, {
  rateLimit: {
    maxRequests: 100,
    windowMs: 60 * 1000
  },
  validateInput: false
});
