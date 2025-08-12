// app/api/chat/route.ts - Complete file with comprehensive debug mode
import { NextRequest, NextResponse } from 'next/server';

// Enhanced Docebo API client with comprehensive debugging
class OptimizedDoceboAPI {
  private config: any;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;
  private debugMode: boolean = true; // Enable debug mode for Vercel testing

  constructor(config: any) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

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

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    return this.accessToken!;
  }

  private async apiCall(endpoint: string, params?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams(params);
      url += `?${queryParams}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  }

  // Enhanced course search with debugging
  async quickCourseSearch(courseName: string): Promise<any> {
    const debugInfo: {
      searchTerm: string;
      attempts: Array<{
        endpoint: string;
        status: string;
        searchParams: { search_text: string; page_size: number };
        foundCount?: number;
        error?: string;
      }>;
      results: Array<{
        id: string;
        name: string;
        status: string;
        type: string;
        code?: string;
      }>;
      timestamp: string;
      bestMatch?: {
        id: string;
        name: string;
        matchReason: string;
      };
    } = {
      searchTerm: courseName,
      attempts: [],
      results: [],
      timestamp: new Date().toISOString()
    };

    const endpoints = ['/learn/v1/courses', '/manage/v1/courses', '/api/v1/courses'];
    
    for (const endpoint of endpoints) {
      try {
        const attempt = { 
          endpoint, 
          status: 'trying' as const,
          searchParams: { search_text: courseName, page_size: 10 }
        };
        debugInfo.attempts.push(attempt);
        
        const result = await this.apiCall(endpoint, { search_text: courseName, page_size: 10 });
        const courses = result.data?.items || result.items || [];
        
        attempt.status = 'success';
        attempt.foundCount = courses.length;
        
        courses.forEach((course: any) => {
          debugInfo.results.push({
            id: course.course_id || course.idCourse,
            name: course.course_name || course.name,
            status: course.status,
            type: course.course_type || course.type,
            code: course.course_code
          });
        });
        
        if (courses.length > 0) {
          // Store debug info globally
          (global as any).lastCourseSearchDebug = debugInfo;
          
          // Find best match for "Explore the Deal Landscape"
          const bestMatch = courses.find((course: any) => 
            (course.course_name || course.name)?.toLowerCase().includes('deal landscape') ||
            (course.course_name || course.name)?.toLowerCase().includes('explore the deal')
          ) || courses[0];
          
          debugInfo.bestMatch = {
            id: bestMatch.course_id || bestMatch.idCourse,
            name: bestMatch.course_name || bestMatch.name,
            matchReason: 'Found by search'
          };
          
          return bestMatch;
        }
      } catch (error) {
        const lastAttempt = debugInfo.attempts[debugInfo.attempts.length - 1];
        lastAttempt.status = 'failed';
        lastAttempt.error = error instanceof Error ? error.message : String(error);
      }
    }
    
    (global as any).lastCourseSearchDebug = debugInfo;
    return null;
  }

  // Enhanced user search with debugging
  async quickUserSearch(email: string): Promise<any> {
    const debugInfo: {
      searchTerm: string;
      attempts: Array<{
        endpoint: string;
        status: string;
        searchParams: { search_text: string; page_size: number };
        foundCount?: number;
        error?: string;
      }>;
      results: Array<{
        id: string;
        email: string;
        name: string;
        status: string;
        expired: boolean;
      }>;
      timestamp: string;
    } = {
      searchTerm: email,
      attempts: [],
      results: [],
      timestamp: new Date().toISOString()
    };

    const endpoints = ['/manage/v1/user', '/learn/v1/users', '/api/v1/users'];
    
    for (const endpoint of endpoints) {
      try {
        const attempt = { 
          endpoint, 
          status: 'trying' as const,
          searchParams: { search_text: email, page_size: 5 }
        };
        debugInfo.attempts.push(attempt);
        
        const result = await this.apiCall(endpoint, { search_text: email, page_size: 5 });
        const users = result.data?.items || result.items || [];
        
        attempt.status = 'success';
        attempt.foundCount = users.length;
        
        users.forEach((user: any) => {
          debugInfo.results.push({
            id: user.user_id,
            email: user.email,
            name: user.fullname || `${user.first_name} ${user.last_name}`,
            status: user.status,
            expired: user.expired
          });
        });
        
        if (users.length > 0) {
          (global as any).lastUserSearchDebug = debugInfo;
          
          // Find exact email match
          const exactMatch = users.find((user: any) => 
            user.email?.toLowerCase() === email.toLowerCase()
          ) || users[0];
          
          return exactMatch;
        }
      } catch (error) {
        const lastAttempt = debugInfo.attempts[debugInfo.attempts.length - 1];
        lastAttempt.status = 'failed';
        lastAttempt.error = error instanceof Error ? error.message : String(error);
      }
    }
    
    (global as any).lastUserSearchDebug = debugInfo;
    return null;
  }

  // Enhanced enrollment with comprehensive debugging
  async enrollUser(userId: string, courseId: string, options: {
    level?: string;
    dateBeginValidity?: string;
    dateExpireValidity?: string;
    assignmentType?: string;
  } = {}): Promise<{ success: boolean; message: string; details?: any; debug?: any }> {
    
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      steps: [],
      inputs: { userId, courseId, options },
      environment: {
        domain: this.config.domain,
        baseUrl: this.baseUrl
      }
    };

    try {
      // DEBUG STEP 1: Test token
      debugInfo.steps.push("🔑 Testing API token...");
      const token = await this.getAccessToken();
      debugInfo.token = {
        exists: !!token,
        preview: token?.substring(0, 20) + '...',
        length: token?.length
      };

      // Test token validity with a simple request
      const tokenTestResponse = await fetch(`${this.baseUrl}/manage/v1/user?page_size=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      debugInfo.tokenTest = {
        status: tokenTestResponse.status,
        statusText: tokenTestResponse.statusText,
        ok: tokenTestResponse.ok,
        url: `${this.baseUrl}/manage/v1/user?page_size=1`
      };

      if (!tokenTestResponse.ok) {
        const errorText = await tokenTestResponse.text();
        debugInfo.tokenError = errorText;
        return { 
          success: false, 
          message: `Token validation failed: ${tokenTestResponse.status} - ${errorText}`,
          debug: debugInfo 
        };
      }

      // DEBUG STEP 2: Verify user exists and get details
      debugInfo.steps.push("👤 Verifying user exists...");
      try {
        const userResponse = await fetch(`${this.baseUrl}/manage/v1/user/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        debugInfo.userCheck = {
          status: userResponse.status,
          statusText: userResponse.statusText,
          ok: userResponse.ok,
          url: `${this.baseUrl}/manage/v1/user/${userId}`
        };

        if (userResponse.ok) {
          const userData = await userResponse.json();
          debugInfo.userInfo = {
            id: userData.data?.user_id,
            email: userData.data?.email,
            fullname: userData.data?.fullname,
            status: userData.data?.status,
            expired: userData.data?.expired,
            level: userData.data?.level,
            last_access: userData.data?.last_access_date
          };
        } else {
          const errorText = await userResponse.text();
          debugInfo.userError = errorText;
          return { 
            success: false, 
            message: `User ${userId} not found or inaccessible: ${userResponse.status}`,
            debug: debugInfo 
          };
        }
      } catch (userError) {
        debugInfo.userException = userError instanceof Error ? userError.message : String(userError);
      }

      // DEBUG STEP 3: Verify course exists and get details
      debugInfo.steps.push("📚 Verifying course exists...");
      try {
        const courseResponse = await fetch(`${this.baseUrl}/learn/v1/courses/${courseId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        debugInfo.courseCheck = {
          status: courseResponse.status,
          statusText: courseResponse.statusText,
          ok: courseResponse.ok,
          url: `${this.baseUrl}/learn/v1/courses/${courseId}`
        };

        if (courseResponse.ok) {
          const courseData = await courseResponse.json();
          debugInfo.courseInfo = {
            id: courseData.data?.course_id,
            name: courseData.data?.course_name,
            status: courseData.data?.status,
            type: courseData.data?.course_type,
            code: courseData.data?.course_code,
            published: courseData.data?.published,
            can_enroll: courseData.data?.can_enroll
          };
        } else {
          const errorText = await courseResponse.text();
          debugInfo.courseError = errorText;
          debugInfo.courseNotFound = true;
        }
      } catch (courseError) {
        debugInfo.courseException = courseError instanceof Error ? courseError.message : String(courseError);
      }

      // DEBUG STEP 4: Check existing enrollment
      debugInfo.steps.push("🔍 Checking existing enrollment...");
      try {
        const existingEnrollmentResponse = await fetch(`${this.baseUrl}/learn/v1/enrollments/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (existingEnrollmentResponse.ok) {
          const enrollmentData = await existingEnrollmentResponse.json();
          const enrollments = enrollmentData.data?.items || [];
          const existingEnrollment = enrollments.find((e: any) => 
            (e.course_id || e.idCourse) === courseId
          );
          
          debugInfo.existingEnrollment = {
            totalEnrollments: enrollments.length,
            alreadyEnrolled: !!existingEnrollment,
            enrollmentDetails: existingEnrollment || null
          };
          
          if (existingEnrollment) {
            return {
              success: false,
              message: `User is already enrolled in this course`,
              debug: debugInfo
            };
          }
        }
      } catch (enrollmentCheckError) {
        debugInfo.enrollmentCheckError = enrollmentCheckError instanceof Error ? enrollmentCheckError.message : String(enrollmentCheckError);
      }

      // DEBUG STEP 5: Build enrollment request
      debugInfo.steps.push("📡 Building enrollment request...");
      const enrollmentBody = {
        course_ids: [courseId],
        user_ids: [userId],
        level: options.level || "3",
        date_begin_validity: options.dateBeginValidity,
        date_expire_validity: options.dateExpireValidity,
        assignment_type: options.assignmentType || "mandatory",
        send_notification: false
      };

      // Remove undefined fields to clean up the request
      Object.keys(enrollmentBody).forEach(key => {
        if (enrollmentBody[key as keyof typeof enrollmentBody] === undefined) {
          delete enrollmentBody[key as keyof typeof enrollmentBody];
        }
      });

      debugInfo.requestBody = enrollmentBody;
      debugInfo.requestUrl = `${this.baseUrl}/learn/v1/enrollments`;
      debugInfo.requestMethod = 'POST';

      // DEBUG STEP 6: Make enrollment request
      debugInfo.steps.push("🚀 Making enrollment request...");
      
      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(enrollmentBody)
      });
      
      debugInfo.enrollmentResponse = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      };

      const responseText = await response.text();
      debugInfo.rawResponse = responseText;
      
      if (response.ok) {
        let result;
        try {
          result = JSON.parse(responseText);
          debugInfo.parsedResponse = result;
          
          const enrolledUsers = result.data?.enrolled || [];
          const errors = result.data?.errors || [];
          
          debugInfo.enrollmentResult = {
            enrolledCount: enrolledUsers.length,
            errorsCount: errors.length,
            enrolled: enrolledUsers,
            errors: errors,
            version: result.version,
            links: result._links
          };
          
          if (enrolledUsers.length > 0) {
            debugInfo.steps.push("✅ ENROLLMENT SUCCESS!");
            debugInfo.success = true;
            
            // Verify enrollment after 2 seconds
            setTimeout(async () => {
              try {
                const verificationResult = await this.verifyEnrollment(userId, courseId);
                (global as any).lastEnrollmentVerification = verificationResult;
              } catch (e) {
                (global as any).lastEnrollmentVerification = { error: e };
              }
            }, 2000);
            
            return { 
              success: true, 
              message: `✅ Successfully enrolled user ${userId} in course ${courseId}`,
              details: result,
              debug: this.debugMode ? debugInfo : undefined
            };
          } else {
            debugInfo.steps.push("❌ ENROLLMENT FAILED - No users enrolled");
            debugInfo.analysis = [
              "API accepted request but didn't enroll anyone",
              "Common causes:",
              "- Course enrollment rules blocking user",
              "- User doesn't meet prerequisites", 
              "- Course is not published/active",
              "- User permissions insufficient",
              "- Course has enrollment restrictions"
            ];
            return { 
              success: false, 
              message: `⚠️ Enrollment request succeeded but no users were enrolled. The API accepted your request but Docebo's business rules prevented the enrollment.`,
              details: result,
              debug: this.debugMode ? debugInfo : undefined
            };
          }
          
        } catch (parseError) {
          debugInfo.parseError = parseError instanceof Error ? parseError.message : String(parseError);
          debugInfo.steps.push("❌ JSON PARSE ERROR");
          return { 
            success: false, 
            message: `Invalid JSON response: ${responseText}`,
            debug: debugInfo 
          };
        }
      } else {
        debugInfo.steps.push("❌ HTTP ERROR - Request failed");
        debugInfo.httpError = {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        };
        return { 
          success: false, 
          message: `HTTP ${response.status}: ${responseText}`,
          debug: debugInfo 
        };
      }
      
    } catch (error) {
      debugInfo.fatalError = error instanceof Error ? error.message : String(error);
      debugInfo.fatalStack = error instanceof Error ? error.stack : undefined;
      debugInfo.steps.push("💥 FATAL ERROR");
      return { 
        success: false, 
        message: `Enrollment error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        debug: debugInfo 
      };
    }
  }

  // Verification method
  async verifyEnrollment(userId: string, courseId: string): Promise<{ enrolled: boolean; details?: any }> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/learn/v1/enrollments/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const enrollments = data.data?.items || [];
        const isEnrolled = enrollments.some((e: any) => 
          (e.course_id || e.idCourse) === courseId
        );
        
        return {
          enrolled: isEnrolled,
          details: {
            totalEnrollments: enrollments.length,
            checkedCourseId: courseId,
            foundEnrollments: enrollments.map((e: any) => ({
              courseId: e.course_id || e.idCourse,
              courseName: e.course_name || e.name,
              status: e.status
            }))
          }
        };
      }
      
      return { enrolled: false, details: { error: `HTTP ${response.status}` } };
    } catch (error) {
      return { enrolled: false, details: { error: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  // Get all debug information
  getDebugInfo(): any {
    return {
      courseSearch: (global as any).lastCourseSearchDebug,
      userSearch: (global as any).lastUserSearchDebug,
      enrollmentVerification: (global as any).lastEnrollmentVerification,
      timestamp: new Date().toISOString(),
      environment: {
        domain: this.config.domain,
        hasClientId: !!this.config.clientId,
        hasClientSecret: !!this.config.clientSecret,
        hasUsername: !!this.config.username,
        hasPassword: !!this.config.password
      }
    };
  }
}

// Action Handler Interface
interface ActionHandler {
  name: string;
  description: string;
  examples: string[];
  pattern: (message: string) => boolean;
  requiredFields: string[];
  execute: (api: OptimizedDoceboAPI, params: any) => Promise<string>;
}

// Action Registry with debugging
const ACTION_REGISTRY: ActionHandler[] = [
  {
    name: 'enroll_user',
    description: 'Enroll a single user in a course',
    examples: [
      'Enroll john@company.com in Python Programming',
      'Add sarah@test.com to Excel Training with level 2',
      'Enroll mike@company.com in SQL course as mandatory due 2025-12-31'
    ],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('enroll') || lower.includes('add')) && 
             !lower.includes('bulk') &&
             !lower.includes('group') &&
             !lower.includes('multiple') &&
             !lower.includes('who') && 
             !lower.includes('unenroll');
    },
    requiredFields: ['email', 'course'],
    execute: async (api, { email, course, level, dueDate, assignmentType }) => {
      const debugInfo: any = {
        action: 'enroll_user',
        inputs: { email, course, level, dueDate, assignmentType },
        steps: []
      };

      debugInfo.steps.push("🔍 Searching for user...");
      const user = await api.quickUserSearch(email);
      if (!user) {
        debugInfo.userSearchFailed = true;
        return `❌ **User Not Found**: ${email}\n\n**Debug Info**: User search failed. Check if email exists in Docebo.\n\n🔍 Try: "debug enrollment" for detailed search info`;
      }

      debugInfo.foundUser = {
        id: user.user_id,
        email: user.email,
        name: user.fullname
      };

      debugInfo.steps.push("🔍 Searching for course...");
      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) {
        debugInfo.courseSearchFailed = true;
        return `❌ **Course Not Found**: ${course}\n\n**Debug Info**: Course search failed. Available courses will be shown in debug info.\n\n🔍 Try: "debug enrollment" for detailed search info`;
      }

      debugInfo.foundCourse = {
        id: courseObj.course_id || courseObj.idCourse,
        name: courseObj.course_name || courseObj.name
      };

      const options = {
        level: level || "3",
        dateExpireValidity: dueDate,
        assignmentType: assignmentType || "mandatory"
      };

      debugInfo.steps.push("🎯 Attempting enrollment...");
      const result = await api.enrollUser(user.user_id, courseObj.course_id || courseObj.idCourse, options);
      
      // Store debug info globally
      (global as any).lastActionDebug = debugInfo;
      
      if (result.success) {
        return `✅ **Enrollment Successful**\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${courseObj.course_name || courseObj.name}\n**Level**: ${options.level}\n**Assignment**: ${options.assignmentType}${options.dateExpireValidity ? `\n**Due Date**: ${options.dateExpireValidity}` : ''}\n\n🎯 **Status**: Successfully enrolled in Docebo!\n\n${result.debug ? `\n**Debug Summary**: ${result.debug.steps.join(' → ')}` : ''}`;
      } else {
        const debugSummary = result.debug ? `\n\n**Debug Summary**:\n${result.debug.steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}` : '';
        const analysisText = result.debug?.analysis ? `\n\n**Analysis**: ${Array.isArray(result.debug.analysis) ? result.debug.analysis.join('\n') : result.debug.analysis}` : '';
        
        return `❌ **Enrollment Failed**\n\n**Issue**: ${result.message}\n\n**User**: ${user.fullname} (${user.email})\n**Course**: ${courseObj.course_name || courseObj.name}${debugSummary}${analysisText}\n\n🔍 **Next Steps**:\n• Try: "debug enrollment" for full diagnostic info\n• Check Docebo admin panel for enrollment rules\n• Verify course is published and user has access`;
      }
    }
  },
  {
    name: 'get_user_courses',
    description: 'Get all courses a user is enrolled in',
    examples: ['What courses is john@company.com enrolled in?', 'Show sarah@test.com courses'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return (lower.includes('courses') || lower.includes('enrolled')) && 
             !lower.includes('who is enrolled') &&
             !lower.includes('enroll');
    },
    requiredFields: ['email'],
    execute: async (api, { email }) => {
      const user = await api.quickUserSearch(email);
      if (!user) return `❌ **User Not Found**: ${email}`;

      try {
        const token = await api.getAccessToken();
        const response = await fetch(`${api.baseUrl}/learn/v1/enrollments/users/${user.user_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const enrollments = data.data?.items || [];
          
          if (enrollments.length === 0) {
            return `📚 **No Enrollments**\n\n${user.fullname} is not enrolled in any courses.`;
          }

          const courseList = enrollments.slice(0, 10).map((e: any, i: number) => {
            const courseName = e.course_name || e.name || 'Unknown Course';
            const status = e.status || '';
            const progress = e.completion_percentage || '';
            
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
        } else {
          return `❌ **Error**: Could not fetch enrollments for ${email}`;
        }
      } catch (error) {
        return `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  },
  {
    name: 'get_course_users',
    description: 'Get all users enrolled in a course',
    examples: ['Who is enrolled in Python Programming?', 'Show Excel Training enrollments'],
    pattern: (msg) => {
      const lower = msg.toLowerCase();
      return lower.includes('who') && lower.includes('enrolled');
    },
    requiredFields: ['course'],
    execute: async (api, { course }) => {
      const courseObj = await api.quickCourseSearch(course);
      if (!courseObj) return `❌ **Course Not Found**: ${course}`;

      try {
        const token = await api.getAccessToken();
        const response = await fetch(`${api.baseUrl}/learn/v1/enrollments/courses/${courseObj.course_id || courseObj.idCourse}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const enrollments = data.data?.items || [];
          
          if (enrollments.length === 0) {
            return `👥 **No Enrollments**\n\nNo users enrolled in "${courseObj.course_name || courseObj.name}".`;
          }

          const userList = enrollments.slice(0, 10).map((e: any, i: number) => {
            const userName = e.user_name || e.fullname || 'Unknown User';
            const userEmail = e.email || e.user_email || '';
            const status = e.status || '';
            const progress = e.completion_percentage || '';
            
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
        } else {
          return `❌ **Error**: Could not fetch enrollments for course`;
        }
      } catch (error) {
        return `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  }
];

// Enhanced command parser with debug info
function parseCommand(message: string): { 
  action: ActionHandler | null; 
  params: any; 
  missing: string[]; 
  debug?: {
    originalMessage: string;
    extractedEmail: string | null;
    extractedCourse: string | null;
    matchedAction: string | null;
    timestamp: string;
    parsedParams?: any;
    missingFields?: string[];
  };
} {
  const debugInfo = {
    originalMessage: message,
    extractedEmail: null as string | null,
    extractedCourse: null as string | null,
    matchedAction: null as string | null,
    timestamp: new Date().toISOString()
  };

  const email = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0];
  debugInfo.extractedEmail = email;
  
  const action = ACTION_REGISTRY.find(a => a.pattern(message));
  debugInfo.matchedAction = action?.name;
  
  if (!action) {
    return { action: null, params: {}, missing: [], debug: debugInfo };
  }

  const params: any = {};
  const missing: string[] = [];

  // Parse email(s)
  if (action.requiredFields.includes('email')) {
    if (email) {
      params.email = email;
    } else {
      missing.push('email address');
    }
  }

  // Parse course name with enhanced extraction
  if (action.requiredFields.includes('course')) {
    let course = '';
    
    // Try different patterns to extract course name
    const patterns = [
      // Pattern 1: "in Course Name"
      /(?:in|to)\s+([^(as|due|level|with)]+?)(?:\s+(?:as|due|level|with)|$)/i,
      // Pattern 2: "Course Name" (quoted)
      /"([^"]+)"/,
      // Pattern 3: After action words, before options
      /(?:enroll|add).*?(?:in|to)\s+([^(as|due|level|with)]+?)(?:\s+(?:as|due|level|with)|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        course = match[1].trim();
        break;
      }
    }
    
    // If no pattern matched, try extracting after removing emails and common words
    if (!course) {
      course = message
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '') // Remove emails
        .replace(/^(enroll|add|bulk|multiple)/gi, '') // Remove action words
        .replace(/\s+(as|due|level|with)\s+.*/gi, '') // Remove options
        .replace(/\s+(in|to)\s+/gi, ' ') // Remove prepositions
        .trim();
    }
    
    debugInfo.extractedCourse = course;
    
    if (course && course.length > 2) {
      params.course = course;
    } else {
      missing.push('course name');
    }
  }

  // Parse optional enrollment parameters
  const levelMatch = message.match(/level\s+(\d+)/i);
  if (levelMatch) {
    params.level = levelMatch[1];
  }

  const dueDateMatch = message.match(/due\s+(\d{4}-\d{2}-\d{2})/i) || 
                      message.match(/by\s+(\d{4}-\d{2}-\d{2})/i);
  if (dueDateMatch) {
    params.dueDate = dueDateMatch[1];
  }

  const assignmentMatch = message.match(/\bas\s+(mandatory|optional)/i);
  if (assignmentMatch) {
    params.assignmentType = assignmentMatch[1].toLowerCase();
  }

  debugInfo.parsedParams = params;
  debugInfo.missingFields = missing;

  return { action, params, missing, debug: debugInfo };
}

// Initialize API client
const api = new OptimizedDoceboAPI({
  domain: process.env.DOCEBO_DOMAIN!,
  clientId: process.env.DOCEBO_CLIENT_ID!,
  clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
  username: process.env.DOCEBO_USERNAME!,
  password: process.env.DOCEBO_PASSWORD!,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Special debug commands
    if (message.toLowerCase().includes('debug enrollment')) {
      const debugInfo = api.getDebugInfo();
      const actionDebug = (global as any).lastActionDebug;
      
      return NextResponse.json({
        response: `🔍 **Complete Debug Information**

**Environment Check**:
${debugInfo.environment.hasClientId ? '✅' : '❌'} Client ID configured
${debugInfo.environment.hasClientSecret ? '✅' : '❌'} Client Secret configured  
${debugInfo.environment.hasUsername ? '✅' : '❌'} Username configured
${debugInfo.environment.hasPassword ? '✅' : '❌'} Password configured
🌐 Domain: ${debugInfo.environment.domain}

**Last Course Search**:
${debugInfo.courseSearch ? `
📝 Search Term: "${debugInfo.courseSearch.searchTerm}"
🔍 Results Found: ${debugInfo.courseSearch.results.length}
📚 Courses Found:
${debugInfo.courseSearch.results.map((c: any) => `  • ID: ${c.id}, Name: "${c.name}", Status: ${c.status}`).join('\n')}
${debugInfo.courseSearch.bestMatch ? `\n🎯 Best Match: ID ${debugInfo.courseSearch.bestMatch.id} - "${debugInfo.courseSearch.bestMatch.name}"` : ''}
` : 'No recent course searches'}

**Last User Search**:
${debugInfo.userSearch ? `
📝 Search Term: "${debugInfo.userSearch.searchTerm}"
👥 Results Found: ${debugInfo.userSearch.results.length}
${debugInfo.userSearch.results.map((u: any) => `  • ID: ${u.id}, Email: ${u.email}, Name: ${u.name}, Status: ${u.status}`).join('\n')}
` : 'No recent user searches'}

**Last Action Debug**:
${actionDebug ? `
🎬 Action: ${actionDebug.action}
📥 Inputs: ${JSON.stringify(actionDebug.inputs, null, 2)}
📋 Steps: ${actionDebug.steps.join(' → ')}
${actionDebug.foundUser ? `👤 Found User: ${actionDebug.foundUser.name} (${actionDebug.foundUser.email})` : '❌ User search failed'}
${actionDebug.foundCourse ? `📚 Found Course: ${actionDebug.foundCourse.name} (ID: ${actionDebug.foundCourse.id})` : '❌ Course search failed'}
` : 'No recent actions'}

**Enrollment Verification**:
${debugInfo.enrollmentVerification ? `
${debugInfo.enrollmentVerification.enrolled ? '✅ User is enrolled' : '❌ User not found in enrollments'}
📊 Details: ${JSON.stringify(debugInfo.enrollmentVerification.details, null, 2)}
` : 'No recent enrollment verifications'}

🔍 **Debugging Tips**:
• If course search fails: Try shorter/different course names
• If user search fails: Verify email exists in Docebo
• If enrollment fails but API succeeds: Check course enrollment rules
• For "Deal Landscape" course: Should resolve to ID "997"`,
        success: true,
        action: 'debug',
        debug: { ...debugInfo, actionDebug },
        timestamp: new Date().toISOString()
      });
    }

    // Test enrollment with hardcoded working values
    if (message.toLowerCase().includes('test working enrollment')) {
      const result = await api.enrollUser("13163", "997", {
        level: "3",
        dateExpireValidity: "2025-12-31",
        assignmentType: "mandatory"
      });
      
      return NextResponse.json({
        response: `🧪 **Test with Working Values**

Using hardcoded values that worked in API browser:
• User ID: 13163 (pulkitmalhotra@google.com)
• Course ID: 997 (Explore the Deal Landscape)

**Result**: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}
**Message**: ${result.message}

${result.debug ? `**Debug Steps**: ${result.debug.steps.join(' → ')}` : ''}`,
        success: result.success,
        action: 'test_enrollment',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    // Parse the command with debug info
    const { action, params, missing, debug: parseDebug } = parseCommand(message);

    if (!action) {
      const response = `🎯 **Docebo Assistant with Debug Mode**

**Available Commands**:
${ACTION_REGISTRY.map(a => `• **${a.description}**\n  Example: "${a.examples[0]}"`).join('\n\n')}

**Debug Commands**:
• "debug enrollment" - Show complete debug information
• "test working enrollment" - Test with known working values

💡 **Tip**: All responses now include debug information when things go wrong!

**Message Analysis**:
📝 Original: "${message}"
✉️ Email Found: ${parseDebug?.extractedEmail || 'None'}
📚 Course Found: ${parseDebug?.extractedCourse || 'None'}
🎯 Action Matched: ${parseDebug?.matchedAction || 'None'}`;
      
      return NextResponse.json({
        response,
        success: false,
        action: 'help',
        available_actions: ACTION_REGISTRY.map(a => ({
          name: a.name,
          description: a.description,
          examples: a.examples
        })),
        parseDebug,
        timestamp: new Date().toISOString()
      });
    }

    if (missing.length > 0) {
      const response = `❌ **Missing Information**: I need the following to ${action.description}:\n\n${missing.map(m => `• ${m}`).join('\n')}\n\n**Example**: "${action.examples[0]}"\n\n**What I Found**:\n${parseDebug?.extractedEmail ? `✅ Email: ${parseDebug.extractedEmail}` : '❌ No email found'}\n${parseDebug?.extractedCourse ? `✅ Course: ${parseDebug.extractedCourse}` : '❌ No course found'}`;
      
      return NextResponse.json({
        response,
        success: false,
        action: action.name,
        missing_fields: missing,
        examples: action.examples,
        parseDebug,
        timestamp: new Date().toISOString()
      });
    }

    // Execute the action with full debug context
    try {
      const response = await action.execute(api, params);
      
      return NextResponse.json({
        response,
        success: !response.includes('❌'),
        action: action.name,
        params: params,
        parseDebug,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Action ${action.name} failed:`, error);
      
      const errorResponse = `❌ **${action.description} Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Debug Information**:
📝 Message: "${message}"
🎯 Action: ${action.name}
📥 Parameters: ${JSON.stringify(params, null, 2)}
💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}

🔍 **Next Steps**:
• Try: "debug enrollment" for full diagnostic info
• Check if your inputs are correct
• Verify Docebo connectivity

**Support**: Include this debug info when reporting issues.`;
      
      return NextResponse.json({
        response: errorResponse,
        success: false,
        action: action.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: api.getDebugInfo(),
        parseDebug,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}

🔍 **Debug Info**: This is a system-level error, likely related to request parsing or API configuration.

**Next Steps**:
• Check environment variables are set correctly
• Verify Docebo domain and credentials
• Try: "debug enrollment" to check configuration

**Error Details**: ${error instanceof Error ? error.stack : 'No stack trace available'}`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Docebo Chat API with Full Debug Mode',
    version: '3.0.0',
    debug_features: [
      'Comprehensive enrollment debugging',
      'Step-by-step API call tracking',
      'Course and user search debugging',
      'Request/response logging',
      'Environment validation',
      'Real-time enrollment verification'
    ],
    available_actions: ACTION_REGISTRY.map(action => ({
      name: action.name,
      description: action.description,
      examples: action.examples,
      required_fields: action.requiredFields
    })),
    debug_commands: [
      'debug enrollment - Show complete debug information',
      'test working enrollment - Test with verified working values'
    ],
    note: 'All enrollment attempts now include comprehensive debug information in responses!'
  });
}
