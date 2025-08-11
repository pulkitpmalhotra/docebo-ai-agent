// app/api/chat/route.ts - Complete working version
import { NextRequest, NextResponse } from 'next/server';

interface ChatRequest {
  message: string;
  userRole?: string;
  userId?: string;
}

interface ChatResponse {
  response: string;
  intent: string;
  userRole: string;
  suggestions?: string[];
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary';
    action: string;
  }>;
  meta: {
    api_mode: string;
    processing_time: number;
    timestamp: string;
  };
}

// Mock data for demonstrations
const MOCK_USERS = [
  { id: 1, email: 'john@company.com', name: 'John Smith', status: 'active', department: 'Engineering', lastLogin: '2024-01-15', enrollments: 5 },
  { id: 2, email: 'sarah@company.com', name: 'Sarah Johnson', status: 'active', department: 'Marketing', lastLogin: '2024-01-14', enrollments: 3 },
  { id: 3, email: 'mike@company.com', name: 'Mike Brown', status: 'inactive', department: 'Sales', lastLogin: '2024-01-10', enrollments: 2 },
  { id: 4, email: 'lisa@company.com', name: 'Lisa Davis', status: 'active', department: 'HR', lastLogin: '2024-01-16', enrollments: 7 }
];

const MOCK_COURSES = [
  { id: 1, name: 'Python Programming Fundamentals', category: 'Technical', enrollments: 45, completionRate: 78, status: 'published' },
  { id: 2, name: 'Excel Advanced Techniques', category: 'Skills', enrollments: 67, completionRate: 85, status: 'published' },
  { id: 3, name: 'Leadership Excellence', category: 'Leadership', enrollments: 32, completionRate: 92, status: 'published' },
  { id: 4, name: 'Safety Training 2024', category: 'Compliance', enrollments: 89, completionRate: 96, status: 'published' },
  { id: 5, name: 'JavaScript Essentials', category: 'Technical', enrollments: 23, completionRate: 73, status: 'draft' }
];

const DOCEBO_CATEGORIES = {
  user_management: { name: 'User Management' },
  course_management: { name: 'Course Management' },
  enrollments: { name: 'Enrollments' },
  reports: { name: 'Reports' },
  analytics: { name: 'Analytics' }
};

const ROLE_PERMISSIONS = {
  superadmin: ['user_management', 'course_management', 'enrollments', 'reports', 'analytics'],
  power_user: ['user_management', 'course_management', 'enrollments', 'reports'],
  user_manager: ['user_management', 'reports'],
  user: ['reports']
};

function validateRequest(body: any): { success: boolean; data?: ChatRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }
  if (!body.message || typeof body.message !== 'string') {
    return { success: false, error: 'Message is required' };
  }
  return {
    success: true,
    data: {
      message: body.message.trim(),
      userRole: body.userRole || 'user',
      userId: body.userId || 'anonymous'
    }
  };
}

function detectIntent(message: string): string {
  const messageLower = message.toLowerCase().trim();
  
  if (messageLower.includes('search') && messageLower.includes('user')) {
    return 'search_user_action';
  }
  if (messageLower.includes('search') && messageLower.includes('course')) {
    return 'search_course_action';
  }
  if (messageLower.includes('course') && messageLower.includes('stat')) {
    return 'course_stats_action';
  }
  if (messageLower.includes('export') && messageLower.includes('course')) {
    return 'export_courses_action';
  }
  if (messageLower.includes('enroll')) {
    return 'enroll_user_action';
  }
  if (messageLower.includes('user') && messageLower.includes('report')) {
    return 'user_report_action';
  }
  if (messageLower.includes('what') && (messageLower.includes('do') || messageLower.includes('can'))) {
    return 'category_selection';
  }
  if (messageLower.includes('user') && messageLower.includes('manage')) {
    return 'user_management';
  }
  if (messageLower.includes('course') && messageLower.includes('manage')) {
    return 'course_management';
  }
  
  return 'category_selection';
}

