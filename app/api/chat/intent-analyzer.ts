// app/api/chat/intent-analyzer.ts - FIXED with better course name extraction

export interface IntentAnalysis {
  intent: string;
  entities: any;
  confidence: number;
}

export class IntentAnalyzer {
  static analyzeIntent(message: string): IntentAnalysis {
    const lower = message.toLowerCase().trim();
    console.log(`🎯 ENHANCED INTENT: Analyzing intent for: "${message}"`);
    
    // Extract enhanced entities
    const email = this.extractEmail(message);
    const emails = this.extractMultipleEmails(message);
    const courseName = this.extractCourseName(message);
    const learningPlanName = this.extractLearningPlanName(message);
    const assignmentType = this.extractAssignmentType(message);
    const startValidity = this.extractStartDate(message);
    const endValidity = this.extractEndDate(message);
    const userId = this.extractUserId(message);
    
    console.log(`📊 ENHANCED ENTITIES:`, {
      email,
      emails: emails.length > 0 ? emails : 'none',
      courseName: courseName || 'none',
      learningPlanName: learningPlanName || 'none',
      assignmentType: assignmentType || 'none',
      startValidity: startValidity || 'none',
      endValidity: endValidity || 'none',
      userId: userId || 'none'
    });
    
    // Intent patterns with improved matching - COMPLETE LIST
    const patterns = [
      // FIXED: Load More Commands (HIGHEST PRIORITY - moved to top)
      {
        intent: 'load_more_enrollments',
        patterns: [
          /load more enrollments for\s+(.+)/i,
          /show more enrollments for\s+(.+)/i,
          /more enrollments for\s+(.+)/i,
          /continue enrollments for\s+(.+)/i,
          /load more for\s+(.+)/i,
          /get more enrollments\s+(.+)/i,
          /load more\s+(.+)/i
        ],
        extractEntities: () => {
          const loadMorePatterns = [
            /load more enrollments for\s+(.+?)(?:\s*$)/i,
            /show more enrollments for\s+(.+?)(?:\s*$)/i,
            /more enrollments for\s+(.+?)(?:\s*$)/i,
            /continue enrollments for\s+(.+?)(?:\s*$)/i,
            /load more for\s+(.+?)(?:\s*$)/i,
            /get more enrollments\s+(.+?)(?:\s*$)/i,
            /load more\s+(.+?)(?:\s*$)/i
          ];
          
          let userIdentifier = '';
          
          for (const pattern of loadMorePatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
              userIdentifier = match[1].trim();
              console.log(`🔄 LOAD MORE: Pattern matched: "${pattern.source}" -> "${userIdentifier}"`);
              break;
            }
          }
          
          // FIXED: Use the defined variables in scope
          if (!userIdentifier) {
            userIdentifier = email || userId || '';
            console.log(`🔄 LOAD MORE: Using fallback identifier: "${userIdentifier}"`);
          }
          
          console.log(`🔄 LOAD MORE: Final extracted user identifier: "${userIdentifier}"`);
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            loadMore: true,
            offset: '20'
          };
        },
        confidence: 0.99
      },

      // FIXED: Bulk Course Enrollment - NEW
      {
        intent: 'bulk_enroll_course',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i,
          /(?:bulk enroll|mass enroll)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🔄 BULK COURSE: Analyzing message: "${message}"`);
          
          const allEmails = this.extractMultipleEmails(message);
          console.log(`📧 BULK COURSE: Found ${allEmails.length} emails:`, allEmails);
          
          const courseMatch = message.match(/(?:enroll|add|assign|register|bulk enroll|mass enroll)\s+.+?\s+(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s*$|\s+with|\s+as)/i);
          let courseName = '';
          
          if (courseMatch && courseMatch[1]) {
            courseName = courseMatch[1].trim();
            courseName = courseName.replace(/\s+(with|as|using).*$/i, '');
            courseName = courseName.replace(/[\.!?]*$/, '');
          }
          
          console.log(`📚 BULK COURSE: Extracted course name: "${courseName}"`);
          
          return {
            emails: allEmails,
            courseName: courseName,
            resourceType: 'course',
            action: 'bulk_enroll',
            isBulk: true
          };
        },
        confidence: this.extractMultipleEmails ? (this.extractMultipleEmails(message).length > 1 ? 0.95 : 0.85) : 0.85
      },

      // FIXED: Bulk Learning Plan Enrollment - NEW
      {
        intent: 'bulk_enroll_learning_plan',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:bulk enroll|mass enroll)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🔄 BULK LP: Analyzing message: "${message}"`);
          
          const allEmails = this.extractMultipleEmails(message);
          console.log(`📧 BULK LP: Found ${allEmails.length} emails:`, allEmails);
          
