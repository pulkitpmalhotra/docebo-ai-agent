// app/api/chat/route.ts - Working version with actual action handlers
import { NextRequest, NextResponse } from 'next/server';

interface ChatRequest {
  message: string;
  userRole?: string;
  userId?: string;
  context?: string;
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
  { id: 4, email: 'lisa@company.com', name: 'Lisa Davis', status: 'active', department: 'HR', lastLogin: '2024-01-16', enrollments: 7 },
  { id: 5, email: 'tom@company.com', name: 'Tom Wilson', status: 'active', department: 'Engineering', lastLogin: '2024-01-16', enrollments: 4 }
];

const MOCK_COURSES = [
  { id: 1, name: 'Python Programming Fundamentals', category: 'Technical', enrollments: 45, completionRate: 78, status: 'published' },
  { id: 2, name: 'Excel Advanced Techniques', category: 'Skills', enrollments: 67, completionRate: 85, status: 'published' },
  { id: 3, name: 'Leadership Excellence', category: 'Leadership', enrollments: 32, completionRate: 92, status: 'published' },
  { id: 4, name: 'Safety Training 2024', category: 'Compliance', enrollments: 89, completionRate: 96, status: 'published' },
  { id: 5, name: 'JavaScript Essentials', category: 'Technical', enrollments: 23, completionRate: 73, status: 'draft' },
  { id: 6, name: 'Project Management Basics', category: 'Skills', enrollments: 41, completionRate: 88, status: 'published' },
  { id: 7, name: 'Customer Service Excellence', category: 'Skills', enrollments: 55, completionRate: 81, status: 'published' }
];

// Main categories and their actions
const DOCEBO_CATEGORIES = {
  user_management: {
    name: 'User Management',
    actions: [
      'Search for a user',
      'Check user status',
      'View user profile',
      'Manage user enrollments',
      'Reset user password',
      'Deactivate/activate user'
    ]
  },
  course_management: {
    name: 'Course Management',
    actions: [
      'Search courses',
      'View course details',
      'Check course enrollments',
      'Manage course settings',
      'Course completion rates',
      'Export course data'
    ]
  },
  learning_plan_management: {
    name: 'Learning Plan Management',
    actions: [
      'View learning plans',
      'Check learning plan progress',
      'Manage learning plan enrollments',
      'Create learning plan reports',
      'Export learning plan data'
    ]
  },
  notifications: {
    name: 'Notifications',
    actions: [
      'Send notifications',
      'View notification history',
      'Create notification templates',
      'Schedule notifications',
      'Notification delivery reports'
    ]
  },
  enrollments: {
    name: 'Enrollments',
    actions: [
      'Enroll users in courses',
      'Bulk enrollment',
      'View enrollment history',
      'Cancel enrollments',
      'Enrollment reports'
    ]
  },
  central_repository: {
    name: 'Central Repository',
    actions: [
      'Search repository',
      'Upload content',
      'Manage assets',
      'Content usage reports',
      'Export repository data'
    ]
  },
  group_management: {
    name: 'Group Management',
    actions: [
      'Create groups',
      'Manage group members',
      'Group enrollment',
      'Group progress reports',
      'Export group data'
    ]
  },
  reports: {
    name: 'Reports',
    actions: [
      'Generate user reports',
      'Course completion reports',
      'Enrollment reports',
      'Custom reports',
      'Schedule reports',
      'Export reports'
    ]
  },
  analytics: {
    name: 'Analytics',
    actions: [
      'User analytics',
      'Course analytics',
      'Learning plan analytics',
      'System usage analytics',
      'Performance dashboards'
    ]
  }
};

// Role-based permissions
const ROLE_PERMISSIONS = {
  superadmin: Object.keys(DOCEBO_CATEGORIES),
  power_user: ['user_management', 'course_management', 'enrollments', 'reports', 'analytics'],
  user_manager: ['user_management', 'reports', 'analytics'],
  user: ['reports']
};

function validateRequest(body: any): { success: boolean; data?: ChatRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }

  if (!body.message || typeof body.message !== 'string') {
    return { success: false, error: 'Message is required' };
  }

  if (body.message.length > 2000) {
    return { success: false, error: 'Message too long (max 2000 characters)' };
  }

  return {
    success: true,
    data: {
      message: body.message.trim(),
      userRole: body.userRole || 'user',
      userId: body.userId || 'anonymous',
      context: body.context
    }
  };
}