function handleSearchUser(message: string): string {
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  
  if (!emailMatch) {
    return 'Please specify a user email. Example: "Search for user john@company.com"';
  }
  
  const searchEmail = emailMatch[0];
  const user = MOCK_USERS.find(u => u.email.toLowerCase() === searchEmail.toLowerCase());
  
  if (!user) {
    return `User "${searchEmail}" not found. Available users: ${MOCK_USERS.slice(0, 3).map(u => u.email).join(', ')}`;
  }
  
  return `**User Found: ${user.name}**
  
• Email: ${user.email}
• Status: ${user.status === 'active' ? '✅ Active' : '❌ Inactive'}
• Department: ${user.department}
• Last Login: ${user.lastLogin}
• Total Enrollments: ${user.enrollments} courses`;
}

function handleSearchCourses(message: string): string {
  const courseMatch = message.match(/course[s]?[:\s]+([^,\n]+)/i);
  let searchTerm = '';
  
  if (courseMatch) {
    searchTerm = courseMatch[1].trim().replace(/["']/g, '');
  }
  
  let results = searchTerm ? 
    MOCK_COURSES.filter(course => 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.category.toLowerCase().includes(searchTerm.toLowerCase())
    ) : MOCK_COURSES;
  
  if (results.length === 0) {
    return `No courses found matching "${searchTerm}". Available courses: Python Programming, Excel Advanced, Leadership Excellence, Safety Training`;
  }
  
  const courseList = results.map(course => 
    `**${course.name}**
• Category: ${course.category}
• Enrollments: ${course.enrollments} users
• Completion Rate: ${course.completionRate}%
• Status: ${course.status === 'published' ? '✅ Published' : '📝 Draft'}`
  ).join('\n\n');
  
  return `**Course Search Results (${results.length} found)**

${courseList}`;
}

function handleCourseStats(): string {
  const totalCourses = MOCK_COURSES.length;
  const publishedCourses = MOCK_COURSES.filter(c => c.status === 'published').length;
  const totalEnrollments = MOCK_COURSES.reduce((sum, c) => sum + c.enrollments, 0);
  const avgCompletionRate = Math.round(MOCK_COURSES.reduce((sum, c) => sum + c.completionRate, 0) / totalCourses);
  
  const topCourses = MOCK_COURSES
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 3)
    .map((course, index) => `${index + 1}. ${course.name} - ${course.enrollments} enrollments`)
    .join('\n');
  
  return `**Course Statistics Overview**

**Overall Metrics:**
• Total Courses: ${totalCourses}
• Published: ${publishedCourses} courses
• Total Enrollments: ${totalEnrollments} users
• Average Completion Rate: ${avgCompletionRate}%

**Top Performing Courses:**
${topCourses}

**Recommendations:**
• Focus on promoting courses with low completion rates
• Consider converting draft courses to published status`;
}

function handleExportCourses(): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `docebo_courses_export_${timestamp}.csv`;
  
  return `**Export Courses Data**

✅ **Export Generated Successfully**

**Export Details:**
• File: ${filename}
• Records: ${MOCK_COURSES.length} courses
• Format: CSV
• Generated: ${new Date().toLocaleString()}

**Included Data:**
• Course ID and Name
• Category and Status
• Enrollment Numbers
• Completion Rates

**Download Options:**
🔗 Download CSV File
📧 Email to Administrator
☁️ Save to Repository`;
}

