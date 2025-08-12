// app/api/chat/route.ts - Fixed imports for Vercel deployment
import { NextRequest, NextResponse } from 'next/server';

// Import from relative paths to avoid module resolution issues
import { DoceboAPI } from '../../../lib/docebo-api-fixed';
import type { DoceboUser, DoceboCourse } from '../../../lib/docebo-api-fixed';

// Environment configuration - inline for deployment reliability
interface EnvironmentConfig {
  docebo: {
    domain: string;
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  };
}

function validateEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getConfig(): EnvironmentConfig {
  return {
    docebo: {
      domain: validateEnvironmentVariable('DOCEBO_DOMAIN', process.env.DOCEBO_DOMAIN),
      clientId: validateEnvironmentVariable('DOCEBO_CLIENT_ID', process.env.DOCEBO_CLIENT_ID),
      clientSecret: validateEnvironmentVariable('DOCEBO_CLIENT_SECRET', process.env.DOCEBO_CLIENT_SECRET),
      username: validateEnvironmentVariable('DOCEBO_USERNAME', process.env.DOCEBO_USERNAME),
      password: validateEnvironmentVariable('DOCEBO_PASSWORD', process.env.DOCEBO_PASSWORD),
    }
  };
}

// Standardized API response interface
interface APIResponse {
  response: string;
  success: boolean;
  action?: string;
  params?: Record<string, any>;
  timestamp: string;
  error?: string;
  missing_fields?: string[];
  examples?: string[];
  available_actions?: Array<{
    name: string;
    description: string;
    examples: string[];
    required_fields: string[];
  }>;
}

// Action Handler Interface
interface ActionHandler {
  name: string;
  description: string;
  examples: string[];
  pattern: (message: string) => boolean;
  requiredFields: string[];
  execute: (api: DoceboAPI, params: ParsedParams) => Promise<string>;
}

// Parsed parameters interface
interface ParsedParams {
  email?: string;
  course?: string;
  level?: string;
  dueDate?: string;
  assignmentType?: string;
}

