// lib/docebo-chat-api.ts - Chat-integrated Docebo API with natural language processing
import { DoceboAPI, DoceboConfig } from './docebo-api';

interface ChatApiRequest {
  operation: 'get' | 'post' | 'put' | 'delete';
  resource: 'users' | 'courses' | 'enrollments' | 'reports';
  query?: string;
  data?: any;
  filters?: Record<string, any>;
}

interface ChatApiResponse {
  success: boolean;
  data?: any;
  message: string;
  count?: number;
  operation_details?: string;
}

export class DoceboChatAPI extends DoceboAPI {
  
  constructor(config: DoceboConfig) {
    super(config);
    console.log('🤖 Chat-integrated Docebo API initialized');
  }

  // Natural language processing for chat commands
  async processNaturalLanguageQuery(userMessage: string): Promise<ChatApiResponse> {
    console.log(`🗣️ Processing natural language query: "${userMessage}"`);
    
    const intent = this.parseIntent(userMessage);
    
    try {
      switch (intent.action) {
        case 'get_user':
          return await this.handleGetUser(intent);
        case 'create_user':
          return await this.handleCreateUser(intent);
        case 'update_user':
          return await this.handleUpdateUser(intent);
        case 'delete_user':
          return await this.handleDeleteUser(intent);
        case 'get_course':
          return await this.handleGetCourse(intent);
        case 'create_course':
          return await this.handleCreateCourse(intent);
        case 'update_course':
          return await this.handleUpdateCourse(intent);
        case 'delete_course':
          return await this.handleDeleteCourse(intent);
        case 'enroll_user':
          return await this.handleEnrollUser(intent);
        case 'unenroll_user':
          return await this.handleUnenrollUser(intent);
        case 'get_enrollments':
          return await this.handleGetEnrollments(intent);
        case 'bulk_operation':
          return await this.handleBulkOperation(intent);
        default:
          return {
            success: false,
            message: `I don't understand the request: "${userMessage}". Try commands like "get user john@company.com" or "create course Python Basics"`
          };
      }
    } catch (error) {
      console.error('❌ Error processing query:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      };
    }
  }

  // Intent parsing for natural language
  private parseIntent(message: string): any {
    const msgLower = message.toLowerCase().trim();
    
    // User operations
    if (msgLower.includes('get user') || msgLower.includes('find user') || msgLower.includes('search user')) {
      return {
        action: 'get_user',
        identifier: this.extractIdentifier(message),
        searchType: this.detectSearchType(message)
      };
    }
    
    if (msgLower.includes('create user') || msgLower.includes('add user')) {
      return {
        action: 'create_user',
        userData: this.extractUserData(message)
      };
    }
    
    if (msgLower.includes('update user') || msgLower.includes('modify user')) {
      return {
        action: 'update_user',
        identifier: this.extractIdentifier(message),
        userData: this.extractUserData(message)
      };
    }
    
    if (msgLower.includes('delete user') || msgLower.includes('remove user')) {
      return {
        action: 'delete_user',
        identifier: this.extractIdentifier(message)
      };
    }
    
    // Course operations
    if (msgLower.includes('get course') || msgLower.includes('find course') || msgLower.includes('search course')) {
      return {
        action: 'get_course',
        identifier: this.extractIdentifier(message),
        searchType: this.detectSearchType(message)
      };
    }
    
    if (msgLower.includes('create course') || msgLower.includes('add course')) {
      return {
        action: 'create_course',
        courseData: this.extractCourseData(message)
      };
    }
    
    if (msgLower.includes('update course') || msgLower.includes('modify course')) {
      return {
        action: 'update_course',
        identifier: this.extractIdentifier(message),
        courseData: this.extractCourseData(message)
      };
    }
    
    if (msgLower.includes('delete course') || msgLower.includes('remove course')) {
      return {
        action: 'delete_course',
        identifier: this.extractIdentifier(message)
      };
    }
    
    // Enrollment operations
    if (msgLower.includes('enroll') && !msgLower.includes('unenroll')) {
      return {
        action: 'enroll_user',
        userId: this.extractUserId(message),
        courseId: this.extractCourseId(message)
      };
    }
    
    if (msgLower.includes('unenroll') || msgLower.includes('remove enrollment')) {
      return {
        action: 'unenroll_user',
        userId: this.extractUserId(message),
        courseId: this.extractCourseId(message)
      };
    }
    
    if (msgLower.includes('get enrollment') || msgLower.includes('show enrollment')) {
      return {
        action: 'get_enrollments',
        userId: this.extractUserId(message),
        courseId: this.extractCourseId(message)
      };
    }
    
    // Bulk operations
    if (msgLower.includes('bulk') || msgLower.includes('batch')) {
      return {
        action: 'bulk_operation',
        operation: this.extractBulkOperation(message)
      };
    }
    
    return { action: 'unknown', originalMessage: message };
  }

  // Helper methods for data extraction
  private extractIdentifier(message: string): string {
    // Extract email
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) return emailMatch[0];
    
    // Extract ID (numbers)
    const idMatch = message.match(/\b\d+\b/);
    if (idMatch) return idMatch[0];
    
    // Extract quoted strings
    const quotedMatch = message.match(/['"]([^'"]+)['"]/);
    if (quotedMatch) return quotedMatch[1];
    
    // Extract last word as fallback
    const words = message.trim().split(/\s+/);
    return words[words.length - 1];
  }