function handleEnrollUser(message: string): string {
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const courseMatch = message.match(/(?:in|course)[:\s]+["']?([^"'\n,]+)["']?/i);
  
  if (!emailMatch || !courseMatch) {
    return 'Please specify user email and course name. Example: "Enroll john@company.com in Python Programming"';
  }
  
  const userEmail = emailMatch[0];
  const courseName = courseMatch[1].trim();
  
  const user = MOCK_USERS.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
  const course = MOCK_COURSES.find(c => c.name.toLowerCase().includes(courseName.toLowerCase()));
  
  if (!user) {
    return `User "${userEmail}" not found. Available users: ${MOCK_USERS.slice(0, 3).map(u => u.email).join(', ')}`;
  }
  
  if (!course) {
    return `Course "${courseName}" not found. Available courses: ${MOCK_COURSES.slice(0, 3).map(c => c.name).join(', ')}`;
  }
  
  return `✅ **Enrollment Successful**

**User:** ${user.name} (${user.email})
**Course:** ${course.name}
**Category:** ${course.category}
**Enrollment Date:** ${new Date().toLocaleDateString()}

**Next Steps:**
• User will receive enrollment notification
• Course materials are now accessible
• Progress tracking has begun`;
}

function handleUserReport(): string {
  const totalUsers = MOCK_USERS.length;
  const activeUsers = MOCK_USERS.filter(u => u.status === 'active').length;
  const totalEnrollments = MOCK_USERS.reduce((sum, u) => sum + u.enrollments, 0);
  
  return `**User Activity Report**

**Overview:**
• Total Users: ${totalUsers}
• Active Users: ${activeUsers}
• Total Enrollments: ${totalEnrollments}
• Average Enrollments per User: ${Math.round(totalEnrollments / totalUsers)}

**Top Performers:**
${MOCK_USERS
  .sort((a, b) => b.enrollments - a.enrollments)
  .slice(0, 3)
  .map((user, index) => `${index + 1}. ${user.name} - ${user.enrollments} enrollments`)
  .join('\n')}`;
}

function generateResponse(message: string, intent: string, userRole: string): ChatResponse {
  const startTime = Date.now();
  const allowedCategories = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];
  
  let response = '';
  let suggestions: string[] = [];
  let actions: Array<{id: string; label: string; type: 'primary' | 'secondary'; action: string}> = [];

  switch (intent) {
    case 'search_user_action':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to search users.`;
      } else {
        response = handleSearchUser(message);
        suggestions = ['Search for another user', 'Generate user report'];
        actions = [
          { id: 'search_user', label: 'Search Another User', type: 'primary', action: 'search_user_form' },
          { id: 'user_report', label: 'User Reports', type: 'secondary', action: 'user_report_form' }
        ];
      }
      break;
      
    case 'search_course_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to search courses.`;
      } else {
        response = handleSearchCourses(message);
        suggestions = ['View course statistics', 'Export course data'];
        actions = [
          { id: 'course_stats', label: 'Course Stats', type: 'primary', action: 'course_stats_query' },
          { id: 'export_courses', label: 'Export Data', type: 'secondary', action: 'export_courses_query' }
        ];
      }
      break;
      
    case 'course_stats_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to view course statistics.`;
      } else {
        response = handleCourseStats();
        suggestions = ['Export this data', 'Search specific courses'];
        actions = [
          { id: 'export_stats', label: 'Export Statistics', type: 'primary', action: 'export_courses_query' },
          { id: 'search_courses', label: 'Search Courses', type: 'secondary', action: 'search_course_form' }
        ];
      }
      break;
      
    case 'export_courses_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to export course data.`;
      } else {
        response = handleExportCourses();
        suggestions = ['Export user data', 'View course statistics'];
        actions = [
          { id: 'export_users', label: 'Export Users', type: 'primary', action: 'user_report_form' },
          { id: 'view_stats', label: 'View Statistics', type: 'secondary', action: 'course_stats_query' }
        ];
      }
      break;
      
    case 'enroll_user_action':
      if (!allowedCategories.includes('enrollments')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to enroll users.`;
      } else {
        response = handleEnrollUser(message);
        suggestions = ['Enroll another user', 'View enrollment reports'];
        actions = [
          { id: 'enroll_another', label: 'Enroll Another User', type: 'primary', action: 'enroll_user_form' },
          { id: 'enrollment_reports', label: 'Enrollment Reports', type: 'secondary', action: 'user_report_form' }
        ];
      }
      break;
      
    case 'user_report_action':
      if (!allowedCategories.includes('reports')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to generate reports.`;
      } else {
        response = handleUserReport();
        suggestions = ['Export this data', 'View user details'];
        actions = [
          { id: 'export_report', label: 'Export Data', type: 'primary', action: 'export_courses_query' },
          { id: 'search_users', label: 'Search Users', type: 'secondary', action: 'search_user_form' }
        ];
      }
      break;

    case 'category_selection':
      response = `👋 **Welcome to Docebo AI Assistant!**

I can help you with various LMS management tasks. What would you like to do today?

**Available Categories for ${userRole.replace('_', ' ').toUpperCase()}:**

${allowedCategories.map(cat => `🔹 **${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name}**`).join('\n')}

Please select a category or tell me specifically what you'd like to accomplish.`;

      suggestions = allowedCategories.map(cat => 
        `Help with ${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name.toLowerCase()}`
      );
      
      actions = allowedCategories.slice(0, 3).map(cat => ({
        id: cat,
        label: DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name,
        type: 'primary' as const,
        action: `category_${cat}`
      }));
      break;

    case 'user_management':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to access User Management features.`;
      } else {
        response = `👥 **User Management**

