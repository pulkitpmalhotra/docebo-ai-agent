// app/api/chat/intent-analyzer.ts - Added User Summary Intent Pattern
import { IntentAnalysis } from './types';

export class IntentAnalyzer {
  static analyzeIntent(message: string): IntentAnalysis {
    const lower = message.toLowerCase().trim();
    console.log(`🎯 FIXED: Analyzing intent for: "${message}"`);
    
    // Extract entities first with improved patterns
    const email = this.extractEmail(message);
    const emails = this.extractMultipleEmails(message);
    const courseId = this.extractCourseId(message);
    const courseName = this.extractCourseName(message);
    const learningPlanName = this.extractLearningPlanName(message);
    const userId = this.extractUserId(message);
    
    console.log(`📊 FIXED: Extracted entities:`, {
      email,
      emails: emails.length > 0 ? emails : 'none',
      courseName: courseName || 'none',
      learningPlanName: learningPlanName || 'none',
      userId: userId || 'none'
    });
    
    // Intent patterns with improved matching - PRIORITY ORDER MATTERS
    const patterns = [
      // ADDED: User Summary Commands (high priority)
      {
        intent: 'get_user_summary',
        patterns: [
          /(?:user summary|summary for user|user overview)\s+(.+)/i,
          /get summary for\s+(.+)/i,
          /show summary\s+(.+)/i
        ],
        extractEntities: () => {
          const summaryMatch = message.match(/(?:user summary|summary for user|user overview|get summary for|show summary)\s+(.+?)(?:\s|$)/i);
          const userIdentifier = summaryMatch ? summaryMatch[1].trim() : email || userId;
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            requestType: 'user_summary'
          };
        },
        confidence: 0.98
      },

      // ADDED: Recent Enrollments Commands (high priority)
      {
        intent: 'get_recent_enrollments',
        patterns: [
          /(?:recent enrollments|recent enrollment|latest enrollments)\s+(.+)/i,
          /(?:recent|latest)\s+(.+?)\s+enrollments/i,
          /show recent\s+(.+)/i,
          /get recent for\s+(.+)/i
        ],
        extractEntities: () => {
          const recentMatch = message.match(/(?:recent enrollments|recent enrollment|latest enrollments|show recent|get recent for)\s+(.+?)(?:\s|$)/i) ||
                             message.match(/(?:recent|latest)\s+(.+?)\s+enrollments/i);
          const userIdentifier = recentMatch ? recentMatch[1].trim() : email || userId;
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            requestType: 'recent_enrollments',
            limit: 20 // Default limit for recent enrollments
          };
        },
        confidence: 0.97
      },