// Action Registry - Core Phase 1 functionality
const ACTION_REGISTRY: ActionHandler[] = [
  {
    name: 'enroll_user',
    description: 'Enroll a single user in a course',
    examples: [
      'Enroll john@company.com in Python Programming',
      'Add sarah@test.com to Excel Training as mandatory',
      'Enroll mike@company.com in SQL course as optional due 2025-12-31'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return ((lower.includes('enroll ') || lower.includes('add ')) && 
              !lower.includes('what courses') &&
              !lower.includes('show courses') &&
              !lower.includes('who is enrolled') &&
              !lower.includes('who enrolled')) && 
             !lower.includes('bulk') &&
             !lower.includes('group') &&
             !lower.includes('multiple') &&
             !lower.includes('unenroll');
    },
    requiredFields: ['email', 'course'],
    execute: async (api, { email, course, level, dueDate, assignmentType }) => {
      if (!email || !course) {
        throw new Error('Both email and course are required for enrollment');
      }

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: DoceboUser) => 
        u.email.toLowerCase() === email.toLowerCase() ||
        u.fullname.toLowerCase().includes(email.toLowerCase())
      );

      if (!user) {
        return `❌ **User Not Found**: ${email}\n\nDouble-check the email address or try searching by name.`;
      }

      // Find course
      const courses = await api.searchCourses(course, 10);
      const courseObj = courses.find((c: DoceboCourse) => 
        (c.course_name || c.name || '').toLowerCase().includes(course.toLowerCase()) ||
        (c.course_code || '').toLowerCase() === course.toLowerCase()
      );

      if (!courseObj) {
        return `❌ **Course Not Found**: ${course}\n\nTry a shorter course name or check spelling.`;
      }

      // Get course ID using utility method
      const courseId = api.getCourseId(courseObj);
      
      if (!courseId) {
        return `❌ **Course ID Missing**: Found course "${courseObj.course_name || courseObj.name}" but no valid ID`;
      }

      // Prepare enrollment options
      const options = {
        level: level || "3",
        dateExpireValidity: dueDate,
        assignmentType: assignmentType || "none"
      };

      // Attempt enrollment
      const result = await api.enrollUser(user.user_id, courseId, options);
      
      if (result.success) {
        const assignmentText = options.assignmentType && options.assignmentType !== "none" 
          ? options.assignmentType 
          : "standard";
        
        return `✅ **Enrollment Successful**\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${courseObj.course_name || courseObj.name}\n**Level**: ${options.level}\n**Assignment**: ${assignmentText}${options.dateExpireValidity ? `\n**Due Date**: ${options.dateExpireValidity}` : ''}\n\n🎯 Successfully enrolled in Docebo!`;
      } else {
        return `❌ **Enrollment Failed**\n\n**Issue**: ${result.message}\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${courseObj.course_name || courseObj.name}\n\n💡 ${result.message.includes('already enrolled') ? 'User is already enrolled in this course.' : 'Check course rules and user permissions in Docebo admin panel.'}`;
      }
    }
  },
  {
    name: 'get_user_courses',
    description: 'Get all courses a user is enrolled in',
    examples: [
      'What courses is john@company.com enrolled in?',
      'Show sarah@test.com courses',
      'List enrollments for mike@company.com'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('what courses') || 
              lower.includes('show courses') ||
              lower.includes('list courses') ||
              lower.includes('list enrollments') ||
              (lower.includes('courses') && lower.includes('enrolled')) ||
              (lower.includes('enrolled') && lower.includes('in'))) && 
             !lower.includes('who is enrolled') &&
             !lower.includes('enroll ');
    },
    requiredFields: ['email'],
    execute: async (api, { email }) => {
      if (!email) {
        throw new Error('Email address is required');
      }

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: DoceboUser) => 
        u.email.toLowerCase() === email.toLowerCase() ||
        u.fullname.toLowerCase().includes(email.toLowerCase())
      );

      if (!user) {
        return `❌ **User Not Found**: ${email}`;
      }

      // Get enrollments
      const enrollments = await api.getUserEnrollments(user.user_id);
      
      if (enrollments.length === 0) {
        return `📚 **No Enrollments**\n\n${user.fullname} is not enrolled in any courses.`;
      }

      const courseList = enrollments.slice(0, 10).map((e: any, i: number) => {
        const courseName = e.course_name || e.name || 'Unknown Course';
        const status = e.status || e.enrollment_status || '';
        const progress = e.completion_percentage || e.progress_percentage || '';
        
        let statusIcon = '';
        if (status.toLowerCase().includes('completed') || progress === 100) {
          statusIcon = '✅';
        } else if (status.toLowerCase().includes('progress') || progress > 0) {
          statusIcon = '📚';
        } else {
          statusIcon = '⭕';
        }
        
        return `${i + 1}. ${statusIcon} ${courseName}${progress ? ` (${progress}%)` : ''}`;
      }).join('\n');
      
      return `📚 **${user.fullname}'s Courses** (${enrollments.length} total)\n\n${courseList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more courses` : ''}`;
    }
  },
  {
    name: 'get_course_users',
    description: 'Get all users enrolled in a course',
    examples: [
      'Who is enrolled in Python Programming?',
      'Show Excel Training enrollments',
      'List users in SQL course'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('who is enrolled in') || 
              lower.includes('who enrolled in') ||
              lower.includes('who is enrolled') ||
              (lower.includes('show') && lower.includes('enrollments')) ||
              (lower.includes('list') && lower.includes('enrolled')) ||
              (lower.includes('list users') && lower.includes('in'))) &&
             !lower.includes('enroll ') &&
             !lower.includes('what courses');
    },
    requiredFields: ['course'],
    execute: async (api, { course }) => {
      if (!course) {
        throw new Error('Course name is required');
      }

      // Find course
      const courses = await api.searchCourses(course, 10);
      const courseObj = courses.find((c: DoceboCourse) => 
        (c.course_name || c.name || '').toLowerCase().includes(course.toLowerCase()) ||
        (c.course_code || '').toLowerCase() === course.toLowerCase()
      );

      if (!courseObj) {
        return `❌ **Course Not Found**: ${course}`;
      }

      const courseId = api.getCourseId(courseObj);
      if (!courseId) {
        return `❌ **Course ID Missing**: Found course but no valid ID`;
      }

      // Get enrollments
      const enrollments = await api.getCourseEnrollments(courseId);
      
      if (enrollments.length === 0) {
        return `👥 **No Enrollments**\n\nNo users enrolled in "${courseObj.course_name || courseObj.name}".`;
      }

      const userList = enrollments.slice(0, 10).map((e: any, i: number) => {
        const userName = e.user_name || e.fullname || 'Unknown User';
        const userEmail = e.email || e.user_email || '';
        const status = e.status || e.enrollment_status || '';
        const progress = e.completion_percentage || e.progress_percentage || '';
        
        let statusIcon = '';
        if (status.toLowerCase().includes('completed') || progress === 100) {
          statusIcon = '✅';
        } else if (status.toLowerCase().includes('progress') || progress > 0) {
          statusIcon = '📚';
        } else {
          statusIcon = '⭕';
        }
        
        return `${i + 1}. ${statusIcon} ${userName}${userEmail ? ` (${userEmail})` : ''}${progress ? ` - ${progress}%` : ''}`;
      }).join('\n');
      
      return `👥 **"${courseObj.course_name || courseObj.name}" Enrollments** (${enrollments.length} users)\n\n${userList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more users` : ''}`;
    }
  },
  {
    name: 'search_users',
    description: 'Search for users',
    examples: [
      'Find user john@company.com',
      'Search for users named Smith',
      'Look up sarah@test.com'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('find user') || 
              lower.includes('search user') ||
              lower.includes('look up') ||
              lower.includes('search for users')) &&
             !lower.includes('courses');
    },
    requiredFields: ['email'],
    execute: async (api, { email }) => {
      if (!email) {
        throw new Error('Search term is required');
      }

      const users = await api.searchUsers(email, 10);
      
      if (users.length === 0) {
        return `👥 **No Users Found**: No users match "${email}"`;
      }

      const userList = users.slice(0, 5).map((user: DoceboUser, i: number) => {
        const statusIcon = user.status === 'active' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} ${user.fullname} (${user.email}) - ${user.status}`;
      }).join('\n');
      
      return `👥 **User Search Results**: Found ${users.length} users\n\n${userList}${users.length > 5 ? `\n\n... and ${users.length - 5} more users` : ''}`;
    }
  },
  {
    name: 'search_courses',
    description: 'Search for courses',
    examples: [
      'Find Python courses',
      'Search for Excel training',
      'Look up SQL courses'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('find') && lower.includes('course')) ||
             (lower.includes('search') && lower.includes('course')) ||
             (lower.includes('look up') && lower.includes('course')) ||
             lower.includes('python') ||
             lower.includes('javascript') ||
             lower.includes('excel') ||
             lower.includes('sql');
    },
    requiredFields: ['course'],
    execute: async (api, { course }) => {
      if (!course) {
        throw new Error('Course search term is required');
      }

      const courses = await api.searchCourses(course, 10);
      
      if (courses.length === 0) {
        return `📚 **No Courses Found**: No courses match "${course}"`;
      }

      const courseList = courses.slice(0, 5).map((courseItem: DoceboCourse, i: number) => {
        const courseName = courseItem.course_name || courseItem.name || 'Unknown Course';
        const courseType = courseItem.course_type || 'Unknown';
        const statusIcon = courseItem.status === 'active' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} ${courseName} (${courseType})`;
      }).join('\n');
      
      return `📚 **Course Search Results**: Found ${courses.length} courses\n\n${courseList}${courses.length > 5 ? `\n\n... and ${courses.length - 5} more courses` : ''}`;
    }
  }
];