  private detectSearchType(message: string): 'email' | 'id' | 'username' | 'name' {
    if (message.includes('@')) return 'email';
    if (/\b\d+\b/.test(message)) return 'id';
    if (message.includes('username')) return 'username';
    return 'name';
  }

  private extractUserData(message: string): any {
    const userData: any = {};
    
    // Extract email
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) userData.email = emailMatch[0];
    
    // Extract first name (pattern: first name "John" or firstname John)
    const firstNameMatch = message.match(/(?:first[\s_]?name|firstname)[\s:]+([A-Za-z]+)/i);
    if (firstNameMatch) userData.first_name = firstNameMatch[1];
    
    // Extract last name
    const lastNameMatch = message.match(/(?:last[\s_]?name|lastname)[\s:]+([A-Za-z]+)/i);
    if (lastNameMatch) userData.last_name = lastNameMatch[1];
    
    // Extract username
    const usernameMatch = message.match(/(?:username|user)[\s:]+([A-Za-z0-9._-]+)/i);
    if (usernameMatch) userData.username = usernameMatch[1];
    
    return userData;
  }

  private extractCourseData(message: string): any {
    const courseData: any = {};
    
    // Extract course name (in quotes or after "name")
    const nameMatch = message.match(/(?:course[\s_]?name|name)[\s:]*['"]([^'"]+)['"]|['"]([^'"]+)['"]/i);
    if (nameMatch) courseData.course_name = nameMatch[1] || nameMatch[2];
    
    // Extract course type
    const typeMatch = message.match(/(?:type|course[\s_]?type)[\s:]+([A-Za-z]+)/i);
    if (typeMatch) courseData.course_type = typeMatch[1];
    
    return courseData;
  }

  private extractUserId(message: string): string {
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) return emailMatch[0];
    
    const userIdMatch = message.match(/user[\s_]?id[\s:]+(\d+)/i);
    if (userIdMatch) return userIdMatch[1];
    
    return '';
  }

  private extractCourseId(message: string): string {
    const courseIdMatch = message.match(/course[\s_]?id[\s:]+(\d+)/i);
    if (courseIdMatch) return courseIdMatch[1];
    
    const quotedMatch = message.match(/in\s+['"]([^'"]+)['"]/i);
    if (quotedMatch) return quotedMatch[1];
    
    return '';
  }

  private extractBulkOperation(message: string): any {
    return {
      type: message.includes('enroll') ? 'bulk_enroll' : 'bulk_create',
      data: [] // Would need to parse structured data
    };
  }

  // Handler methods for each operation
  private async handleGetUser(intent: any): Promise<ChatApiResponse> {
    try {
      if (intent.searchType === 'id') {
        const user = await this.getUserById(intent.identifier);
        if (user) {
          return {
            success: true,
            data: user,
            message: `Found user: ${user.fullname} (${user.email})`,
            operation_details: `Retrieved user by ID: ${intent.identifier}`
          };
        } else {
          return {
            success: false,
            message: `User with ID ${intent.identifier} not found`
          };
        }
      } else {
        const users = await this.searchUsers(intent.identifier, 10);
        if (users.length > 0) {
          return {
            success: true,
            data: users,
            count: users.length,
            message: `Found ${users.length} user(s) matching "${intent.identifier}"`,
            operation_details: `Searched users with query: ${intent.identifier}`
          };
        } else {
          return {
            success: false,
            message: `No users found matching "${intent.identifier}"`
          };
        }
      }
    } catch (error) {
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleCreateUser(intent: any): Promise<ChatApiResponse> {
    try {
      const userData = intent.userData;
      
      // Validate required fields
      if (!userData.email || !userData.first_name || !userData.last_name) {
        return {
          success: false,
          message: 'Missing required fields. Need at least: email, first_name, last_name'
        };
      }
      
      // Generate username if not provided
      if (!userData.username) {
        userData.username = userData.email.split('@')[0];
      }
      
      const newUser = await this.createUser(userData);
      
      return {
        success: true,
        data: newUser,
        message: `Successfully created user: ${newUser.fullname} (${newUser.email})`,
        operation_details: `Created user with ID: ${newUser.user_id}`
      };
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleUpdateUser(intent: any): Promise<ChatApiResponse> {
    try {
      // First find the user
      const users = await this.searchUsers(intent.identifier, 1);
      if (users.length === 0) {
        return {
          success: false,
          message: `User "${intent.identifier}" not found`
        };
      }
      
      const userId = users[0].user_id;
      const updatedUser = await this.updateUser(userId, intent.userData);
      
      return {
        success: true,
        data: updatedUser,
        message: `Successfully updated user: ${updatedUser.fullname} (${updatedUser.email})`,
        operation_details: `Updated user ID: ${userId}`
      };
    } catch (error) {
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleDeleteUser(intent: any): Promise<ChatApiResponse> {
    try {
      // First find the user
      const users = await this.searchUsers(intent.identifier, 1);
      if (users.length === 0) {
        return {
          success: false,
          message: `User "${intent.identifier}" not found`
        };
      }
      
      const userId = users[0].user_id;
      const userName = users[0].fullname;
      
      await this.deleteUser(userId);
      
      return {
        success: true,
        message: `Successfully deleted user: ${userName}`,
        operation_details: `Deleted user ID: ${userId}`
      };
    } catch (error) {
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGetCourse(intent: any): Promise<ChatApiResponse> {
    try {
      if (intent.searchType === 'id') {
        const course = await this.getCourseById(intent.identifier);
        if (course) {
          return {
            success: true,
            data: course,
            message: `Found course: ${course.course_name} (ID: ${course.course_id})`,
            operation_details: `Retrieved course by ID: ${intent.identifier}`
          };
        } else {
          return {
            success: false,
            message: `Course with ID ${intent.identifier} not found`
          };
        }
      } else {
        const courses = await this.searchCourses(intent.identifier, 10);
        if (courses.length > 0) {
          return {
            success: true,
            data: courses,
            count: courses.length,
            message: `Found ${courses.length} course(s) matching "${intent.identifier}"`,
            operation_details: `Searched courses with query: ${intent.identifier}`
          };
        } else {
          return {
            success: false,
            message: `No courses found matching "${intent.identifier}"`
          };
        }
      }
    } catch (error) {
      throw new Error(`Failed to get course: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleCreateCourse(intent: any): Promise<ChatApiResponse> {
    try {
      const courseData = intent.courseData;
      
      // Validate required fields
      if (!courseData.course_name) {
        return {
          success: false,
          message: 'Missing required field: course_name'
        };
      }
      
      // Set default course type if not provided
      if (!courseData.course_type) {
        courseData.course_type = 'elearning';
      }
      
      const newCourse = await this.createCourse(courseData);
      
      return {
        success: true,
        data: newCourse,
        message: `Successfully created course: ${newCourse.course_name} (ID: ${newCourse.course_id})`,
        operation_details: `Created course with ID: ${newCourse.course_id}`
      };
    } catch (error) {
      throw new Error(`Failed to create course: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleUpdateCourse(intent: any): Promise<ChatApiResponse> {
    try {
      // First find the course
      const courses = await this.searchCourses(intent.identifier, 1);
      if (courses.length === 0) {
        return {
          success: false,
          message: `Course "${intent.identifier}" not found`
        };
      }
      
      const courseId = courses[0].course_id;
      const updatedCourse = await this.updateCourse(courseId, intent.courseData);
      
      return {
        success: true,
        data: updatedCourse,
        message: `Successfully updated course: ${updatedCourse.course_name}`,
        operation_details: `Updated course ID: ${courseId}`
      };
    } catch (error) {
      throw new Error(`Failed to update course: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleDeleteCourse(intent: any): Promise<ChatApiResponse> {
    try {
      // First find the course
      const courses = await this.searchCourses(intent.identifier, 1);
      if (courses.length === 0) {
        return {
          success: false,
          message: `Course "${intent.identifier}" not found`
        };
      }
      
      const courseId = courses[0].course_id;
      const courseName = courses[0].course_name;
      
      await this.deleteCourse(courseId);
      
      return {
        success: true,
        message: `Successfully deleted course: ${courseName}`,
        operation_details: `Deleted course ID: ${courseId}`
      };
    } catch (error) {
      throw new Error(`Failed to delete course: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleEnrollUser(intent: any): Promise<ChatApiResponse> {
    try {
      // Find user
      const users = await this.searchUsers(intent.userId, 1);
      if (users.length === 0) {
        return {
          success: false,
          message: `User "${intent.userId}" not found`
        };
      }
      
      // Find course
      const courses = await this.searchCourses(intent.courseId, 1);
      if (courses.length === 0) {
        return {
          success: false,
          message: `Course "${intent.courseId}" not found`
        };
      }
      
      const userId = users[0].user_id;
      const courseId = courses[0].course_id;
      
      const enrollment = await this.enrollUser(userId, courseId);
      
      return {
        success: true,
        data: enrollment,
        message: `Successfully enrolled ${users[0].fullname} in ${courses[0].course_name}`,
        operation_details: `Created enrollment: User ID ${userId} in Course ID ${courseId}`
      };
    } catch (error) {
      throw new Error(`Failed to enroll user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleUnenrollUser(intent: any): Promise<ChatApiResponse> {
    try {
      // Find user
      const users = await this.searchUsers(intent.userId, 1);
      if (users.length === 0) {
        return {
          success: false,
          message: `User "${intent.userId}" not found`
        };
      }
      
      // Find course
      const courses = await this.searchCourses(intent.courseId, 1);
      if (courses.length === 0) {
        return {
          success: false,
          message: `Course "${intent.courseId}" not found`
        };
      }
      
      const userId = users[0].user_id;
      const courseId = courses[0].course_id;
      
      await this.unenrollUser(userId, courseId);
      
      return {
        success: true,
        message: `Successfully unenrolled ${users[0].fullname} from ${courses[0].course_name}`,
        operation_details: `Removed enrollment: User ID ${userId} from Course ID ${courseId}`
      };
    } catch (error) {
      throw new Error(`Failed to unenroll user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGetEnrollments(intent: any): Promise<ChatApiResponse> {
    try {
      const params: any = {};
      
      // Add user filter if provided
      if (intent.userId) {
        const users = await this.searchUsers(intent.userId, 1);
        if (users.length > 0) {
          params.user_id = users[0].user_id;
        }
      }
      
      // Add course filter if provided
      if (intent.courseId) {
        const courses = await this.searchCourses(intent.courseId, 1);
        if (courses.length > 0) {
          params.course_id = courses[0].course_id;
        }
      }
      
      const result = await this.getEnrollments(params);
      
      return {
        success: true,
        data: result.data,
        count: result.data.length,
        message: `Found ${result.data.length} enrollment(s)`,
        operation_details: `Retrieved enrollments with filters: ${JSON.stringify(params)}`
      };
    } catch (error) {
      throw new Error(`Failed to get enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleBulkOperation(intent: any): Promise<ChatApiResponse> {
    try {
      const operation = intent.operation;
      
      if (operation.type === 'bulk_enroll') {
        const results = await this.bulkEnrollUsers(operation.data);
        return {
          success: true,
          data: results,
          message: `Successfully processed bulk enrollment`,
          operation_details: `Processed ${operation.data.length} enrollments in batches`
        };
      } else if (operation.type === 'bulk_create') {
        const results = await this.bulkCreateUsers(operation.data);
        return {
          success: true,
          data: results,
          message: `Successfully processed bulk user creation`,
          operation_details: `Created ${operation.data.length} users in batches`
        };
      } else {
        return {
          success: false,
          message: `Unknown bulk operation type: ${operation.type}`
        };
      }
    } catch (error) {
      throw new Error(`Failed to process bulk operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility method to format API responses for chat display
  formatResponseForChat(response: ChatApiResponse): string {
    if (!response.success) {
      return `❌ **Error**: ${response.message}`;
    }

    let output = `✅ **Success**: ${response.message}\n\n`;

    if (response.operation_details) {
      output += `🔧 **Operation**: ${response.operation_details}\n\n`;
    }

    if (response.data) {
      if (Array.isArray(response.data)) {
        output += `📊 **Results** (${response.count || response.data.length}):\n`;
        response.data.slice(0, 5).forEach((item: any, index: number) => {
          if (item.fullname) {
            // User data
            output += `${index + 1}. **${item.fullname}** (${item.email})\n   - ID: ${item.user_id}\n   - Status: ${item.status}\n   - Level: ${item.level}\n\n`;
          } else if (item.course_name) {
            // Course data
            output += `${index + 1}. **${item.course_name}** (ID: ${item.course_id})\n   - Type: ${item.course_type}\n   - Status: ${item.status}\n\n`;
          } else if (item.enrollment_status) {
            // Enrollment data
            output += `${index + 1}. User ${item.user_id} → Course ${item.course_id}\n   - Status: ${item.enrollment_status}\n   - Progress: ${item.progress_percentage}%\n\n`;
          }
        });
        
        if (response.data.length > 5) {
          output += `... and ${response.data.length - 5} more results\n\n`;
        }
      } else {
        // Single item
        const item = response.data;
        if (item.fullname) {
          output += `👤 **User Details**:\n- Name: ${item.fullname}\n- Email: ${item.email}\n- ID: ${item.user_id}\n- Status: ${item.status}\n- Level: ${item.level}\n- Last Access: ${item.last_access_date}\n\n`;
        } else if (item.course_name) {
          output += `📚 **Course Details**:\n- Name: ${item.course_name}\n- ID: ${item.course_id}\n- Type: ${item.course_type}\n- Status: ${item.status}\n\n`;
        }
      }
    }

    return output;
  }
}