      // FIXED: Load More Commands (highest priority)
      {
        intent: 'load_more_enrollments',
        patterns: [
          /load more enrollments for\s+(.+)/i,
          /show more enrollments for\s+(.+)/i,
          /more enrollments for\s+(.+)/i,
          /continue enrollments for\s+(.+)/i
        ],
        extractEntities: () => {
          const userMatch = message.match(/(?:load more|show more|more) enrollments for\s+(.+?)(?:\s|$)/i);
          const userIdentifier = userMatch ? userMatch[1].trim() : email;
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            loadMore: true,
            offset: '20' // Default offset for load more
          };
        },
        confidence: 0.99
      },

      // FIXED: Status check commands (specific job status)
      {
        intent: 'check_job_status',
        patterns: [
          /check status of\s+(.+)/i,
          /status of job\s+(.+)/i,
          /job status\s+(.+)/i,
          /background status\s+(.+)/i
        ],
        extractEntities: () => {
          const jobMatch = message.match(/(?:check status of|status of job|job status|background status)\s+(.+?)(?:\s|$)/i);
          const jobId = jobMatch ? jobMatch[1].trim() : null;
          
          return {
            jobId: jobId,
            requestType: 'status_check'
          };
        },
        confidence: 0.98
      },

      // FIXED: Background processing commands
      {
        intent: 'background_user_enrollments',
        patterns: [
          /load all enrollments in background for\s+(.+)/i,
          /process enrollments in background for\s+(.+)/i,
          /background enrollments for\s+(.+)/i,
          /get all enrollments background for\s+(.+)/i,
          /heavy enrollment processing for\s+(.+)/i
        ],
        extractEntities: () => {
          const userMatch = message.match(/(?:background|load all|process|heavy).*?(?:enrollments?|processing).*?for\s+(.+?)(?:\s|$)/i);
          const userIdentifier = userMatch ? userMatch[1].trim() : email || userId;
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            processingType: 'background',
            requestType: 'all_enrollments'
          };
        },
        confidence: 0.97
      },

      // FIXED: User enrollments (regular paginated)
      {
        intent: 'get_user_enrollments',
        patterns: [
          /user enrollments\s+(.+)/i,
          /enrollments for\s+(.+)/i,
          /show enrollments for\s+(.+)/i,
          /get enrollments\s+(.+)/i,
          /list enrollments for\s+(.+)/i,
          /(.+)\s+enrollments$/i
        ],
        extractEntities: () => {
          let userIdentifier = '';
          
          // Try different patterns to extract user identifier
          const patterns = [
            /user enrollments\s+(.+?)(?:\s|$)/i,
            /enrollments for\s+(.+?)(?:\s|$)/i,
            /show enrollments for\s+(.+?)(?:\s|$)/i,
            /get enrollments\s+(.+?)(?:\s|$)/i,
            /list enrollments for\s+(.+?)(?:\s|$)/i,
            /(.+?)\s+enrollments$/i
          ];
          
          for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
              userIdentifier = match[1].trim();
              break;
            }
          }
          
          // Fallback to extracted email
          if (!userIdentifier) {
            userIdentifier = email || userId || '';
          }
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            loadMore: false,
            offset: '0'
          };
        },
        confidence: email || userId ? 0.95 : 0.85
      },

      // FIXED: Specific enrollment checks
      {
        intent: 'check_specific_enrollment',
        patterns: [
          /(?:check if|is)\s+(.+?)\s+(?:enrolled|taking|assigned to|has completed|completed)\s+(?:in\s+)?(?:course|learning plan|lp)\s+(.+)/i,
          /(?:has|did)\s+(.+?)\s+(?:complete|completed|finish|finished)\s+(?:course|learning plan|lp)\s+(.+)/i,
          /enrollment status\s+(.+?)\s+(?:in\s+)?(?:course|learning plan|lp)\s+(.+)/i
        ],
        extractEntities: () => {
          const checkMatch = message.match(/(?:check if|is|has|did|enrollment status)\s+(.+?)\s+(?:enrolled|taking|completed?|finish|status)\s+(?:in\s+)?(?:course|learning plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (checkMatch) {
            const userPart = checkMatch[1].trim();
            const resourcePart = checkMatch[2].trim();
            const isLearningPlan = /learning plan|lp/i.test(message);
            const isCompletionCheck = /completed?|finish|has completed/i.test(message);
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              resourceName: resourcePart,
              resourceType: isLearningPlan ? 'learning_plan' : 'course',
              checkType: isCompletionCheck ? 'completion' : 'enrollment'
            };
          }
          
          return {
            email: email,
            resourceName: courseName || learningPlanName || '',
            resourceType: learningPlanName ? 'learning_plan' : 'course',
            checkType: /completed?|finish/i.test(message) ? 'completion' : 'enrollment'
          };
        },
        confidence: 0.95
      },

      // FIXED: Course and Learning Plan enrollment
      {
        intent: 'enroll_user_in_course',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i,
          /(?:course enrollment|course assign)\s+(.+?)\s+(?:to|in)\s+(.+)/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s|$)/i);
          
          if (enrollMatch) {
            const userPart = enrollMatch[1].trim();
            const coursePart = enrollMatch[2].trim();
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              courseName: coursePart,
              resourceType: 'course',
              action: 'enroll'
            };
          }
          
          return {
            email: email,
            courseName: courseName,
            resourceType: 'course',
            action: 'enroll'
          };
        },
        confidence: 0.95
      },

      {
        intent: 'enroll_user_in_learning_plan',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:learning plan enrollment|lp assign)\s+(.+?)\s+(?:to|in)\s+(.+)/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s|$)/i);
          
          if (enrollMatch) {
            const userPart = enrollMatch[1].trim();
            const lpPart = enrollMatch[2].trim();
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              learningPlanName: lpPart,
              resourceType: 'learning_plan',
              action: 'enroll'
            };
          }
          
          return {
            email: email,
            learningPlanName: learningPlanName,
            resourceType: 'learning_plan',
            action: 'enroll'
          };
        },
        confidence: 0.95
      },

      // FIXED: User search (specific to email lookup) - LOWER priority now
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details|who is)\s+(.+)/i,
          /^(.+@.+\..+)$/i // Email pattern
        ],
        extractEntities: () => {
          const searchMatch = message.match(/(?:find user|search user|look up user|user info|user details|who is)\s+(.+?)(?:\s|$)/i);
          const searchTerm = searchMatch ? searchMatch[1].trim() : (email || message.trim());
          
          return {
            email: this.extractEmailFromText(searchTerm) || (searchTerm.includes('@') ? searchTerm : null),
            searchTerm: searchTerm,
            userId: /^\d+$/.test(searchTerm) ? searchTerm : null
          };
        },
        confidence: email ? 0.85 : 0.7 // REDUCED priority so user summary takes precedence
      },

      // FIXED: Course and Learning Plan searches
      {
        intent: 'search_courses',
        patterns: [
          /(?:find|search)\s+(.+?)\s+(?:course|courses|training)/i,
          /(?:course|courses)\s+(?:about|for|on)\s+(.+)/i,
          /find course\s+(.+)/i,
          /search course\s+(.+)/i
        ],
        extractEntities: () => {
          const courseMatch = message.match(/(?:find|search)\s+(.+?)\s+(?:course|courses|training)/i) ||
                             message.match(/(?:course|courses)\s+(?:about|for|on)\s+(.+?)(?:\s|$)/i) ||
                             message.match(/(?:find course|search course)\s+(.+?)(?:\s|$)/i);
          
          return {
            searchTerm: courseMatch ? courseMatch[1].trim() : (courseName || '')
          };
        },
        confidence: 0.9
      },

      {
        intent: 'search_learning_plans',
        patterns: [
          /(?:find|search)\s+(.+?)\s+(?:learning plan|learning plans|lp)/i,
          /(?:learning plan|learning plans|lp)\s+(?:about|for|on)\s+(.+)/i,
          /find learning plan\s+(.+)/i
        ],
        extractEntities: () => {
          const lpMatch = message.match(/(?:find|search)\s+(.+?)\s+(?:learning plan|learning plans|lp)/i) ||
                        message.match(/(?:learning plan|learning plans|lp)\s+(?:about|for|on)\s+(.+?)(?:\s|$)/i) ||
                        message.match(/find learning plan\s+(.+?)(?:\s|$)/i);
          
          return {
            searchTerm: lpMatch ? lpMatch[1].trim() : (learningPlanName || '')
          };
        },
        confidence: 0.9
      },

      // FIXED: Info commands
      {
        intent: 'get_course_info',
        patterns: [
          /(?:course info|course details|course information)\s+(.+)/i,
          /(?:info|details|information)\s+(?:about\s+)?course\s+(.+)/i,
          /tell me about course\s+(.+)/i
        ],
        extractEntities: () => {
          const infoMatch = message.match(/(?:course info|course details|course information|info about course|details about course|tell me about course)\s+(.+?)(?:\s|$)/i);
          
          return {
            courseId: courseId,
            courseName: infoMatch ? infoMatch[1].trim() : (courseName || '')
          };
        },
        confidence: 0.92
      },

      {
        intent: 'get_learning_plan_info',
        patterns: [
          /(?:learning plan info|lp info|plan info)\s+(.+)/i,
          /(?:info|details|information)\s+(?:about\s+)?(?:learning plan|lp)\s+(.+)/i,
          /tell me about learning plan\s+(.+)/i
        ],
        extractEntities: () => {
          const infoMatch = message.match(/(?:learning plan info|lp info|plan info|info about learning plan|details about learning plan|tell me about learning plan)\s+(.+?)(?:\s|$)/i);
          
          return {
            learningPlanName: infoMatch ? infoMatch[1].trim() : (learningPlanName || '')
          };
        },
        confidence: 0.92
      },

      // FIXED: Help commands
      {
        intent: 'docebo_help',
        patterns: [
          /(?:how to|how do i|how does|how can i)/i,
          /(?:help|guide|tutorial|documentation)/i,
          /(?:troubleshoot|problem|issue|error)/i
        ],
        extractEntities: () => ({
          query: message
        }),
        confidence: 0.7
      }
    ];
    
    // Find best matching pattern
    let bestMatch = { intent: 'unknown', entities: {}, confidence: 0 };
    
    for (const pattern of patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(message)) {
          const entities = pattern.extractEntities();
          if (entities && pattern.confidence > bestMatch.confidence) {
            // FIXED: Additional validation for entities
            if (this.validateEntities(entities, pattern.intent)) {
              bestMatch = {
                intent: pattern.intent,
                entities: entities,
                confidence: pattern.confidence
              };
              console.log(`🎯 FIXED: Matched intent: ${pattern.intent} with confidence: ${pattern.confidence}`);
              break; // Take the first strong match
            }
          }
        }
      }
      
      // If we found a high-confidence match, stop looking
      if (bestMatch.confidence > 0.95) {
        break;
      }
    }
    
    console.log(`🎯 FIXED: Final intent analysis:`, {
      intent: bestMatch.intent,
      confidence: bestMatch.confidence,
      entities: bestMatch.entities
    });
    
    return bestMatch;
  }
  
  // FIXED: Enhanced entity validation
  private static validateEntities(entities: any, intent: string): boolean {
    switch (intent) {
      case 'get_user_summary':
        return !!(entities.email || entities.userId);
        
      case 'get_recent_enrollments':
        return !!(entities.email || entities.userId);
        
      case 'load_more_enrollments':
        return !!(entities.email || entities.userId);
      
      case 'check_job_status':
        return !!entities.jobId;
      
      case 'background_user_enrollments':
        return !!(entities.email || entities.userId);
      
      case 'get_user_enrollments':
        return !!(entities.email || entities.userId);
      
      case 'check_specific_enrollment':
        return !!(entities.email && entities.resourceName);
      
      case 'enroll_user_in_course':
        return !!(entities.email && entities.courseName);
      
      case 'enroll_user_in_learning_plan':
        return !!(entities.email && entities.learningPlanName);
      
      case 'search_users':
        return !!(entities.email || entities.searchTerm || entities.userId);
      
      case 'search_courses':
        return !!entities.searchTerm;
      
      case 'search_learning_plans':
        return !!entities.searchTerm;
      
      case 'get_course_info':
        return !!(entities.courseId || entities.courseName);
      
      case 'get_learning_plan_info':
        return !!entities.learningPlanName;
      
      default:
        return true; // Allow other intents through
    }
  }
  
  // FIXED: Improved email extraction
  static extractEmail(message: string): string | null {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = message.match(emailRegex);
    return match ? match[0] : null;
  }
  
  static extractEmailFromText(text: string): string | null {
    if (!text) return null;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
  }
  
  static extractMultipleEmails(message: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = message.match(emailRegex) || [];
    return [...new Set(emails.map(email => email.toLowerCase()))];
  }
  
  // FIXED: User ID extraction
  static extractUserId(message: string): string | null {
    const patterns = [
      /(?:user\s+)?id[:\s]+(\d+)/i,
      /(?:user\s+)?#(\d+)/i,
      /\bid\s*:?\s*(\d+)/i,
      /user\s+(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  static extractCourseId(message: string): string | null {
    const patterns = [
      /(?:course\s+)?id[:\s]+(\d+)/i,
      /(?:course\s+)?#(\d+)/i,
      /course\s+(\d+)(?:\s|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  // FIXED: Improved course name extraction
  static extractCourseName(message: string): string | null {
    const patterns = [
      // Exact patterns for course info commands
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      /(?:tell me about course\s+|info about course\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      
      // Patterns for enrollment commands
      /(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      /(?:course|training)\s+(?:named|called)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      
      // Quoted patterns
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
      
      // Generic course mention
      /course\s+(.+?)(?:\s*$|\?|!|\.)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        let name = match[1].trim();
        
        // Clean up common prefixes/suffixes
        name = name.replace(/^(info|details|about|course|training)\s+/i, '');
        name = name.replace(/\s+(info|details|course|training)$/i, '');
        
        // Don't return very short or generic terms
        if (name.length > 1 && !name.match(/^(the|a|an|in|to|for|with|as)$/i)) {
          return name;
        }
      }
    }
    return null;
  }
  
  // FIXED: Improved learning plan name extraction
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      // Exact patterns for learning plan info commands
      /(?:learning plan info\s+|lp info\s+|plan info\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      /(?:tell me about learning plan\s+|info about learning plan\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      
      // Patterns for enrollment commands
      /(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      /(?:learning plan|lp)\s+(?:named|called)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      
      // Quoted patterns
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
      
      // Generic learning plan mention
      /(?:learning plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i,
      
      // Handle "info X" pattern where X might be a learning plan
      /^(?:info|details)\s+(.+?)(?:\s*$|\?|!|\.)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        let name = match[1].trim();
        
        // Clean up common prefixes/suffixes
        name = name.replace(/^(info|details|about|learning plan|lp|plan)\s+/i, '');
        name = name.replace(/\s+(info|details|learning plan|lp|plan)$/i, '');
        
        // Don't return very short or generic terms
        if (name.length > 1 && !name.match(/^(the|a|an|in|to|for|with|as)$/i)) {
          return name;
        }
      }
    }
    return null;
  }
}
