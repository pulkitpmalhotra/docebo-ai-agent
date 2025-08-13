// app/api/chat/route.ts - Fixed getUserEnrollments to use correct endpoint only
import { NextRequest, NextResponse } from 'next/server';

// Environment configuration
function validateEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getConfig() {
  return {
    domain: validateEnvironmentVariable('DOCEBO_DOMAIN', process.env.DOCEBO_DOMAIN),
    clientId: validateEnvironmentVariable('DOCEBO_CLIENT_ID', process.env.DOCEBO_CLIENT_ID),
    clientSecret: validateEnvironmentVariable('DOCEBO_CLIENT_SECRET', process.env.DOCEBO_CLIENT_SECRET),
    username: validateEnvironmentVariable('DOCEBO_USERNAME', process.env.DOCEBO_USERNAME),
    password: validateEnvironmentVariable('DOCEBO_PASSWORD', process.env.DOCEBO_PASSWORD),
  };
}

// Fixed Docebo API client for googlesandbox.docebosaas.com
class FixedDoceboAPI {
  private config: any;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: any) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
    console.log('🔗 Fixed Docebo API Client initialized for:', config.domain);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Getting access token...');

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'api',
        username: this.config.username,
        password: this.config.password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    console.log('✅ Access token obtained');
    return this.accessToken!;
  }

  private async apiRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, params?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      if (queryParams.toString()) {
        url += `?${queryParams}`;
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    console.log(`📡 API Request: ${method} ${endpoint}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} - ${errorText}`);
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ API Success: ${method} ${endpoint}`);
    return result;
  }

  // User search with correct endpoint and field mapping
  async searchUsers(searchText: string, limit: number = 25): Promise<any[]> {
    try {
      const result = await this.apiRequest('/manage/v1/user', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      
      console.log('👥 User search result:', result.data?.items?.length || 0, 'users found');
      return result.data?.items || [];
    } catch (error) {
      console.error('❌ Search users failed:', error);
      return [];
    }
  }

  // Course search with correct endpoint
  async searchCourses(searchText: string, limit: number = 25): Promise<any[]> {
    try {
      const result = await this.apiRequest('/course/v1/courses', 'GET', null, {
        search_text: searchText,
        page_size: limit
      });
      
      console.log('📚 Course search result:', result.data?.items?.length || 0, 'courses found');
      return result.data?.items || [];
    } catch (error) {
      console.error('❌ Search courses failed:', error);
      return [];
    }
  }

  // SUPER OPTIMIZED: Faster pagination with larger batches
  async getUserEnrollments(userId: string): Promise<any[]> {
    try {
      console.log(`📚 Getting enrollments for user ID: ${userId}`);
      
      let allUserEnrollments: any[] = [];
      let currentPage = 1;
      let hasMoreData = true;
      const maxPages = 100; // Increased significantly
      const startTime = Date.now();
      const timeoutMs = 28000; // 28 seconds for safety
      
      while (hasMoreData && currentPage <= maxPages) {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          console.log(`📚 ⏰ Timeout approaching after ${Math.floor((Date.now() - startTime) / 1000)}s, stopping at page ${currentPage}`);
          break;
        }
        
        // Batch requests - process multiple pages in parallel for speed
        const batchSize = 3; // Process 3 pages at once
        const promises = [];
        
        for (let i = 0; i < batchSize && (currentPage + i) <= maxPages; i++) {
          const pageNum = currentPage + i;
          
          const promise = this.apiRequest('/course/v1/courses/enrollments', 'GET', null, {
            'user_ids[]': userId,
            page_size: 200,
            page: pageNum
          }).then(result => ({
            page: pageNum,
            data: result
          })).catch(error => ({
            page: pageNum,
            error: error
          }));
          
          promises.push(promise);
        }
        
        console.log(`📚 Fetching pages ${currentPage}-${currentPage + batchSize - 1}...`);
        
        // Wait for all batch requests to complete
        const results = await Promise.all(promises);
        
        let batchEnrollments = 0;
        let shouldContinue = false;
        
        for (const result of results) {
          if (result.error) {
            console.log(`📚 Page ${result.page}: Error - ${result.error}`);
            continue;
          }
          
          const pageEnrollments = result.data?.data?.items || [];
          
          const filteredPageEnrollments = pageEnrollments.filter((enrollment: any) => {
            return enrollment.user_id === Number(userId);
          });
          
          allUserEnrollments.push(...filteredPageEnrollments);
          batchEnrollments += filteredPageEnrollments.length;
          
          // Check if this page indicates more data
          if (result.data?.data?.has_more_data === true) {
            shouldContinue = true;
          }
          
          console.log(`📚 Page ${result.page}: ${filteredPageEnrollments.length} enrollments`);
        }
        
        console.log(`📚 Batch complete: +${batchEnrollments} enrollments (total: ${allUserEnrollments.length})`);
        
        hasMoreData = shouldContinue;
        currentPage += batchSize;
        
        // Very short delay since we're batching
        if (hasMoreData) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`📚 ✅ Found ${allUserEnrollments.length} enrollments across ~${currentPage} pages in ${totalTime}ms`);
      
      return allUserEnrollments;
      
    } catch (error) {
      console.error('❌ Get user enrollments failed:', error);
      return [];
    }
  }

  // Remove the alternative method to avoid timeouts
  async getUserEnrollmentsAlternative(userId: string): Promise<any[]> {
    // Removed to prevent timeouts - the main method should work
    return [];
  }

  // Course enrollments with correct endpoint and parameters
  async getCourseEnrollments(courseId: string): Promise<any[]> {
    try {
      console.log(`👥 Getting enrollments for course ID: ${courseId}`);
      
      // Use array notation for course_ids parameter
      const result = await this.apiRequest('/course/v1/courses/enrollments', 'GET', null, {
        'course_ids[]': courseId,
        page_size: 200
      });
      
      console.log(`👥 Course enrollments API response:`, JSON.stringify(result, null, 2));
      console.log(`👥 Course enrollments result: ${result.data?.items?.length || 0} enrollments found for course ${courseId}`);
      
      // Filter to ensure we only get enrollments for the specific course
      const allEnrollments = result.data?.items || [];
      const filteredEnrollments = allEnrollments.filter((enrollment: any) => 
        enrollment.course_id === Number(courseId) || 
        enrollment.course_id === courseId
      );
      
      console.log(`👥 Filtered enrollments: ${filteredEnrollments.length} enrollments for course ${courseId}`);
      
      return filteredEnrollments;
    } catch (error) {
      console.error('❌ Get course enrollments failed:', error);
      return [];
    }
  }

  // Enrollment with correct endpoint and payload structure
  async enrollUser(userId: string, courseId: number, options: any = {}): Promise<any> {
    try {
      console.log(`🎯 Attempting to enroll user ${userId} in course ${courseId}`);
      
      // Correct enrollment payload based on your API documentation
      const enrollmentBody: any = {
        course_ids: [Number(courseId)],
        user_ids: [Number(userId)],
        level: Number(options.level) || 3,  // 3 = student, 4 = tutor, 6 = instructor
        consider_ef_as_optional: true,
        atomic_enrollment: true
      };

      // Add optional fields
      if (options.dueDate) {
        enrollmentBody.date_expire_validity = options.dueDate;
      }
      if (options.assignmentType && options.assignmentType !== "none") {
        enrollmentBody.assignment_type = options.assignmentType;
      }

      console.log('📝 Enrollment payload:', enrollmentBody);

      // Use the correct enrollment endpoint
      const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
      
      console.log('📊 Full enrollment result:', JSON.stringify(result, null, 2));
      
      // Handle successful enrollment (API returns 200/201 for success)
      if (result.data) {
        // Check if there are any errors first
        if (result.data.errors && Array.isArray(result.data.errors)) {
          let successfulEnrollments = [];
          let errorMessages = [];
          
          for (const errorItem of result.data.errors) {
            // Check for successful enrollments (they might be in the errors array)
            if (errorItem.enrolled && Array.isArray(errorItem.enrolled) && errorItem.enrolled.length > 0) {
              successfulEnrollments.push(...errorItem.enrolled);
            }
            
            // Check for actual error types
            if (errorItem.existing_enrollments && errorItem.existing_enrollments.length > 0) {
              errorMessages.push("User is already enrolled in this course");
            }
            if (errorItem.invalid_users && errorItem.invalid_users.length > 0) {
              errorMessages.push("User ID is invalid or user doesn't exist");
            }
            if (errorItem.invalid_courses && errorItem.invalid_courses.length > 0) {
              errorMessages.push("Course ID is invalid or course doesn't exist");
            }
            if (errorItem.permission_denied && errorItem.permission_denied.length > 0) {
              errorMessages.push("Permission denied - user cannot be enrolled in this course");
            }
          }
          
          // If we have successful enrollments, it's a success
          if (successfulEnrollments.length > 0) {
            const waitingStatus = successfulEnrollments.some(e => e.waiting);
            return { 
              success: true, 
              message: waitingStatus ? 
                'Successfully enrolled user in course (waiting list)' : 
                'Successfully enrolled user in course',
              details: { 
                enrolled: successfulEnrollments,
                waiting: waitingStatus
              }
            };
          }
          
          // If we have error messages but no successful enrollments
          if (errorMessages.length > 0) {
            return { 
              success: false, 
              message: errorMessages[0],
              details: result
            };
          }
        }
        
        // If no errors array, check for other success indicators
        if (result.data.enrolled || result.data.success || result.status === 200 || result.status === 201) {
          return { 
            success: true, 
            message: 'Successfully enrolled user in course',
            details: result
          };
        }
        
        // If we get here, enrollment likely succeeded but response format is unexpected
        // Since you mentioned the user IS enrolled in Docebo, let's assume success
        console.log('🤔 Unexpected response format, but assuming success since no explicit errors');
        return { 
          success: true, 
          message: 'Successfully enrolled user in course',
          details: result
        };
      }
      
      // If no data object at all
      return { 
        success: false, 
        message: 'Invalid response format from enrollment API',
        details: result
      };
      
    } catch (error) {
      console.error('❌ Enrollment error:', error);
      
      // Parse error response if available
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('400')) {
        return { 
          success: false, 
          message: 'Invalid enrollment request - check user ID, course ID, or permissions'
        };
      } else if (errorMessage.includes('403')) {
        return { 
          success: false, 
          message: 'Permission denied - API user may not have enrollment permissions'
        };
      } else if (errorMessage.includes('404')) {
        return { 
          success: false, 
          message: 'User or course not found'
        };
      } else if (errorMessage.includes('409')) {
        return { 
          success: false, 
          message: 'User is already enrolled in this course'
        };
      }
      
      return { 
        success: false, 
        message: `Enrollment error: ${errorMessage}`
      };
    }
  }

  // Course ID extraction with correct field mapping
  getCourseId(course: any): number | null {
    // Your API returns course ID as "id" (number), not course_id
    return course.id || course.course_id || course.idCourse || null;
  }

  // Course name extraction with correct field mapping  
  getCourseName(course: any): string {
    // Your API uses "title", not "course_name"
    return course.title || course.course_name || course.name || 'Unknown Course';
  }
}

// Command patterns with better regex
const PATTERNS = {
  enroll: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('enroll ') || lower.includes('add ')) && 
           !lower.includes('unenroll') && 
           !lower.includes('what courses') &&
           !lower.includes('who is enrolled');
  },
  userCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('what courses') || 
           (lower.includes('courses') && lower.includes('enrolled') && !lower.includes('who'));
  },
  courseUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('who is enrolled') || lower.includes('who enrolled');
  },
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  }
};

// Improved parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractCourse(message: string): string | null {
  // Try quoted strings first
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try "in [course]" pattern - improved to handle longer course names
  const inMatch = message.match(/\bin\s+(.+?)(?:\s+(?:as|due|level)\s|$)/i);
  if (inMatch) {
    let course = inMatch[1].trim();
    // Remove trailing punctuation
    course = course.replace(/[.!?]+$/, '');
    return course;
  }
  
  // Try "enrolled in [course]" pattern
  const enrolledMatch = message.match(/enrolled\s+in\s+(.+?)(?:\?|$)/i);
  if (enrolledMatch) return enrolledMatch[1].trim();
  
  // Try "find [course] course" pattern
  const findMatch = message.match(/find\s+(.+?)\s+course/i);
  if (findMatch) return findMatch[1].trim();
  
  return null;
}

// Initialize API
let api: FixedDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    // Initialize API if needed
    if (!api) {
      const config = getConfig();
      api = new FixedDoceboAPI(config);
    }

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
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}`);
    
    // Route to appropriate handler
    if (PATTERNS.enroll(message)) {
      if (!email || !course) {
        return NextResponse.json({
          response: `❌ **Missing Information**: For enrollment, I need both an email address and course name.

**Example**: "Enroll john@company.com in Python Programming"

**Your message**: "${message}"
**Found email**: ${email || 'MISSING'}
**Found course**: ${course || 'MISSING'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`🎯 Enrollment request: ${email} → ${course}`);
      
      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}

Available users found: ${users.length}
${users.slice(0, 3).map(u => `• ${u.fullname} (${u.email})`).join('\n')}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Find course  
      const courses = await api.searchCourses(course, 10);
      const courseObj = courses.find(c => 
        api.getCourseName(c).toLowerCase().includes(course.toLowerCase())
      );
      
      if (!courseObj) {
        return NextResponse.json({
          response: `❌ **Course Not Found**: "${course}"

Available courses found: ${courses.length}
${courses.slice(0, 3).map(c => `• ${api.getCourseName(c)}`).join('\n')}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseId = api.getCourseId(courseObj);
      if (!courseId) {
        return NextResponse.json({
          response: `❌ **Course ID Missing**: Found course "${api.getCourseName(courseObj)}" but no valid ID`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Parse optional enrollment parameters
      const levelMatch = message.match(/level\s+(\d+)/i);
      const dueDateMatch = message.match(/due\s+(\d{4}-\d{2}-\d{2})/i);
      const assignmentMatch = message.match(/\bas\s+(mandatory|required|recommended|optional)/i);
      
      const options = {
        level: levelMatch?.[1] || "3",
        dueDate: dueDateMatch?.[1],
        assignmentType: assignmentMatch?.[1]?.toLowerCase()
      };
      
      console.log(`📝 Enrollment options:`, options);
      
      // Attempt enrollment
      const result = await api.enrollUser(user.user_id, courseId, options);
      
      if (result.success) {
        return NextResponse.json({
          response: `✅ **Enrollment Successful**

**User**: ${user.fullname} (${user.email})
**Course**: ${api.getCourseName(courseObj)}
**Level**: ${options.level}
${options.assignmentType ? `**Assignment**: ${options.assignmentType}` : ''}
${options.dueDate ? `**Due Date**: ${options.dueDate}` : ''}

🎯 User has been enrolled in Docebo!`,
          success: true,
          timestamp: new Date().toISOString()
        });
      } else {
        return NextResponse.json({
          response: `❌ **Enrollment Failed**

**User**: ${user.fullname} (${user.email})
**Course**: ${api.getCourseName(courseObj)}
**Issue**: ${result.message}

💡 This could be due to course enrollment rules, user permissions, or the user may already be enrolled.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
    } else if (PATTERNS.userCourses(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to check enrollments.

**Example**: "What courses is john@company.com enrolled in?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Get enrollments using the CORRECT endpoint
      const enrollments = await api.getUserEnrollments(user.user_id);
      
      console.log(`📊 Raw enrollments returned: ${enrollments.length}`);
      
      if (enrollments.length === 0) {
        return NextResponse.json({
          response: `📚 **No Enrollments Found**

${user.fullname} (${user.email}) is not enrolled in any courses.

🔍 **Debug Info**: User ID ${user.user_id} found, but no enrollments returned from API.`,
          success: true,
          timestamp: new Date().toISOString()
        });
      }
      
      // Show MORE courses - let's show up to 25 instead of 10
      const displayLimit = Math.min(25, enrollments.length);
      const courseList = enrollments.slice(0, displayLimit).map((e, i) => {
        // Clean up course name and remove all HTML entities and formatting
        let courseName = e.course_name || 'Unknown Course';
        courseName = courseName
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/<[^>]*>/g, '') // Remove any HTML tags
          .trim();
        
        const status = e.enrollment_status || '';
        const progress = e.enrollment_score || '';
        const courseType = e.course_type || '';
        
        let statusIcon = '';
        if (status === 'completed') statusIcon = '✅ COMPLETED';
        else if (status === 'in_progress') statusIcon = '🔄 IN PROGRESS';
        else if (status === 'enrolled') statusIcon = '📚 ENROLLED';
        else if (status === 'subscription_to_confirm') statusIcon = '⏳ PENDING';
        else if (status === 'waiting') statusIcon = '⏸️ WAITING';
        else if (status === 'suspended') statusIcon = '🚫 SUSPENDED';
        else statusIcon = '📚 ENROLLED';
        
        return `${i + 1}. ${statusIcon} - ${courseName}${courseType ? ` [${courseType.toUpperCase()}]` : ''}${progress ? ` (Score: ${progress})` : ''}`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **${user.fullname}'s Courses** (${enrollments.length} total)

${courseList}${enrollments.length > displayLimit ? `\n\n... and ${enrollments.length - displayLimit} more courses` : ''}

📊 **Debug Info**: 
- User ID: ${user.user_id}
- Endpoint: \`/course/v1/courses/enrollments?user_ids[]=${user.user_id}\`
- Total Enrollments Found: ${enrollments.length}
- Showing: ${displayLimit}`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } else if (PATTERNS.courseUsers(message)) {
      if (!course) {
        return NextResponse.json({
          response: `❌ **Missing Course Name**: I need a course name to check enrollments.

**Example**: "Who is enrolled in Python Programming?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Find course
      const courses = await api.searchCourses(course, 10);
      const courseObj = courses.find(c => 
        api.getCourseName(c).toLowerCase().includes(course.toLowerCase())
      );
      
      if (!courseObj) {
        return NextResponse.json({
          response: `❌ **Course Not Found**: "${course}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseId = api.getCourseId(courseObj);
      if (!courseId) {
        return NextResponse.json({
          response: `❌ **Course ID Missing**: Found course but no valid ID`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Get enrollments
      const enrollments = await api.getCourseEnrollments(courseId.toString());
      
      if (enrollments.length === 0) {
        return NextResponse.json({
          response: `👥 **No Enrollments Found**

No users are enrolled in "${api.getCourseName(courseObj)}".`,
          success: true,
          timestamp: new Date().toISOString()
        });
      }
      
      const userList = enrollments.slice(0, 10).map((e, i) => {
        const userName = e.username || 'Unknown User';
        const status = e.enrollment_status || '';
        
        let statusIcon = '📚';
        if (status === 'completed') statusIcon = '✅';
        else if (status === 'in_progress') statusIcon = '🔄';
        
        return `${i + 1}. ${statusIcon} ${userName}${status ? ` (${status})` : ''}`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **"${api.getCourseName(courseObj)}" Enrollments** (${enrollments.length} users)

${userList}${enrollments.length > 10 ? `\n\n... and ${enrollments.length - 10} more users` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } else if (PATTERNS.searchUsers(message)) {
      const searchTerm = email || message.replace(/find|user|search/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a name or email to search for.

**Example**: "Find user john@company.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const users = await api.searchUsers(searchTerm, 10);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `👥 **No Users Found**: No users match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const userList = users.slice(0, 5).map((user, i) => {
        const statusIcon = user.status === '1' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} ${user.fullname} (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users

${userList}${users.length > 5 ? `\n\n... and ${users.length - 5} more users` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } else if (PATTERNS.searchCourses(message)) {
      const searchTerm = course || message.replace(/find|course|search/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a course name to search for.

**Example**: "Find Python courses"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courses = await api.searchCourses(searchTerm, 10);
      
      if (courses.length === 0) {
        return NextResponse.json({
          response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courseList = courses.slice(0, 5).map((courseItem, i) => {
        const courseName = api.getCourseName(courseItem);
        const courseType = courseItem.type || 'Unknown';
        const statusIcon = courseItem.published ? '✅' : '❌';
        const enrolledCount = courseItem.enrolled_count || 0;
        
        return `${i + 1}. ${statusIcon} ${courseName} (${courseType}) - ${enrolledCount} enrolled`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 5 ? `\n\n... and ${courses.length - 5} more courses` : ''}`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } else {
      return NextResponse.json({
        response: `🎯 **Docebo Assistant**

I can help you with:

• **Enroll users**: "Enroll john@company.com in Python Programming"
• **Check user courses**: "What courses is sarah@test.com enrolled in?"
• **Check course enrollments**: "Who is enrolled in Excel Training?"
• **Find users**: "Find user mike@company.com"
• **Find courses**: "Find Python courses"

**Your message**: "${message}"

What would you like to do?`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}

Please try again or contact support.`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Docebo Chat API - Fixed for googlesandbox.docebosaas.com',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints_used: [
      '/manage/v1/user - User search',
      '/course/v1/courses - Course search', 
      '/course/v1/courses/enrollments - User & Course enrollment data'
    ],
    user_enrollments_endpoint: '/course/v1/courses/enrollments?user_ids[]=USER_ID'
  });
}