// Command parser with improved extraction
function parseCommand(message: string): { action: ActionHandler | null; params: ParsedParams; missing: string[] } {
  // Extract email
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  
  // Find matching action
  const action = ACTION_REGISTRY.find(a => a.pattern(message));
  
  if (!action) {
    return { action: null, params: {}, missing: [] };
  }

  const params: ParsedParams = {};
  const missing: string[] = [];

  // Parse email
  if (action.requiredFields.includes('email')) {
    if (emailMatch) {
      params.email = emailMatch[0];
    } else {
      // Try to extract name-like patterns
      const namePatterns = [
        /(?:user|find|search)\s+([A-Za-z\s]+?)(?:\s|$)/i,
        /for\s+([A-Za-z\s]+?)(?:\s|$)/i
      ];
      
      for (const pattern of namePatterns) {
        const match = message.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          params.email = match[1].trim();
          break;
        }
      }
      
      if (!params.email) {
        missing.push('email address or user name');
      }
    }
  }

  // Parse course name
  if (action.requiredFields.includes('course')) {
    let course = '';
    
    // Different extraction patterns for different action types
    if (message.toLowerCase().includes('show') || message.toLowerCase().includes('list')) {
      const showPatterns = [
        /show\s+(.+?)\s+enrollments/i,
        /list\s+enrolled\s+users?\s+in\s+(.+)/i,
        /list\s+users\s+in\s+(.+)/i,
        /show\s+(.+)/i,
        /list\s+(.+)/i
      ];
      
      for (const pattern of showPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          course = match[1].trim();
          course = course.replace(/\b(courses?|for|enrollments?|enrolled|users?|training)\b/gi, '').trim();
          break;
        }
      }
    } else if (message.toLowerCase().includes('find') || message.toLowerCase().includes('search')) {
      const searchPatterns = [
        /find\s+(.+?)\s+courses?/i,
        /search\s+for\s+(.+?)\s+courses?/i,
        /look\s+up\s+(.+?)\s+courses?/i,
        /find\s+(.+)/i,
        /search\s+(.+)/i
      ];
      
      for (const pattern of searchPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          course = match[1].trim();
          course = course.replace(/\b(courses?|training|class|program)\b/gi, '').trim();
          break;
        }
      }
    } else {
      // Enrollment patterns
      const enrollPatterns = [
        /(?:in|to)\s+([^(as|due|level|with)]+?)(?:\s+(?:as|due|level|with)|$)/i,
        /"([^"]+)"/,
        /(?:enroll|add).*?(?:in|to)\s+([^(as|due|level|with)]+?)(?:\s+(?:as|due|level|with)|$)/i
      ];
      
      for (const pattern of enrollPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          course = match[1].trim();
          break;
        }
      }
    }
    
    if (course && course.length > 2) {
      params.course = course;
    } else {
      missing.push('course name');
    }
  }

  // Parse optional parameters
  const levelMatch = message.match(/level\s+(\d+)/i);
  if (levelMatch) {
    params.level = levelMatch[1];
  }

  const dueDateMatch = message.match(/due\s+(\d{4}-\d{2}-\d{2})/i) || 
                      message.match(/by\s+(\d{4}-\d{2}-\d{2})/i);
  if (dueDateMatch) {
    params.dueDate = dueDateMatch[1];
  }

  const assignmentMatch = message.match(/\bas\s+(mandatory|required|recommended|optional)/i);
  if (assignmentMatch) {
    params.assignmentType = assignmentMatch[1].toLowerCase();
  }

  return { action, params, missing };
}

