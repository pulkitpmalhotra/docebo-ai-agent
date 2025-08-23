// app/api/chat/intent-analyzer.ts - Enhanced with assignment types and validity dates
import { IntentAnalysis } from './types';

export class IntentAnalyzer {
  static analyzeIntent(message: string): IntentAnalysis {
    const lower = message.toLowerCase().trim();
    
    // Extract entities first
    const email = this.extractEmail(message);
    const emails = this.extractMultipleEmails(message);
    const courseId = this.extractCourseId(message);
    const courseName = this.extractCourseName(message);
    const learningPlanName = this.extractLearningPlanName(message);
    const assignmentType = this.extractAssignmentType(message);
    const startValidity = this.extractStartValidity(message);
    const endValidity = this.extractEndValidity(message);
    
    // Intent patterns with confidence scores
    const patterns = [
      // Bulk Enrollment patterns - HIGHEST PRIORITY (enhanced)
      {
        intent: 'bulk_enroll_course',
        patterns: [
          /(?:bulk\s+)?(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s+with\s+assignment\s+type\s+(\w+))?(?:\s+from\s+([\d-]+))?(?:\s+to\s+([\d-]+))?/i,
          /(?:enroll|add|assign)\s+multiple\s+users?\s+(?:in|to)\s+(?:course|training)\s+(.+?)(?:\s+(?:as|with)\s+(\w+))?/i,
          /(?:enroll|add|assign)\s+team\s+(?:in|to)\s+(?:course|training)\s+(.+?)(?:\s+(?:as|with)\s+(\w+))?/i
        ],
        extractEntities: () => {
          const emailList = this.extractMultipleEmails(message);
          const teamRef = this.parseTeamReference(message);
          
          if (emailList.length > 1 || teamRef.teamName) {
            return {
              emails: emailList.length > 1 ? emailList : [email].filter(Boolean),
              courseName: courseName,
              resourceType: 'course',
              action: 'bulk_enroll',
              teamName: teamRef.teamName,
              assignmentType: assignmentType,
              startValidity: startValidity,
              endValidity: endValidity
            };
          }
          return null;
        },
        confidence: 0.98
      },
      
      {
        intent: 'bulk_enroll_learning_plan',
        patterns: [
          /(?:bulk\s+)?(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s+with\s+assignment\s+type\s+(\w+))?(?:\s+from\s+([\d-]+))?(?:\s+to\s+([\d-]+))?/i,
          /(?:enroll|add|assign)\s+multiple\s+users?\s+(?:in|to)\s+(?:learning plan|lp)\s+(.+?)(?:\s+(?:as|with)\s+(\w+))?/i,
          /(?:enroll|add|assign)\s+team\s+(?:in|to)\s+(?:learning plan|lp)\s+(.+?)(?:\s+(?:as|with)\s+(\w+))?/i
        ],
        extractEntities: () => {
          const emailList = this.extractMultipleEmails(message);
          const teamRef = this.parseTeamReference(message);
          
          if (emailList.length > 1 || teamRef.teamName) {
            return {
              emails: emailList.length > 1 ? emailList : [email].filter(Boolean),
              learningPlanName: learningPlanName,
              resourceType: 'learning_plan',
              action: 'bulk_enroll',
              teamName: teamRef.teamName,
              assignmentType: assignmentType,
              startValidity: startValidity,
              endValidity: endValidity
            };
          }
          return null;
        },
        confidence: 0.98
      },
      
      {
        intent: 'bulk_unenroll_course',
        patterns: [
          /(?:bulk\s+)?(?:unenroll|remove|unassign)\s+(.+?)\s+(?:from)\s+(?:course|training)\s+(.+)/i,
          /(?:remove|unenroll)\s+multiple\s+users?\s+(?:from)\s+(?:course|training)\s+(.+)/i,
          /(?:remove|unenroll)\s+team\s+(?:from)\s+(?:course|training)\s+(.+)/i
        ],
        extractEntities: () => {
          const emailList = this.extractMultipleEmails(message);
          const teamRef = this.parseTeamReference(message);
          
          if (emailList.length > 1 || teamRef.teamName) {
            return {
              emails: emailList.length > 1 ? emailList : [email].filter(Boolean),
              courseName: courseName,
              resourceType: 'course',
              action: 'bulk_unenroll',
              teamName: teamRef.teamName
            };
          }
          return null;
        },
        confidence: 0.98
      },
      
      {
        intent: 'bulk_unenroll_learning_plan',
        patterns: [
          /(?:bulk\s+)?(?:unenroll|remove|unassign)\s+(.+?)\s+(?:from)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:remove|unenroll)\s+multiple\s+users?\s+(?:from)\s+(?:learning plan|lp)\s+(.+)/i,
          /(?:remove|unenroll)\s+team\s+(?:from)\s+(?:learning plan|lp)\s+(.+)/i
        ],
        extractEntities: () => {
          const emailList = this.extractMultipleEmails(message);
          const teamRef = this.parseTeamReference(message);
          
          if (emailList.length > 1 || teamRef.teamName) {
            return {
              emails: emailList.length > 1 ? emailList : [email].filter(Boolean),
              learningPlanName: learningPlanName,
              resourceType: 'learning_plan',
              action: 'bulk_unenroll',
              teamName: teamRef.teamName
            };
          }
          return null;
        },
        confidence: 0.98
      },

      // Enhanced Individual Enrollment patterns
      {
        intent: 'enroll_user_in_course',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s+with\s+assignment\s+type\s+(\w+))?(?:\s+from\s+([\d-]+))?(?:\s+to\s+([\d-]+))?/i,
          /(?:enroll|add|assign)\s+(.+?)\s+(?:to|in)\s+(.+?)\s+(?:course|training)(?:\s+(?:as|with)\s+(\w+))?/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i);
          if (enrollMatch) {
            const userIdentifier = enrollMatch[1].trim();
            const resourceName = this.extractCourseName(message) || enrollMatch[2].trim();
            return {
              email: this.extractEmailFromText(userIdentifier) || userIdentifier,
              courseName: resourceName,
              resourceType: 'course',
              action: 'enroll',
              assignmentType: assignmentType,
              startValidity: startValidity,
              endValidity: endValidity
            };
          }
          return { 
            email: email, 
            courseName: courseName, 
            resourceType: 'course', 
            action: 'enroll',
            assignmentType: assignmentType,
            startValidity: startValidity,
            endValidity: endValidity
          };
        },
        confidence: 0.98
      },
      
      {
        intent: 'enroll_user_in_learning_plan',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s+with\s+assignment\s+type\s+(\w+))?(?:\s+from\s+([\d-]+))?(?:\s+to\s+([\d-]+))?/i,
          /(?:assign|add)\s+(.+?)\s+(?:to|in)\s+(.+?)\s+(?:learning plan|lp)(?:\s+(?:as|with)\s+(\w+))?/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i);
          if (enrollMatch) {
            const userIdentifier = enrollMatch[1].trim();
            const resourceName = this.extractLearningPlanName(message) || enrollMatch[2].trim();
            return {
              email: this.extractEmailFromText(userIdentifier) || userIdentifier,
              learningPlanName: resourceName,
              resourceType: 'learning_plan',
              action: 'enroll',
              assignmentType: assignmentType,
              startValidity: startValidity,
              endValidity: endValidity
            };
          }
          return { 
            email: email, 
            learningPlanName: learningPlanName, 
            resourceType: 'learning_plan', 
            action: 'enroll',
            assignmentType: assignmentType,
            startValidity: startValidity,
            endValidity: endValidity
          };
        },
        confidence: 0.98
      },
      {
  intent: 'background_user_enrollments',
  patterns: [
    /(?:load all enrollments in background|process enrollments in background|background enrollments|get all enrollments background)\s+(?:for\s+)?(.+)/i,
    /(?:load|process|get)\s+(?:all\s+)?enrollments?\s+(?:in\s+)?background\s+(?:for\s+)?(.+)/i,
    /background\s+(?:processing|load|get)\s+(?:enrollments?\s+)?(?:for\s+)?(.+)/i,
    /(?:heavy|full|complete)\s+enrollment\s+(?:processing|load|data)\s+(?:for\s+)?(.+)/i
  ],
  extractEntities: () => {
    const emailInMessage = this.extractEmail(message);
    const userIdentifier = emailInMessage || 
      this.extractAfterPattern(message, /(?:background|load all|process all|get all)\s+(?:enrollments?\s+)?(?:in\s+background\s+)?(?:for\s+)?(.+?)(?:\s|$)/i);
    
    return {
      email: emailInMessage,
      userId: userIdentifier,
      processingType: 'background',
      requestType: 'all_enrollments',
      backgroundProcessing: true
    };
  },
  confidence: 0.95
},
      {
        intent: 'unenroll_user_from_course',
        patterns: [
          /(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:course|training)\s+(.+)/i,
          /(?:remove|cancel)\s+(.+?)\s+(?:enrollment|registration)\s+(?:from|in)\s+(.+)/i
        ],
        extractEntities: () => {
          const unenrollMatch = message.match(/(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:course|training)\s+(.+)/i);
          if (unenrollMatch) {
            const userIdentifier = unenrollMatch[1].trim();
            const resourceName = unenrollMatch[2].trim();
            return {
              email: this.extractEmailFromText(userIdentifier) || userIdentifier,
              courseName: resourceName,
              resourceType: 'course',
              action: 'unenroll'
            };
          }
          return { email: email, courseName: courseName, resourceType: 'course', action: 'unenroll' };
        },
        confidence: 0.98
      },
      
      {
        intent: 'unenroll_user_from_learning_plan',
        patterns: [
          /(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:remove|cancel)\s+(.+?)\s+(?:from|in)\s+(.+?)\s+(?:learning plan|lp)/i
        ],
        extractEntities: () => {
          const unenrollMatch = message.match(/(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:learning plan|lp|learning path)\s+(.+)/i);
          if (unenrollMatch) {
            const userIdentifier = unenrollMatch[1].trim();
            const resourceName = unenrollMatch[2].trim();
            return {
              email: this.extractEmailFromText(userIdentifier) || userIdentifier,
              learningPlanName: resourceName,
              resourceType: 'learning_plan',
              action: 'unenroll'
            };
          }
          return { email: email, learningPlanName: learningPlanName, resourceType: 'learning_plan', action: 'unenroll' };
        },
        confidence: 0.98
      },
      
      // Specific enrollment check patterns - HIGH PRIORITY
      {
        intent: 'check_specific_enrollment',
        patterns: [
          /(?:check if|is)\s+(.+?)\s+(?:enrolled|taking|assigned to|has completed|completed)\s+(?:in\s+)?(?:course|learning plan)\s+(.+)/i,
          /(?:check status|status|enrollment details|enrollment status)\s+(?:of\s+)?(.+?)\s+(?:in\s+)?(?:course|learning plan)\s+(.+)/i,
          /(?:provide enrollment details|enrollment details)\s+(?:of\s+)?(.+?)\s+(?:in\s+)?(?:course|learning plan)\s+(.+)/i,
          /(?:has|did)\s+(.+?)\s+(?:complete|completed|finish|finished)\s+(?:course|learning plan)\s+(.+)/i
        ],
        extractEntities: () => {
          const emailInMessage = this.extractEmail(message);
          const isCompletionCheck = /(?:completed|complete|finish|finished|has completed)/i.test(message);
          const isLearningPlan = /learning plan/i.test(message);
          const isCourse = /course/i.test(message) && !isLearningPlan;
          
          let resourceName = '';
          if (isLearningPlan) {
            const lpMatch = message.match(/(?:learning plan)\s+(.+?)(?:\s*$|\?|!|\.)/i);
            if (lpMatch) resourceName = lpMatch[1].trim();
          } else if (isCourse) {
            const courseMatch = message.match(/(?:course)\s+(.+?)(?:\s*$|\?|!|\.)/i);
            if (courseMatch) resourceName = courseMatch[1].trim();
          }
          
          return {
            email: emailInMessage,
            resourceName: resourceName,
            resourceType: isLearningPlan ? 'learning_plan' : 'course',
            checkType: isCompletionCheck ? 'completion' : 'enrollment',
            query: message
          };
        },
        confidence: email ? 0.97 : 0.90
      },
      
      // Course Info patterns
      {
        intent: 'get_course_info',
        patterns: [
          /(?:course info|tell me about course|course details|info about course|course information)/i,
          /(?:what is|describe|explain).+course/i,
          /(?:details for|info for|information for).+course/i
        ],
        extractEntities: () => ({
          courseId: courseId,
          courseName: courseName || this.extractAfterPattern(message, /(?:course info|course details|info about course|tell me about course)\s+(.+)/i)
        }),
        confidence: 0.9
      },
      
      // Learning Plan Info patterns  
      {
        intent: 'get_learning_plan_info',
        patterns: [
          /(?:learning plan info|lp info|plan info|tell me about learning plan|learning plan details)/i,
          /(?:what is|describe|explain).+learning plan/i,
          /(?:details for|info for|information for).+learning plan/i,
          /(?:info|details)\s+(.+)$/i
        ],
        extractEntities: () => ({
          learningPlanName: learningPlanName || 
            this.extractAfterPattern(message, /(?:learning plan info|lp info|plan info|tell me about learning plan|learning plan details)\s+(.+)/i) ||
            this.extractAfterPattern(message, /(?:info|details)\s+(.+)$/i)
        }),
        confidence: 0.9
      },
      
      // User search patterns - LOWER PRIORITY than enrollments
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details|who is|tell me about)(?!\s+enrollments)/i,
          /@[\w.-]+\.\w+(?!\s+enrollments)/i
        ],
        extractEntities: () => ({
          email: email,
          searchTerm: email || this.extractAfterPattern(message, /(?:find user|search user|look up user|user info|user details)\s+(.+)/i)
        }),
        confidence: email ? 0.90 : 0.7
      },
      
      // Course search patterns
      {
        intent: 'search_courses',
        patterns: [
          /(?:find course|search course|look for course|course search)/i,
          /(?:find|search).+course/i,
          /(?:courses about|courses on|courses for)/i
        ],
        extractEntities: () => ({
          searchTerm: courseName || this.extractAfterPattern(message, /(?:find|search|look for)\s+(.+?)\s+course/i) ||
                     this.extractAfterPattern(message, /(?:courses about|courses on|courses for)\s+(.+)/i)
        }),
        confidence: 0.8
      },
      
      // Learning plan search patterns
      {
        intent: 'search_learning_plans',
        patterns: [
          /(?:find learning plan|search learning plan|learning plans about|learning plans for)/i,
          /(?:find|search).+learning plan/i,
          /learning plans?/i
        ],
        extractEntities: () => ({
          searchTerm: learningPlanName || this.extractAfterPattern(message, /(?:find|search)\s+(.+?)\s+learning plan/i) ||
                     this.extractAfterPattern(message, /(?:learning plans about|learning plans for)\s+(.+)/i)
        }),
        confidence: 0.8
      },

      // User enrollment patterns - HIGH PRIORITY
      {
        intent: 'get_user_enrollments',
        patterns: [
          /(?:user enrollments|enrollments for user|enrollments for|show enrollments)/i,
          /(?:what courses is|what learning plans is|what is.*enrolled)/i,
          /(?:enrolled in|taking|assigned to|learning progress|user progress)/i,
          /(?:get enrollments|show courses for|list courses for)/i,
          /(?:load more enrollments|show more enrollments|more enrollments)/i
        ],
        extractEntities: () => {
          const email = this.extractEmail(message);
          const isLoadMore = /(?:load more|show more|more enrollments)/i.test(message);
          const offsetMatch = message.match(/(?:offset|starting from|from position)\s+(\d+)/i);
          
          return {
            email: email,
            userId: email || this.extractAfterPattern(message, /(?:user enrollments|enrollments for|show enrollments|get enrollments|show courses for|list courses for|load more enrollments for|show more enrollments for|more enrollments for)\s+(.+?)(?:\s|$)/i),
            loadMore: isLoadMore,
            offset: offsetMatch ? offsetMatch[1] : (isLoadMore ? '10' : '0')
          };
        },
        confidence: email ? 0.95 : 0.85
      },
      
      // Help patterns
      {
        intent: 'docebo_help',
        patterns: [
          /(?:how to|how do i|how does|how can i)/i,
          /(?:help|guide|tutorial|documentation)/i,
          /(?:configure|setup|enable|create|manage)/i,
          /(?:troubleshoot|problem|issue|error)/i
        ],
        extractEntities: () => ({
          query: message
        }),
        confidence: 0.6
      }
    ];
    
    // Find best matching pattern
    let bestMatch = { intent: 'unknown', entities: {}, confidence: 0 };
    
    for (const pattern of patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(lower)) {
          if (pattern.confidence > bestMatch.confidence) {
            const entities = pattern.extractEntities();
            if (entities) {
              bestMatch = {
                intent: pattern.intent,
                entities: entities,
                confidence: pattern.confidence
              };
            }
          }
        }
      }
    }
    
    return bestMatch;
  }
  
  static extractEmail(message: string): string | null {
    const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return match ? match[0] : null;
  }
  
  static extractEmailFromText(text: string): string | null {
    const match = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return match ? match[0] : null;
  }
  
  static extractMultipleEmails(message: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = message.match(emailRegex) || [];
    return [...new Set(emails.map(email => email.toLowerCase()))];
  }
  
  static parseTeamReference(message: string): { teamName?: string } {
    const teamPatterns = [
      /\b(marketing|sales|hr|engineering|finance|support|admin|management)\s+team\b/i,
      /\b(developers?|managers?|admins?|analysts?)\b/i
    ];

    for (const pattern of teamPatterns) {
      const match = message.match(pattern);
      if (match) {
        return { teamName: match[1] };
      }
    }

    return {};
  }
  
  static extractCourseId(message: string): string | null {
    const patterns = [
      /(?:course\s+)?id[:\s]+(\d+)/i,
      /(?:course\s+)?#(\d+)/i,
      /\bid\s*:?\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  static extractCourseName(message: string): string | null {
    const patterns = [
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:tell me about course\s+|info about course\s+)(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:in course\s+|course named\s+|course called\s+)(.+?)(?:\s|$)/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        name = name.replace(/^(info|details|about|course)\s+/i, '');
        return name;
      }
    }
    return null;
  }
  
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      /(?:learning plan info\s+|lp info\s+|plan info\s+)(.+)/i,
      /(?:tell me about learning plan\s+|learning plan details\s+)(.+)/i,
      /(?:info\s+|details\s+)(.+?)(?:\s+learning plan)?$/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        if (!name.match(/^(for|about|on|in|the|a|an|info|details)$/i)) {
          name = name.replace(/^(info|details|about|learning plan)\s+/i, '');
          return name;
        }
      }
    }
    return null;
  }
  
  static extractAssignmentType(message: string): string | null {
    const patterns = [
      /(?:assignment\s+type\s+|as\s+|with\s+assignment\s+type\s+)(required|optional)/i,
      /(?:as\s+)(required|optional)/i,
      /(?:with\s+)(required|optional)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    return null;
  }
  
  static extractStartValidity(message: string): string | null {
    const patterns = [
      /(?:from\s+|start\s+validity\s+|start\s+date\s+|valid\s+from\s+)([\d-]+)/i,
      /(?:starting\s+)([\d-]+)/i,
      /(?:begin\s+)([\d-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && this.isValidDateFormat(match[1])) {
        return match[1];
      }
    }
    return null;
  }
  
  static extractEndValidity(message: string): string | null {
    const patterns = [
      /(?:to\s+|end\s+validity\s+|end\s+date\s+|valid\s+until\s+|expires\s+)([\d-]+)/i,
      /(?:ending\s+)([\d-]+)/i,
      /(?:until\s+)([\d-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && this.isValidDateFormat(match[1])) {
        return match[1];
      }
    }
    return null;
  }
  
  static isValidDateFormat(dateString: string): boolean {
    // Check YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(dateString);
  }
  
  static extractAfterPattern(message: string, pattern: RegExp): string | null {
    const match = message.match(pattern);
    return match && match[1] ? match[1].trim() : null;
  }
}
