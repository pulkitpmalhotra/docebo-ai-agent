// app/api/chat/route.ts - Main endpoint handler with security
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '../middleware/security';
import { IntentAnalyzer } from './intent-analyzer';
import { DoceboAPI } from './docebo-api';
import { getConfig } from './utils/config';
import { handlers } from './handlers';
import { BulkEnrollmentHandlers } from './handlers/bulk-enrollment';

let api: DoceboAPI;

// Main handler function
async function chatHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Initialize API client if needed
    if (!api) {
      const config = getConfig();
      api = new DoceboAPI(config);
    }

    // Parse request
    const body = await request.json();
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: '❌ Please provide a valid message',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🤖 Processing: "${message}"`);
    
    // Analyze intent
    const analysis = IntentAnalyzer.analyzeIntent(message);
    console.log(`🎯 Intent: ${analysis.intent}, Confidence: ${analysis.confidence}`);
    
    // Route to appropriate handler
    try {
      switch (analysis.intent) {
        // Bulk Enrollment Management - NEW!
        case 'bulk_enroll_course':
          return await BulkEnrollmentHandlers.handleBulkCourseEnrollment(analysis.entities, api);
          
        case 'bulk_enroll_learning_plan':
          return await BulkEnrollmentHandlers.handleBulkLearningPlanEnrollment(analysis.entities, api);
          
        case 'bulk_unenroll_course':
        case 'bulk_unenroll_learning_plan':
          return await BulkEnrollmentHandlers.handleBulkUnenrollment(analysis.entities, api);
        
        // Individual Enrollment Management
        case 'enroll_user_in_course':
          return await handlers.enrollment.handleEnrollUserInCourse(analysis.entities, api);
          
        case 'enroll_user_in_learning_plan':
          return await handlers.enrollment.handleEnrollUserInLearningPlan(analysis.entities, api);
          
        case 'unenroll_user_from_course':
          return await handlers.enrollment.handleUnenrollUserFromCourse(analysis.entities, api);
          
        case 'unenroll_user_from_learning_plan':
          return await handlers.enrollment.handleUnenrollUserFromLearningPlan(analysis.entities, api);
          
        // Enrollment Checking
        case 'check_specific_enrollment':
          return await handlers.info.handleSpecificEnrollmentCheck(analysis.entities, api);
          
        case 'get_user_enrollments':
          return await handlers.info.handleUserEnrollments(analysis.entities, api);
          
        // Search Functions
        case 'search_users':
          return await handlers.search.handleUserSearch(analysis.entities, api);
          
        case 'search_courses':
          return await handlers.search.handleCourseSearch(analysis.entities, api);
          
        case 'search_learning_plans':
          return await handlers.search.handleLearningPlanSearch(analysis.entities, api);
          
        // Info Functions
        case 'get_course_info':
          return await handlers.info.handleCourseInfo(analysis.entities, api);
          
        case 'get_learning_plan_info':
          return await handlers.info.handleLearningPlanInfo(analysis.entities, api);
          
        // Help
        case 'docebo_help':
          return await handlers.info.handleDoceboHelp(analysis.entities, api);
          
        default:
          return NextResponse.json({
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
          });
      }
    } catch (error) {
      console.error('❌ Processing error:', error);
      return NextResponse.json({
        response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Apply security middleware to POST requests
export const POST = withSecurity(chatHandler, {
  rateLimit: {
    maxRequests: 30, // 30 requests per minute for chat
    windowMs: 60 * 1000
  },
  validateInput: true,
  sanitizeOutput: true
});

// GET endpoint for API info (with lighter security)
export const GET = withSecurity(async (request: NextRequest) => {
  return NextResponse.json({
    status: 'Enhanced Docebo Chat API with Complete Enrollment Management',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Complete enrollment management (enroll/unenroll)',
      'Course and Learning Plan enrollment',
      'Enrollment status checking and verification',
      'User search and details',
      'Course and learning plan search',
      'Natural language processing',
      'Modular architecture',
      'Security middleware with rate limiting',
      'Input validation and sanitization'
    ],
    api_endpoints_used: {
      'users': '/manage/v1/user',
      'courses': '/course/v1/courses',
      'learning_plans': '/learningplan/v1/learningplans',
      'course_enrollments': '/learn/v1/enrollments',
      'lp_enrollments': '/learningplan/v1/learningplans/enrollments'
    },
    enrollment_capabilities: [
      'Enroll user in course: "Enroll john@company.com in course Python Programming"',
      'Enroll user in learning plan: "Enroll sarah@company.com in learning plan Data Science"',
      'Unenroll from course: "Unenroll mike@company.com from course Excel Training"',
      'Unenroll from learning plan: "Remove user@company.com from learning plan Leadership"',
      'Check enrollment status: "Check if john@company.com is enrolled in course Python"',
      'Check completion: "Has sarah@company.com completed learning plan Data Science?"',
      'View all enrollments: "User enrollments mike@company.com"'
    ],
    security_features: [
      'Rate limiting (30 requests/minute)',
      'Input validation and sanitization',
      'CORS headers',
      'Security headers',
      'Error handling'
    ]
  });
}, {
  rateLimit: {
    maxRequests: 100, // More lenient for GET requests
    windowMs: 60 * 1000
  },
  validateInput: false // No input validation needed for GET
});