// Initialize API client with error handling
let api: DoceboAPI;
try {
  const config = getConfig();
  api = new DoceboAPI(config.docebo);
} catch (error) {
  console.error('❌ Failed to initialize Docebo API:', error);
  // Don't throw here, let individual requests handle the error
}

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse>> {
  try {
    // Initialize API if not already done
    if (!api) {
      try {
        const config = getConfig();
        api = new DoceboAPI(config.docebo);
      } catch (error) {
        return NextResponse.json({
          response: '❌ **Configuration Error**: Missing or invalid environment variables. Please check your Docebo configuration.',
          success: false,
          error: 'Configuration error',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }

    const body = await request.json();
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: '❌ **Invalid Request**: Message is required and must be a string',
        success: false,
        error: 'Message is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Basic security validation
    if (message.includes('<script>') || message.includes('javascript:')) {
      return NextResponse.json({
        response: '❌ **Security Error**: Message contains potentially harmful content',
        success: false,
        error: 'Potentially harmful content detected',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🤖 Processing: "${message}"`);
    
    const { action, params, missing } = parseCommand(message);

    // No action found - show help
    if (!action) {
      const response = `🎯 **Docebo Assistant - Phase 1 MVP**

**Available Commands**:
${ACTION_REGISTRY.map(a => `• **${a.description}**\n  Example: "${a.examples[0]}"`).join('\n\n')}

💡 **Tip**: Use natural language like the examples above!`;
      
      return NextResponse.json({
        response,
        success: false,
        action: 'help',
        available_actions: ACTION_REGISTRY.map(a => ({
          name: a.name,
          description: a.description,
          examples: a.examples,
          required_fields: a.requiredFields
        })),
        timestamp: new Date().toISOString()
      });
    }

    // Missing required fields
    if (missing.length > 0) {
      const response = `❌ **Missing Information**: I need the following to ${action.description}:\n\n${missing.map(m => `• ${m}`).join('\n')}\n\n**Example**: "${action.examples[0]}"`;
      
      return NextResponse.json({
        response,
        success: false,
        action: action.name,
        missing_fields: missing,
        examples: action.examples,
        timestamp: new Date().toISOString()
      });
    }

    // Execute the action
    try {
      const response = await action.execute(api, params);
      
      return NextResponse.json({
        response,
        success: !response.includes('❌'),
        action: action.name,
        params: params,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ Action ${action.name} failed:`, error);
      
      const errorResponse = `❌ **${action.description} Failed**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`;
      
      return NextResponse.json({
        response: errorResponse,
        success: false,
        action: action.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    // Test API connectivity if possible
    let healthStatus = { status: 'unknown', timestamp: new Date() };
    
    if (api) {
      try {
        healthStatus = await api.healthCheck();
      } catch (error) {
        console.warn('Health check failed:', error);
      }
    }
    
    return NextResponse.json({
      status: 'Docebo Chat API - Phase 1 MVP Ready',
      version: '1.0.0',
      health: healthStatus,
      features: [
        'Natural language enrollment management',
        'User and course search',
        'Enrollment status checking',
        'Real-time Docebo integration'
      ],
      available_actions: ACTION_REGISTRY.map(action => ({
        name: action.name,
        description: action.description,
        examples: action.examples,
        required_fields: action.requiredFields
      })),
      examples: [
        "Enroll john@company.com in Python Programming",
        "Enroll sarah@test.com in Excel Training as mandatory", 
        "Add mike@company.com to SQL course as optional due 2025-12-31",
        "What courses is john@company.com enrolled in?",
        "Who is enrolled in Leadership Training?",
        "Find user sarah@test.com",
        "Search for Python courses"
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'Docebo Chat API - Configuration Error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