I can help you with user management tasks:
• Search for users
• Check user status
• View user profiles
• Generate user reports

What specific user management task would you like to perform?`;
        
        suggestions = [
          'Search for user john@company.com',
          'Generate user report',
          'Show all users'
        ];
        
        actions = [
          { id: 'search_user', label: 'Search User', type: 'primary', action: 'search_user_form' },
          { id: 'user_report', label: 'User Reports', type: 'secondary', action: 'user_report_form' }
        ];
      }
      break;

    case 'course_management':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ Access Denied: Your role (${userRole}) doesn't have permission to access Course Management features.`;
      } else {
        response = `📚 **Course Management**

I can help you with course management tasks:
• Search for courses
• View course statistics
• Export course data
• Check course enrollment

What specific course management task would you like to perform?`;
        
        suggestions = [
          'Search for Python courses',
          'Show course statistics',
          'Export course data'
        ];
        
        actions = [
          { id: 'search_course', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'course_stats', label: 'Course Stats', type: 'primary', action: 'course_stats_query' },
          { id: 'export_courses', label: 'Export Data', type: 'secondary', action: 'export_courses_query' }
        ];
      }
      break;

    default:
      response = `I can help you with: ${allowedCategories.map(cat => DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name).join(', ')}. What would you like to do?`;
      suggestions = ['What can you help me with?', 'Show user management', 'Show course management'];
  }

  const processingTime = Date.now() - startTime;

  return {
    response,
    intent,
    userRole,
    suggestions,
    actions,
    meta: {
      api_mode: 'functional',
      processing_time: processingTime,
      timestamp: new Date().toISOString()
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Functional Chat API - Processing request');
    
    const body = await request.json().catch(() => {
      throw new Error('Invalid JSON in request body');
    });

    const validation = validateRequest(body);
    if (!validation.success) {
      return NextResponse.json({
        error: validation.error,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const { message, userRole = 'user', userId } = validation.data!;
    console.log(`🎯 Processing: "${message}" for ${userRole}`);

    const intent = detectIntent(message);
    const result = generateResponse(message, intent, userRole);

    console.log(`✅ Response generated (${result.meta.processing_time}ms) - Intent: ${intent}`);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    console.error('❌ Functional Chat API Error:', error);

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
      meta: {
        api_mode: 'functional',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Docebo Functional Chat API is running',
    timestamp: new Date().toISOString(),
    available_categories: Object.keys(DOCEBO_CATEGORIES),
    mock_data: {
      users: MOCK_USERS.length,
      courses: MOCK_COURSES.length
    }
  });
}