function detectIntent(message: string): string {
  const messageLower = message.toLowerCase().trim();
  
  // Specific action detection
  if (messageLower.includes('search') && messageLower.includes('user')) {
    return 'search_user_action';
  }
  
  if (messageLower.includes('search') && messageLower.includes('course')) {
    return 'search_course_action';
  }
  
  if (messageLower.includes('course') && (messageLower.includes('stats') || messageLower.includes('statistics'))) {
    return 'course_stats_action';
  }
  
  if (messageLower.includes('export') && messageLower.includes('course')) {
    return 'export_courses_action';
  }
  
  if (messageLower.includes('enroll') && messageLower.includes('user')) {
    return 'enroll_user_action';
  }
  
  if (messageLower.includes('user') && messageLower.includes('report')) {
    return 'user_report_action';
  }
  
  if (messageLower.includes('status') && messageLower.includes('user')) {
    return 'user_status_action';
  }
  
  // Category detection
  if (messageLower.includes('what') && (messageLower.includes('do') || messageLower.includes('can'))) {
    return 'category_selection';
  }
  
  if (messageLower.includes('user') && (messageLower.includes('manage') || messageLower.includes('management'))) {
    return 'user_management';
  }
  
  if (messageLower.includes('course') && (messageLower.includes('manage') || messageLower.includes('management'))) {
    return 'course_management';
  }
  
  if (messageLower.includes('enroll')) {
    return 'enrollments';
  }
  
  if (messageLower.includes('report')) {
    return 'reports';
  }
  
  return 'category_selection';
}

// Action handlers
function handleSearchUser(message: string): string {
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const nameMatch = message.match(/by name[:\s]+([^,\n]+)/i) || message.match(/name[:\s]+([^,\n]+)/i);
  
  let searchTerm = '';
  let searchType = 'email';
  
  if (emailMatch) {
    searchTerm = emailMatch[0];
    searchType = 'email';
  } else if (nameMatch) {
    searchTerm = nameMatch[1].trim();
    searchType = 'name';
  } else {
    // Extract any term after "search" or "find"
    const termMatch = message.match(/(?:search|find)[^:]*:?\s*([^\n,]+)/i);
    if (termMatch) {
      searchTerm = termMatch[1].trim();
    }
  }
  
  if (!searchTerm) {
    return `❓ **Search User**\n\nPlease specify what you're looking for. Examples:\n• "Search for user john@company.com"\n• "Find user by name: John Smith"\n• "Search user by email: sarah@company.com"`;
  }
  
  const results = MOCK_USERS.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (results.length === 0) {
    return `❌ **No Users Found**\n\nNo users found matching "${searchTerm}"\n\nTry searching for:\n• john@company.com\n• sarah@company.com\n• mike@company.com`;
  }
  
  const userList = results.map(user => 
    `**${user.name}** (${user.email})\n• Status: ${user.status === 'active' ? '✅ Active' : '❌ Inactive'}\n• Department: ${user.department}\n• Last Login: ${user.lastLogin}\n• Enrollments: ${user.enrollments} courses`
  ).join('\n\n');
  
  return `👥 **User Search Results** (${results.length} found)\n\n${userList}`;
}