          const lpMatch = message.match(/(?:enroll|add|assign|register|bulk enroll|mass enroll)\s+.+?\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s*$|\s+with|\s+as)/i);
          let learningPlanName = '';
          
          if (lpMatch && lpMatch[1]) {
            learningPlanName = lpMatch[1].trim();
            learningPlanName = learningPlanName.replace(/\s+(with|as|using).*$/i, '');
            learningPlanName = learningPlanName.replace(/[\.!?]*$/, '');
          }
          
          console.log(`📋 BULK LP: Extracted learning plan name: "${learningPlanName}"`);
          
          return {
            emails: allEmails,
            learningPlanName: learningPlanName,
            resourceType: 'learning_plan',
            action: 'bulk_enroll',
            isBulk: true
          };
        },
        confidence: this.extractMultipleEmails ? (this.extractMultipleEmails(message).length > 1 ? 0.95 : 0.85) : 0.85
      },

      // FIXED: Bulk Unenrollment - NEW
      {
        intent: 'bulk_unenroll',
        patterns: [
          /(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:course|training|learning plan|lp)\s+(.+)/i,
          /(?:bulk unenroll|mass unenroll|bulk remove)\s+(.+?)\s+(?:from|out of)\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🔄 BULK UNENROLL: Analyzing message: "${message}"`);
          
          const allEmails = this.extractMultipleEmails(message);
          console.log(`📧 BULK UNENROLL: Found ${allEmails.length} emails:`, allEmails);
          
          const isLearningPlan = /learning plan|lp/i.test(message);
          const resourceType = isLearningPlan ? 'learning_plan' : 'course';
          
          const resourceMatch = message.match(/(?:unenroll|remove|drop|bulk unenroll|mass unenroll|bulk remove)\s+.+?\s+(?:from|out of)\s+(?:course|training|learning plan|lp\s+)?(.+?)(?:\s*$|\s+with|\s+as)/i);
          let resourceName = '';
          
          if (resourceMatch && resourceMatch[1]) {
            resourceName = resourceMatch[1].trim();
            resourceName = resourceName.replace(/\s+(with|as|using).*$/i, '');
            resourceName = resourceName.replace(/[\.!?]*$/, '');
          }
          
          console.log(`📋 BULK UNENROLL: Resource type: ${resourceType}, name: "${resourceName}"`);
          
          return {
            emails: allEmails,
            resourceName: resourceName,
            resourceType: resourceType,
            action: 'bulk_unenroll',
            isBulk: true
          };
        },
        confidence: this.extractMultipleEmails ? (this.extractMultipleEmails(message).length > 1 ? 0.95 : 0.85) : 0.85
      },

      // User Summary Commands (high priority)
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

      // Recent Enrollments Commands (high priority)
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
            limit: 20
          };
        },
        confidence: 0.97
      },

      // Background processing commands
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

      // Status check commands (specific job status)
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

      // User enrollments (regular paginated) - LOWERED PRIORITY
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
        confidence: email || userId ? 0.85 : 0.75
      },

      // Specific enrollment checks
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

      // Individual Course and Learning Plan enrollment (UPDATED - lower priority than bulk)
         {
        intent: 'enroll_user_in_course',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i,
          /(?:course enrollment|course assign)\s+(.+?)\s+(?:to|in)\s+(.+)/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s+with\s+assignment|\s+as\s+|\s+from\s+|\s*$)/i);
          
          if (enrollMatch) {
            const userPart = enrollMatch[1].trim();
            let coursePart = enrollMatch[2].trim();
            
            // Clean up course name
            coursePart = coursePart.replace(/\s+(with|as|from).*$/i, '');
            coursePart = coursePart.replace(/[\.!?]*$/, '');
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              courseName: coursePart,
              resourceType: 'course',
              action: 'enroll',
              assignmentType: this.extractAssignmentType(message),
              startValidity: this.extractStartDate(message),
              endValidity: this.extractEndDate(message)
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
        confidence: 0.90
      },

      // Update the individual learning plan enrollment pattern:
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
            
            // Check if this is actually bulk (multiple emails)
            const allEmails = this.extractMultipleEmails(message);
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              emails: allEmails.length > 1 ? allEmails : null,
              learningPlanName: lpPart,
              resourceType: 'learning_plan',
              action: 'enroll',
              // FIXED: Extract assignment type and dates
              assignmentType: this.extractAssignmentType(message),
              startValidity: this.extractStartDate(message),
              endValidity: this.extractEndDate(message)
            };
          }
          
          return {
            email: email,
            learningPlanName: learningPlanName,
            resourceType: 'learning_plan',
            action: 'enroll',
            // FIXED: Extract assignment type and dates
            assignmentType: this.extractAssignmentType(message),
            startValidity: this.extractStartDate(message),
            endValidity: this.extractEndDate(message)
          };
        },
        confidence: 0.90
      },
static extractCourseName(message: string): string | null {
    console.log(`🔍 COURSE NAME: Extracting from: "${message}"`);
    
    const patterns = [
      // Enrollment patterns
      /(?:enroll\s+.+?\s+(?:in|to|for)\s+(?:course|training)\s+)(.+?)(?:\s+with\s+assignment|\s+as\s+|\s+from\s+|\s*$|\?|!|\.)/i,
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s*$|\s+id|\s+\d+|\?|!|\.)/i,
      
      // Quoted content - highest priority
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
      /'([^']+)'/,
      
      // Course ID patterns
      /(?:course|training)\s+(\d+)(?:\s|$)/i,
      
      // Generic patterns
      /(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s+with|\s+as|\s+from|\s*$|\?|!|\.)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        let name = match[1].trim();
        
        // Clean up common prefixes/suffixes
        name = name.replace(/^(info|details|about|course|training)\s+/i, '');
        name = name.replace(/\s+(info|details|course|training)$/i, '');
        name = name.replace(/\s+(with|as|from).*$/i, '');
        
        if (name.length > 1 && !name.match(/^(the|a|an|in|to|for|with|as)$/i)) {
          console.log(`✅ COURSE NAME: Final extracted: "${name}"`);
          return name;
        }
      }
    }
    
    console.log(`❌ COURSE NAME: Could not extract course name from: "${message}"`);
    return null;
  }
      // Unenrollment patterns
      {
        intent: 'unenroll_user_from_course',
        patterns: [
          /(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:course|training)\s+(.+?)(?:\s*$|\?|!|\.)/i,
          /(?:course unenrollment|remove from course)\s+(.+?)\s+(?:from|out of)\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🔍 UNENROLL COURSE: Analyzing message: "${message}"`);
          
          const unenrollMatch = message.match(/(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:course|training)\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (unenrollMatch) {
            const userPart = unenrollMatch[1].trim();
            let coursePart = unenrollMatch[2].trim();
            
            // FIXED: Better course name extraction for unenrollment
            // Remove common trailing words that aren't part of the course name
            coursePart = coursePart.replace(/\s+(please|now|immediately|today|asap)$/i, '');
            coursePart = coursePart.replace(/[\.!?]+$/, '');
            
            console.log(`👤 UNENROLL: User part: "${userPart}"`);
            console.log(`📚 UNENROLL: Course part: "${coursePart}"`);
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              courseName: coursePart,
              resourceType: 'course',
              action: 'unenroll'
            };
          }
          
          // Fallback extraction
          return {
            email: email,
            courseName: this.extractCourseNameForUnenroll(message),
            resourceType: 'course',
            action: 'unenroll'
          };
        },
        confidence: 0.98
      },

      {
        intent: 'unenroll_user_from_learning_plan',
        patterns: [
          /(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:lp unenrollment|remove from lp)\s+(.+?)\s+(?:from|out of)\s+(.+)/i
        ],
        extractEntities: () => {
          const unenrollMatch = message.match(/(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (unenrollMatch) {
            const userPart = unenrollMatch[1].trim();
            let lpPart = unenrollMatch[2].trim();
            
            // Clean up learning plan name
            lpPart = lpPart.replace(/\s+(please|now|immediately|today|asap)$/i, '');
            lpPart = lpPart.replace(/[\.!?]+$/, '');
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              learningPlanName: lpPart,
              resourceType: 'learning_plan',
              action: 'unenroll'
            };
          }
          
          return {
            email: email,
            learningPlanName: learningPlanName,
            resourceType: 'learning_plan',
            action: 'unenroll'
          };
        },
        confidence: 0.98
      },

      // User search (specific to email lookup) - LOWERED priority
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details|who is)\s+(.+)/i,
          /^(.+@.+\..+)$/i
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
        confidence: email ? 0.85 : 0.7
      },

      // Course and Learning Plan searches
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

      // Info commands
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
            courseId: this.extractCourseId(message),
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

      // Help commands
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
            if (this.validateEntities(entities, pattern.intent)) {
              bestMatch = {
                intent: pattern.intent,
                entities: entities,
                confidence: pattern.confidence
              };
              console.log(`🎯 MATCHED: ${pattern.intent} with confidence: ${pattern.confidence}`);
              break;
            }
          }
        }
      }
      
      if (bestMatch.confidence > 0.95) {
        break;
      }
    }
    
    console.log(`🎯 FINAL INTENT:`, {
      intent: bestMatch.intent,
      confidence: bestMatch.confidence,
      entities: bestMatch.entities
    });
    
    return bestMatch;
  }
  
  // FIXED: Enhanced entity validation
  private static validateEntities(entities: any, intent: string): boolean {
    switch (intent) {
      case 'load_more_enrollments':
        const hasValidIdentifier = !!(entities.email || entities.userId);
        console.log(`🔄 LOAD MORE: Validating entities - hasValidIdentifier: ${hasValidIdentifier}`, entities);
        return hasValidIdentifier;
        
      case 'get_user_summary':
        return !!(entities.email || entities.userId);
        
      case 'get_recent_enrollments':
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
      
      case 'unenroll_user_from_course':
        return !!(entities.email && entities.courseName);
      
      case 'unenroll_user_from_learning_plan':
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
  
  // IMPROVED: Email extraction methods
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
  
  static extractCourseName(message: string): string | null {
    const patterns = [
      // FIXED: Better course name extraction patterns that capture full names
      /(?:enroll\s+.+?\s+(?:in|to|for)\s+(?:course|training)\s+)(.+?)(?:\s+with\s+assignment|\s+as\s+|\s+from\s+|\s*$|\?|!|\.)/i,
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s*$|\s+id|\s+\d+|\?|!|\.)/i,
      /(?:tell me about course\s+|info about course\s+)(.+?)(?:\s*$|\s+id|\s+\d+|\?|!|\.)/i,
      /(?:find\s+course\s+|search\s+course\s+)(.+?)(?:\s*$|\?|!|\.)/i,
      
      // FIXED: Quoted content - highest priority
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
      
      // FIXED: Generic patterns - more flexible
      /(?:course|training)\s+(?:named|called)\s+(.+?)(?:\s+with\s+assignment|\s+as\s+|\s+from\s+|\s*$|\?|!|\.)/i,
      /(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s+with\s+assignment|\s+as\s+|\s+from\s+|\s*$|\?|!|\.)/i
    ];
    
    console.log(`🔍 COURSE NAME: Extracting from: "${message}"`);
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        let name = match[1].trim();
        
        console.log(`🎯 COURSE NAME: Pattern matched: ${pattern.source} -> "${name}"`);
        
        // Clean up common prefixes/suffixes but preserve the full name
        name = name.replace(/^(info|details|about|course|training)\s+/i, '');
        name = name.replace(/\s+(info|details|course|training)$/i, '');
        
        // Don't return very short or generic terms
        if (name.length > 1 && !name.match(/^(the|a|an|in|to|for|with|as)$/i)) {
          console.log(`✅ COURSE NAME: Final extracted: "${name}"`);
          return name;
        }
      }
    }
    
    console.log(`❌ COURSE NAME: Could not extract course name from: "${message}"`);
    return null;
  }

    static extractAssignmentType(message: string): string | null {
    const patterns = [
      /(?:assignment\s+type|as)\s+(mandatory|required|recommended|optional)/i,
      /(?:with|using)\s+assignment\s+type\s+(mandatory|required|recommended|optional)/i,
      /(?:make\s+it|set\s+as|mark\s+as|assign\s+as)\s+(mandatory|required|recommended|optional)/i,
      /(mandatory|required|recommended|optional)\s+assignment/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    return null;
  }

  static extractStartDate(message: string): string | null {
    const patterns = [
      /(?:start\s+(?:validity|date)|from|beginning|starts?)\s+(\d{4}-\d{2}-\d{2})/i,
      /(?:valid\s+from|effective\s+from|active\s+from)\s+(\d{4}-\d{2}-\d{2})/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  static extractEndDate(message: string): string | null {
    const patterns = [
      /(?:end\s+(?:validity|date)|to|until|expires?)\s+(\d{4}-\d{2}-\d{2})/i,
      /(?:valid\s+until|expires\s+on)\s+(\d{4}-\d{2}-\d{2})/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

static parseNaturalDate(dateStr: string): string | null {
  try {
    // Convert "Sept 30th 2025" to "2025-09-30"
    const date = new Date(dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1'));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
  } catch (error) {
    console.log('Date parsing failed:', error);
  }
  return null;
}

  static extractLearningPlanName(message: string): string | null {
    // Implementation similar to course name extraction
    return null; // Placeholder
  }

  private static validateEntities(entities: any, intent: string): boolean {
    switch (intent) {
      case 'unenroll_user_from_course':
        return !!(entities.email && entities.courseName);
      case 'unenroll_user_from_learning_plan':
        return !!(entities.email && entities.learningPlanName);
      case 'enroll_user_in_course':
        return !!(entities.email && entities.courseName);
      case 'search_courses':
        return !!entities.searchTerm;
      default:
        return true;
    }
  }
}
    
    console.log(`❌ ENHANCED LP NAME: Could not extract learning plan name from: "${message}"`);
    return null;
  }
}
