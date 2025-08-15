// app/api/chat/route.ts - Main endpoint handler
import { NextRequest, NextResponse } from 'next/server';
import { IntentAnalyzer } from './intent-analyzer';
import { DoceboAPI } from './docebo-api';
import { getConfig } from './utils/config';
import { handlers } from './handlers';

let api: DoceboAPI;

export async function POST(request: NextRequest) {
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
        // Enrollment Management
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

**✅ NEW: Enrollment Features**
• **Enroll in Course**: "Enroll john@company.com in course Python Programming"
• **Enroll in Learning Plan**: "Enroll sarah@company.com in learning plan Data Science"
• **Unenroll from Course**: "Unenroll mike@company.com from course Excel Training"
• **Unenroll from Learning Plan**: "Remove user@company.com from learning plan Leadership"

**📊 Existing Features:**
• **Check Enrollment**: "Check if john@company.com is enrolled in course Python Programming"
• **User Enrollments**: "User enrollments mike@company.com"
• **Find Users**: "Find user email@company.com"
• **Find Courses**: "Find Python courses"  
• **Find Learning Plans**: "Find Python learning plans"
• **Course Info**: "Course info Working with Data in Python"
• **Learning Plan Info**: "Learning plan info Getting Started with Python"
• **Docebo Help**: "How to enroll users in Docebo"

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

export async function GET() {
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
      'Modular architecture'
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
    ]
  });
}