function handleSearchCourses(message: string): string {
  const courseMatch = message.match(/course[s]?[:\s]+([^,\n]+)/i) || message.match(/search[^:]*:?\s*([^\n,]+)/i);
  
  let searchTerm = '';
  if (courseMatch) {
    searchTerm = courseMatch[1].trim().replace(/["']/g, '');
  }
  
  if (!searchTerm) {
    searchTerm = 'all';
  }
  
  let results = MOCK_COURSES;
  
  if (searchTerm.toLowerCase() !== 'all') {
    results = MOCK_COURSES.filter(course => 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  if (results.length === 0) {
    return `❌ **No Courses Found**\n\nNo courses found matching "${searchTerm}"\n\nAvailable courses include:\n• Python Programming\n• Excel Advanced\n• Leadership Excellence\n• Safety Training`;
  }
  
  const courseList = results.map(course => 
    `📚 **${course.name}**\n• Category: ${course.category}\n• Enrollments: ${course.enrollments} users\n• Completion Rate: ${course.completionRate}%\n• Status: ${course.status === 'published' ? '✅ Published' : '📝 Draft'}`
  ).join('\n\n');
  
  return `📚 **Course Search Results** (${results.length} found)\n\n${courseList}`;
}

function handleCourseStats(): string {
  const totalCourses = MOCK_COURSES.length;
  const publishedCourses = MOCK_COURSES.filter(c => c.status === 'published').length;
  const totalEnrollments = MOCK_COURSES.reduce((sum, c) => sum + c.enrollments, 0);
  const avgCompletionRate = Math.round(MOCK_COURSES.reduce((sum, c) => sum + c.completionRate, 0) / totalCourses);
  
  const topCourses = MOCK_COURSES
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 3)
    .map((course, index) => 
      `${index + 1}. **${course.name}** - ${course.enrollments} enrollments (${course.completionRate}% completion)`
    ).join('\n');
  
  const categoryStats = MOCK_COURSES.reduce((acc, course) => {
    acc[course.category] = (acc[course.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const categoryList = Object.entries(categoryStats)
    .map(([category, count]) => `• ${category}: ${count} courses`)
    .join('\n');
  
  return `📊 **Course Statistics Overview**

**Overall Metrics:**
• Total Courses: ${totalCourses}
• Published: ${publishedCourses} courses
• Draft: ${totalCourses - publishedCourses} courses
• Total Enrollments: ${totalEnrollments} users
• Average Completion Rate: ${avgCompletionRate}%

**Top Performing Courses:**
${topCourses}

**Courses by Category:**
${categoryList}

**Recommendations:**
• Focus on promoting courses with <80% completion rates
• Consider converting draft courses to published status
• Analyze top performers for best practices`;
}

function handleExportCourses(): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `docebo_courses_export_${timestamp}.csv`;
  
  return `📁 **Export Courses Data**

✅ **Export Generated Successfully**

**Export Details:**
• File: \`${filename}\`
• Records: ${MOCK_COURSES.length} courses
• Format: CSV
• Generated: ${new Date().toLocaleString()}

**Included Data:**
• Course ID and Name
• Category and Status
• Enrollment Numbers
• Completion Rates
• Creation/Modification Dates

**Download Options:**
🔗 Download CSV File
📧 Email to Administrator
☁️ Save to Central Repository

*Note: In a production environment, this would trigger an actual file download or email delivery.*`;
}

function handleEnrollUser(message: string): string {
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const courseMatch = message.match(/(?:in|course)[:\s]+["']?([^"'\n,]+)["']?/i);
  
  if (!emailMatch) {
    return `❓ **Enroll User - Missing Email**\n\nPlease specify the user's email address.\n\nExample: "Enroll john@company.com in Python course"`;
  }
  
  if (!courseMatch) {
    return `❓ **Enroll User - Missing Course**\n\nPlease specify the course name.\n\nExample: "Enroll ${emailMatch[0]} in Python Programming"`;
  }
  
  const userEmail = emailMatch[0];
  const courseName = courseMatch[1].trim();
  
  // Find user
  const user = MOCK_USERS.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
  if (!user) {
    return `❌ **User Not Found**\n\nUser "${userEmail}" not found in system.\n\nAvailable users:\n${MOCK_USERS.slice(0, 3).map(u => `• ${u.email}`).join('\n')}`;
  }
  
  // Find course
  const course = MOCK_COURSES.find(c => c.name.toLowerCase().includes(courseName.toLowerCase()));
  if (!course) {
    return `❌ **Course Not Found**\n\nCourse matching "${courseName}" not found.\n\nAvailable courses:\n${MOCK_COURSES.slice(0, 3).map(c => `• ${c.name}`).join('\n')}`;
  }
  
  return `✅ **Enrollment Successful**

**User:** ${user.name} (${user.email})
**Course:** ${course.name}
**Category:** ${course.category}
**Enrollment Date:** ${new Date().toLocaleDateString()}
**Status:** Active

**Next Steps:**
• User will receive enrollment notification
• Course materials are now accessible
• Progress tracking has begun
• Completion deadline: 30 days

**Enrollment Summary:**
• User's Total Enrollments: ${user.enrollments + 1} courses
• Course Total Enrollments: ${course.enrollments + 1} users
• Expected Completion Rate: ${course.completionRate}%`;
}

function handleUserReport(message: string): string {
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const timeframeMatch = message.match(/(?:last|past)\s+(\d+)\s+(day|week|month)s?/i) || message.match(/(quarter|month|week)/i);
  
  let timeframe = 'Last 30 days';
  if (timeframeMatch) {
    if (timeframeMatch[1] && timeframeMatch[2]) {
      timeframe = `Last ${timeframeMatch[1]} ${timeframeMatch[2]}s`;
    } else {
      timeframe = `Last ${timeframeMatch[1]}`;
    }
  }
  
  if (emailMatch) {
    const user = MOCK_USERS.find(u => u.email.toLowerCase() === emailMatch[0].toLowerCase());
    if (!user) {
      return `❌ **User Not Found**\n\nUser "${emailMatch[0]}" not found for report generation.`;
    }
    
    return `📊 **User Activity Report: ${user.name}**

**Report Period:** ${timeframe}
**Generated:** ${new Date().toLocaleString()}

**User Information:**
• Name: ${user.name}
• Email: ${user.email}
• Department: ${user.department}
• Status: ${user.status}
• Last Login: ${user.lastLogin}

**Learning Activity:**
• Total Enrollments: ${user.enrollments} courses
• Completed Courses: ${Math.floor(user.enrollments * 0.7)} courses
• In Progress: ${user.enrollments - Math.floor(user.enrollments * 0.7)} courses
• Average Score: 87%
• Total Learning Hours: ${user.enrollments * 12} hours

**Recent Activity:**
• Python Programming - 95% complete
• Excel Advanced - Completed (Score: 92%)
• Safety Training - Completed (Score: 100%)

**Recommendations:**
• User is performing above average
• Consider advanced courses in ${user.department}
• Eligible for certification programs`;
  }
  
  // Generate department/overall report
  const totalUsers = MOCK_USERS.length;
  const activeUsers = MOCK_USERS.filter(u => u.status === 'active').length;
  const totalEnrollments = MOCK_USERS.reduce((sum, u) => sum + u.enrollments, 0);
  
  return `📊 **User Activity Report - All Users**

**Report Period:** ${timeframe}
**Generated:** ${new Date().toLocaleString()}

**Overview:**
• Total Users: ${totalUsers}
• Active Users: ${activeUsers}
• Inactive Users: ${totalUsers - activeUsers}
• Total Enrollments: ${totalEnrollments}
• Average Enrollments per User: ${Math.round(totalEnrollments / totalUsers)}

**Department Breakdown:**
${Object.entries(MOCK_USERS.reduce((acc, user) => {
  acc[user.department] = (acc[user.department] || 0) + 1;
  return acc;
}, {} as Record<string, number>)).map(([dept, count]) => `• ${dept}: ${count} users`).join('\n')}

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
    // Specific Actions
    case 'search_user_action':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to search users.`;
      } else {
        response = handleSearchUser(message);
        suggestions = ['Search for another user', 'Check user status', 'View user reports'];
        actions = [
          { id: 'search_another_user', label: 'Search Another User', type: 'primary', action: 'search_user_form' },
          { id: 'user_reports', label: 'User Reports', type: 'secondary', action: 'user_report_form' }
        ];
      }
      break;
      
    case 'search_course_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to search courses.`;
      } else {
        response = handleSearchCourses(message);
        suggestions = ['Search for more courses', 'View course statistics', 'Export course data'];
        actions = [
          { id: 'search_more_courses', label: 'Search More', type: 'primary', action: 'search_course_form' },
          { id: 'course_stats', label: 'Course Stats', type: 'primary', action: 'course_stats_query' },
          { id: 'export_courses', label: 'Export Data', type: 'secondary', action: 'export_courses_query' }
        ];
      }
      break;
      
    case 'course_stats_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to view course statistics.`;
      } else {
        response = handleCourseStats();
        suggestions = ['Export this data', 'View specific course details', 'Generate course report'];
        actions = [
          { id: 'export_stats', label: 'Export Statistics', type: 'primary', action: 'export_courses_query' },
          { id: 'course_details', label: 'Course Details', type: 'secondary', action: 'search_course_form' }
        ];
      }
      break;
      
    case 'export_courses_action':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to export course data.`;
      } else {
        response = handleExportCourses();
        suggestions = ['Export user data', 'Generate another report', 'View course statistics'];
        actions = [
          { id: 'export_users', label: 'Export Users', type: 'primary', action: 'user_report_form' },
          { id: 'view_stats', label: 'View Statistics', type: 'secondary', action: 'course_stats_query' }
        ];
      }
      break;
      
    case 'enroll_user_action':
      if (!allowedCategories.includes('enrollments')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to enroll users.`;
      } else {
        response = handleEnrollUser(message);
        suggestions = ['Enroll another user', 'View enrollment reports', 'Bulk enrollment'];
        actions = [
          { id: 'enroll_another', label: 'Enroll Another User', type: 'primary', action: 'enroll_user_form' },
          { id: 'enrollment_reports', label: 'Enrollment Reports', type: 'secondary', action: 'enrollment_report_query' }
        ];
      }
      break;
      
    case 'user_report_action':
      if (!allowedCategories.includes('reports')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to generate reports.`;
      } else {
        response = handleUserReport(message);
        suggestions = ['Generate another report', 'Export this data', 'View analytics'];
        actions = [
          { id: 'another_report', label: 'Generate Another Report', type: 'primary', action: 'user_report_form' },
          { id: 'export_report', label: 'Export Data', type: 'secondary', action: 'export_courses_query' }
        ];
      }
      break;
      
    case 'user_status_action':
      if (!allowedCategories.includes('user_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to check user status.`;
      } else {
        response = handleSearchUser(message);
        suggestions = ['Check another user status', 'Search users', 'Generate user report'];
        actions = [
          { id: 'check_another_status', label: 'Check Another Status', type: 'primary', action: 'user_status_form' },
          { id: 'search_users', label: 'Search Users', type: 'secondary', action: 'search_user_form' }
        ];
      }
      break;

    // Category selections (existing code)
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
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access User Management features.`;
      } else {
        response = `👥 **User Management**\n\nI can help you with the following user management tasks:\n\n${DOCEBO_CATEGORIES.user_management.actions.map(action => `• ${action}`).join('\n')}\n\nWhat specific user management task would you like to perform?`;
        
        suggestions = [
          'Search for user john@company.com',
          'Check user status for sarah@company.com',
          'Show all users',
          'Generate user report'
        ];
        
        actions = [
          { id: 'search_user', label: 'Search User', type: 'primary', action: 'search_user_form' },
          { id: 'user_status', label: 'Check Status', type: 'primary', action: 'user_status_form' },
          { id: 'user_report', label: 'User Reports', type: 'secondary', action: 'user_report_form' }
        ];
      }
      break;

    case 'course_management':
      if (!allowedCategories.includes('course_management')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access Course Management features.`;
      } else {
        response = `📚 **Course Management**\n\nI can help you with the following course management tasks:\n\n${DOCEBO_CATEGORIES.course_management.actions.map(action => `• ${action}`).join('\n')}\n\nWhat specific course management task would you like to perform?`;
        
        suggestions = [
          'Search for Python courses',
          'Show course statistics',
          'Export course data',
          'Find courses with low enrollment'
        ];
        
        actions = [
          { id: 'search_course', label: 'Search Courses', type: 'primary', action: 'search_course_form' },
          { id: 'course_stats', label: 'Course Stats', type: 'primary', action: 'course_stats_query' },
          { id: 'export_courses', label: 'Export Data', type: 'secondary', action: 'export_courses_query' }
        ];
      }
      break;

    case 'enrollments':
      if (!allowedCategories.includes('enrollments')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access Enrollment features.`;
      } else {
        response = `✅ **Enrollment Management**\n\nI can help you with the following enrollment tasks:\n\n${DOCEBO_CATEGORIES.enrollments.actions.map(action => `• ${action}`).join('\n')}\n\nWhat specific enrollment task would you like to perform?`;
        
        suggestions = [
          'Enroll user@company.com in Safety Training',
          'Bulk enroll Marketing team in Excel course',
          'Show enrollment history',
          'Generate enrollment report'
        ];
        
        actions = [
          { id: 'enroll_user', label: 'Enroll User', type: 'primary', action: 'enroll_user_form' },
          { id: 'bulk_enroll', label: 'Bulk Enroll', type: 'primary', action: 'bulk_enroll_form' },
          { id: 'enrollment_report', label: 'View Reports', type: 'secondary', action: 'enrollment_report_query' }
        ];
      }
      break;

    case 'reports':
      if (!allowedCategories.includes('reports')) {
        response = `❌ **Access Denied**\n\nYour role (${userRole}) doesn't have permission to access Reporting features.`;
      } else {
        response = `📊 **Reports & Analytics**\n\nI can help you generate the following reports:\n\n${DOCEBO_CATEGORIES.reports.actions.map(action => `• ${action}`).join('\n')}\n\nWhat type of report would you like to generate?`;
        
        suggestions = [
          'Generate user completion report',
          'Course performance report',
          'Show analytics for all users',
          'Export enrollment data'
        ];
        
        actions = [
          { id: 'user_report', label: 'User Report', type: 'primary', action: 'user_report_form' },
          { id: 'course_report', label: 'Course Report', type: 'primary', action: 'course_stats_query' },
          { id: 'export_data', label: 'Export Data', type: 'secondary', action: 'export_courses_query' }
        ];
      }
      break;

    default:
      response = `🤔 **I'm not sure what you're looking for.**\n\nCould you please clarify what you'd like to do? I can help with:\n\n${allowedCategories.map(cat => `• ${DOCEBO_CATEGORIES[cat as keyof typeof DOCEBO_CATEGORIES].name}`).join('\n')}\n\nTry asking: "What can you help me with?" or be more specific about your request.`;
      
      suggestions = [
        'What can you help me with?',
        'Show me user management options',
        'Help with course management',
        'I need to generate a report'
      ];
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
          '
