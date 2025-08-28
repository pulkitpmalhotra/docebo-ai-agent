// app/api/chat/intent-analyzer.ts - FIXED with better course name extraction and proper syntax

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
    
    // Intent patterns with improved matching
    const patterns = [
      // LOAD MORE patterns - HIGH PRIORITY for pagination
      {
        intent: 'load_more_enrollments',
        patterns: [
          /(?:load more|show more|get more|continue|more)\s+(?:enrollments?)\s+(?:for\s+)?(.+)/i,
          /(?:more|continue)\s+(?:enrollments?)\s+(.+)/i,
          /load\s+more\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🔄 LOAD MORE: Analyzing message: "${message}"`);
          
          const loadMoreMatch = message.match(/(?:load more|show more|get more|continue|more)\s+(?:enrollments?\s+)?(?:for\s+)?(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (loadMoreMatch) {
            const userPart = loadMoreMatch[1].trim();
            const userEmail = this.extractEmailFromText(userPart) || userPart;
            
            console.log(`📧 LOAD MORE: Extracted email: "${userEmail}"`);
            
            return {
              email: userEmail,
              loadMore: true,
              offset: this.extractOffset(message) || 20 // Default offset for pagination
            };
          }
          
          return {
            email: email,
            loadMore: true,
            offset: 20
          };
        },
        confidence: 0.95
      },

      // BACKGROUND PROCESSING patterns
      {
        intent: 'background_user_enrollments',
        patterns: [
          /(?:load all|process|get all|fetch all)\s+(?:enrollments?\s+)?(?:in\s+background\s+)?(?:for\s+)?(.+)/i,
          /(?:background|complete)\s+(?:processing|enrollment)\s+(?:for\s+)?(.+)/i
        ],
        extractEntities: () => {
          const bgMatch = message.match(/(?:load all|process|get all|fetch all)\s+(?:enrollments?\s+)?(?:in\s+background\s+)?(?:for\s+)?(.+?)(?:\s*$|\?|!|\.)/i) ||
                         message.match(/(?:background|complete)\s+(?:processing|enrollment)\s+(?:for\s+)?(.+?)(?:\s*$|\?|!|\.)/i);
          
          return {
            email: bgMatch ? (this.extractEmailFromText(bgMatch[1]) || bgMatch[1].trim()) : email,
            backgroundProcessing: true
          };
        },
        confidence: 0.90
      },

      // USER SUMMARY patterns
      {
        intent: 'get_user_summary',
        patterns: [
          /(?:user\s+summary|summary\s+for\s+user|overview\s+for)\s+(.+)/i,
          /(?:summary|overview)\s+(.+@.+)/i
        ],
        extractEntities: () => {
          const summaryMatch = message.match(/(?:user\s+summary|summary\s+for\s+user|overview\s+for)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                              message.match(/(?:summary|overview)\s+(.+@.+?)(?:\s*$|\?|!|\.)/i);
          
          return {
            email: summaryMatch ? (this.extractEmailFromText(summaryMatch[1]) || summaryMatch[1].trim()) : email
          };
        },
        confidence: 0.85
      },

      // RECENT ENROLLMENTS patterns
      {
        intent: 'get_recent_enrollments', 
        patterns: [
          /(?:recent|latest)\s+enrollments?\s+(?:for\s+)?(.+)/i,
          /(?:last|newest)\s+\d*\s*enrollments?\s+(.+)/i
        ],
        extractEntities: () => {
          const recentMatch = message.match(/(?:recent|latest)\s+enrollments?\s+(?:for\s+)?(.+?)(?:\s*$|\?|!|\.)/i) ||
                             message.match(/(?:last|newest)\s+(\d+)\s*enrollments?\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          return {
            email: recentMatch ? (this.extractEmailFromText(recentMatch[1]) || recentMatch[1].trim()) : email,
            limit: recentMatch && recentMatch.length > 2 ? parseInt(recentMatch[1]) : 20
          };
        },
        confidence: 0.88
      },

      // User enrollment patterns
      {
        intent: 'get_user_enrollments',
        patterns: [
          /(?:user\s+enrollments?|enrollments?\s+for|show\s+enrollments?)\s+(.+)/i,
          /(.+@.+)\s+enrollments?/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:user\s+enrollments?|enrollments?\s+for|show\s+enrollments?)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                             message.match(/(.+@.+?)\s+enrollments?(?:\s*$|\?|!|\.)/i);
          
          return {
            email: enrollMatch ? (this.extractEmailFromText(enrollMatch[1]) || enrollMatch[1].trim()) : email
          };
        },
        confidence: 0.85
      },

      // BULK ENROLLMENT patterns (HIGH PRIORITY for multiple emails)
      {
        intent: 'bulk_enroll_course',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i,
          /(?:bulk|mass)\s+(?:enroll|add)\s+(.+?)\s+(?:to|in)\s+(?:course|training)\s+(.+)/i
        ],
        extractEntities: () => {
          const allEmails = this.extractMultipleEmails(message);
          
          if (allEmails.length <= 1) return null; // Not bulk
          
          console.log(`🎯 BULK COURSE: Analyzing bulk enrollment: ${allEmails.length} emails`);
          
          const courseMatch = message.match(/(?:course|training)\s+(.+?)(?:\s+with|\s+as|\s+from|\s*$|\?|!|\.)/i);
          
          return {
            emails: allEmails,
            courseName: courseMatch ? courseMatch[1].trim() : courseName,
            assignmentType: this.extractAssignmentType(message),
            startValidity: this.extractStartDate(message),
            endValidity: this.extractEndDate(message),
            resourceType: 'course',
            action: 'bulk_enroll',
            isBulk: true
          };
        },
        confidence: this.extractMultipleEmails(message).length > 1 ? 0.95 : 0
      },

      {
        intent: 'bulk_enroll_learning_plan',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:bulk|mass)\s+(?:enroll|add)\s+(.+?)\s+(?:to|in)\s+(?:learning plan|lp)\s+(.+)/i
        ],
        extractEntities: () => {
          const allEmails = this.extractMultipleEmails(message);
          
          if (allEmails.length <= 1) return null; // Not bulk
          
          console.log(`🎯 BULK LP: Analyzing bulk learning plan enrollment: ${allEmails.length} emails`);
          
          const lpMatch = message.match(/(?:learning plan|lp|learning path)\s+(.+?)(?:\s+with|\s+as|\s+from|\s*$|\?|!|\.)/i);
          
          return {
            emails: allEmails,
            learningPlanName: lpMatch ? lpMatch[1].trim() : learningPlanName,
            assignmentType: this.extractAssignmentType(message),
            startValidity: this.extractStartDate(message),
            endValidity: this.extractEndDate(message),
            resourceType: 'learning_plan',
            action: 'bulk_enroll',
            isBulk: true
          };
        },
        confidence: this.extractMultipleEmails(message).length > 1 ? 0.95 : 0
      },

{
  intent: 'bulk_unenroll',
  patterns: [
    /(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(.+)/i,
    /(?:bulk|mass)\s+(?:unenroll|remove)\s+(.+?)\s+(?:from|out of)\s+(.+)/i
  ],
  extractEntities: () => {
    const allEmails = this.extractMultipleEmails(message);
    
    // CRITICAL FIX: Only process if multiple emails are actually found
    if (allEmails.length <= 1) {
      console.log(`❌ NOT BULK: Only ${allEmails.length} email(s) found, not a bulk operation`);
      return null; // Not bulk
    }
    
    console.log(`🎯 BULK UNENROLL: Analyzing bulk unenrollment: ${allEmails.length} emails`);
    
    const resourceMatch = message.match(/(?:from|out of)\s+(?:course|training|learning plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                         message.match(/(?:from|out of)\s+(.+?)(?:\s*$|\?|!|\.)/i);
    
    const resourceType = /learning plan|lp|learning path/i.test(message) ? 'learning_plan' : 'course';
    
    return {
      emails: allEmails,
      resourceName: resourceMatch ? resourceMatch[1].trim() : (courseName || learningPlanName),
      resourceType: resourceType,
      action: 'bulk_unenroll',
      isBulk: true
    };
  },
  confidence: this.extractMultipleEmails(message).length > 1 ? 0.99 : 0 // HIGHER confidence than individual when multiple emails
},

      // ENROLLMENT CHECKING patterns
      {
        intent: 'check_specific_enrollment',
        patterns: [
          /(?:check if|is|has)\s+(.+?)\s+(?:enrolled in|assigned to|taking)\s+(.+)/i,
          /(?:check|verify)\s+enrollment\s+(?:of\s+|for\s+)?(.+?)\s+(?:in|for)\s+(.+)/i
        ],
        extractEntities: () => {
          const checkMatch = message.match(/(?:check if|is|has)\s+(.+?)\s+(?:enrolled in|assigned to|taking)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                            message.match(/(?:check|verify)\s+enrollment\s+(?:of\s+|for\s+)?(.+?)\s+(?:in|for)\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (checkMatch) {
            const userPart = checkMatch[1].trim();
            const resourcePart = checkMatch[2].trim();
            
            const resourceType = /learning plan|lp|learning path/i.test(message) ? 'learning_plan' : 'course';
            const checkType = /completed|finished|done/i.test(message) ? 'completion' : 'enrollment';
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              resourceName: resourcePart,
              resourceType: resourceType,
              checkType: checkType,
              query: message
            };
          }
          
          return {
            email: email,
            resourceName: courseName || learningPlanName,
            resourceType: learningPlanName ? 'learning_plan' : 'course',
            checkType: 'enrollment',
            query: message
          };
        },
        confidence: 0.88
      },

      // UNENROLLMENT patterns - HIGHEST PRIORITY for unenroll commands
{
  intent: 'unenroll_user_from_course',
  patterns: [
    /(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:course|training)\s+(.+?)(?:\s*$|\?|!|\.)/i,
    /(?:course unenrollment|remove from course)\s+(.+?)\s+(?:from|out of)\s+(.+)/i
  ],
  extractEntities: () => {
    console.log(`🔍 UNENROLL COURSE: Analyzing message: "${message}"`);
    
    // CRITICAL FIX: Check for multiple emails FIRST - if found, return null to defer to bulk handler
    const allEmails = this.extractMultipleEmails(message);
    if (allEmails.length > 1) {
      console.log(`🔄 DEFER TO BULK: Found ${allEmails.length} emails, deferring to bulk unenrollment handler`);
      return null; // Let bulk handler process this
    }
    
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
  confidence: 0.98 // Keep high confidence but defer to bulk when multiple emails detected
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

      // ENROLLMENT patterns
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

      {
        intent: 'enroll_user_in_learning_plan',
        patterns: [
          /(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
          /(?:lp enrollment|lp assign)\s+(.+?)\s+(?:to|in)\s+(.+)/i
        ],
        extractEntities: () => {
          const enrollMatch = message.match(/(?:enroll|add|assign|register)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s+with\s+assignment|\s+as\s+|\s+from\s+|\s*$)/i);
          
          if (enrollMatch) {
            const userPart = enrollMatch[1].trim();
            let lpPart = enrollMatch[2].trim();
            
            // Clean up learning plan name
            lpPart = lpPart.replace(/\s+(with|as|from).*$/i, '');
            lpPart = lpPart.replace(/[\.!?]*$/, '');
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              learningPlanName: lpPart,
              resourceType: 'learning_plan',
              action: 'enroll',
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
            assignmentType: assignmentType,
            startValidity: startValidity,
            endValidity: endValidity
          };
        },
        confidence: 0.90
      },

      // Search patterns
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

      // User search patterns
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

      // SEARCH LEARNING PLANS patterns
      {
        intent: 'search_learning_plans',
        patterns: [
          /(?:find|search)\s+(.+?)\s+(?:learning plan|learning plans|lp|lps)/i,
          /(?:learning plan|learning plans|lp|lps)\s+(?:about|for|on)\s+(.+)/i,
          /find\s+learning plan\s+(.+)/i
        ],
        extractEntities: () => {
          const lpMatch = message.match(/(?:find|search)\s+(.+?)\s+(?:learning plan|learning plans|lp|lps)/i) ||
                         message.match(/(?:learning plan|learning plans|lp|lps)\s+(?:about|for|on)\s+(.+?)(?:\s|$)/i) ||
                         message.match(/find\s+learning plan\s+(.+?)(?:\s|$)/i);
          
          return {
            searchTerm: lpMatch ? lpMatch[1].trim() : learningPlanName || ''
          };
        },
        confidence: 0.9
      },

      // INFO patterns
      {
        intent: 'get_course_info',
        patterns: [
          /(?:course\s+info|course\s+details|course\s+information|about\s+course)\s+(.+)/i,
          /(?:info|details|information)\s+(?:for\s+|about\s+)?course\s+(.+)/i,
          /(?:describe|tell me about)\s+course\s+(.+)/i
        ],
        extractEntities: () => {
          const courseInfoMatch = message.match(/(?:course\s+info|course\s+details|course\s+information|about\s+course)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                                 message.match(/(?:info|details|information)\s+(?:for\s+|about\s+)?course\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                                 message.match(/(?:describe|tell me about)\s+course\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          return {
            courseId: /^\d+$/.test(courseInfoMatch?.[1]?.trim() || '') ? courseInfoMatch?.[1]?.trim() : null,
            courseName: courseInfoMatch ? courseInfoMatch[1].trim() : courseName
          };
        },
        confidence: 0.9
      },

      {
        intent: 'get_learning_plan_info',
        patterns: [
          /(?:learning plan\s+info|lp\s+info|learning plan\s+details|lp\s+details)\s+(.+)/i,
          /(?:info|details|information)\s+(?:for\s+|about\s+)?(?:learning plan|lp)\s+(.+)/i,
          /(?:describe|tell me about)\s+(?:learning plan|lp)\s+(.+)/i
        ],
        extractEntities: () => {
          const lpInfoMatch = message.match(/(?:learning plan\s+info|lp\s+info|learning plan\s+details|lp\s+details)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                             message.match(/(?:info|details|information)\s+(?:for\s+|about\s+)?(?:learning plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                             message.match(/(?:describe|tell me about)\s+(?:learning plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          return {
            learningPlanId: /^\d+$/.test(lpInfoMatch?.[1]?.trim() || '') ? lpInfoMatch?.[1]?.trim() : null,
            learningPlanName: lpInfoMatch ? lpInfoMatch[1].trim() : learningPlanName
          };
        },
        confidence: 0.9
      },

      // CREATE ILT SESSION patterns
      {
        intent: 'create_ilt_session',
        patterns: [
          /(?:create|schedule|add|setup)\s+(?:ilt|classroom)?\s*session\s+(?:for\s+)?(?:course\s+)?(.+)/i,
          /(?:create|schedule|add|setup)\s+(?:ilt|classroom|training)\s+(?:for\s+)?(?:course\s+)?(.+)/i,
          /(?:new|make)\s+(?:ilt|classroom)?\s*session\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🎓 ILT CREATE: Analyzing message: "${message}"`);
          
          // Extract course information
          const courseIdMatch = message.match(/(?:course\s+)(\d+)/i);
          const courseNameMatch = message.match(/(?:course\s+|for\s+)(?:course\s+)?['""]?([^'""\n\r]+?)['""]?(?:\s+on|\s+from|\s+at|\s*$)/i);
          
          // Extract session name
          const sessionNameMatch = message.match(/(?:session\s+)['""]([^'""\n\r]+)['""]|(?:session\s+)([A-Za-z][^,\n\r]*?)(?:\s+for|\s+on|\s*$)/i);
          
          // Extract dates and times
          const startDateMatch = message.match(/(?:on|from|start(?:ing)?(?:\s+on)?)\s+(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?)/i);
          const endDateMatch = message.match(/(?:to|until|end(?:ing)?(?:\s+on)?)\s+(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?)/i);
          const startTimeMatch = message.match(/(?:from|at)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)/i);
          const endTimeMatch = message.match(/(?:to|until)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)/i);
          
          // Extract other details
          const locationMatch = message.match(/(?:at|in|location)\s+([^,\n\r]+?)(?:\s+with|\s+for|\s*$)/i);
          const instructorMatch = message.match(/(?:instructor|teacher|trainer)\s+([^\s@]+@[^\s@]+\.[^\s@]+)/i);
          const maxParticipantsMatch = message.match(/(?:max|maximum|up\s+to)\s+(\d+)\s+(?:participants|people|users|students)/i);
          
          const entities = {
            courseId: courseIdMatch ? courseIdMatch[1] : null,
            courseName: courseNameMatch ? courseNameMatch[1].trim() : null,
            sessionName: sessionNameMatch ? (sessionNameMatch[1] || sessionNameMatch[2])?.trim() : null,
            startDate: startDateMatch ? this.parseDate(startDateMatch[1]) : null,
            endDate: endDateMatch ? this.parseDate(endDateMatch[1]) : null,
            startTime: startTimeMatch ? this.parseTime(startTimeMatch[1]) : null,
            endTime: endTimeMatch ? this.parseTime(endTimeMatch[1]) : null,
            location: locationMatch ? locationMatch[1].trim() : null,
            instructorEmail: instructorMatch ? instructorMatch[1] : null,
            maxParticipants: maxParticipantsMatch ? parseInt(maxParticipantsMatch[1]) : null,
            timezone: this.extractTimezone(message)
          };
          
          console.log(`🎓 ILT CREATE: Extracted entities:`, entities);
          return entities;
        },
        confidence: 0.95
      },

      // ENROLL IN ILT SESSION patterns
      {
        intent: 'enroll_user_in_ilt_session',
        patterns: [
          /(?:enroll|add|register)\s+(.+?)\s+(?:in|to|for)\s+(?:ilt|classroom)?\s*session\s+(.+)/i,
          /(?:enroll|add|register)\s+(.+?)\s+(?:in|to|for)\s+session\s+(.+)/i,
          /(?:session enrollment|session assign)\s+(.+?)\s+(?:to|in)\s+(.+)/i
        ],
        extractEntities: () => {
          console.log(`🎓 ILT ENROLL: Analyzing message: "${message}"`);
          
          const enrollMatch = message.match(/(?:enroll|add|register)\s+(.+?)\s+(?:in|to|for)\s+(?:ilt|classroom)?\s*session\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (enrollMatch) {
            const userPart = enrollMatch[1].trim();
            let sessionPart = enrollMatch[2].trim();
            
            // Clean up session identifier
            sessionPart = sessionPart.replace(/[\.!?]+$/, '');
            
            // Check if it's a bulk operation (multiple emails)
            const allEmails = this.extractMultipleEmails(message);
            
            const entities: any = {
              email: this.extractEmailFromText(userPart) || userPart,
              emails: allEmails.length > 1 ? allEmails : null,
              sessionId: /^\d+$/.test(sessionPart) ? sessionPart : null,
              sessionName: !/^\d+$/.test(sessionPart) ? sessionPart : null,
              resourceType: 'ilt_session',
              action: 'enroll'
            };
            
            // Extract course info if provided
            const courseMatch = message.match(/(?:for\s+course|in\s+course)\s+(\d+|[^,\n\r]+)/i);
            if (courseMatch) {
              if (/^\d+$/.test(courseMatch[1])) {
                entities.courseId = courseMatch[1];
              } else {
                entities.courseName = courseMatch[1].trim();
              }
            }
            
            console.log(`🎓 ILT ENROLL: Extracted entities:`, entities);
            return entities;
          }
          
          return {
            email: this.extractEmail(message),
            sessionId: this.extractSessionId(message),
            sessionName: this.extractSessionName(message),
            resourceType: 'ilt_session',
            action: 'enroll'
          };
        },
        confidence: 0.92
      },

      // BULK ENROLL IN ILT SESSION patterns
      {
        intent: 'bulk_enroll_ilt_session',
        patterns: [
          /(?:enroll|add|register)\s+(.+?)\s+(?:in|to|for)\s+(?:ilt|classroom)?\s*session\s+(.+)/i,
          /(?:bulk|mass)\s+(?:enroll|add)\s+(.+?)\s+(?:to|in)\s+session\s+(.+)/i
        ],
        extractEntities: () => {
          const allEmails = this.extractMultipleEmails(message);
          
          if (allEmails.length <= 1) return null; // Not bulk
          
          console.log(`🎓 ILT BULK: Analyzing bulk enrollment: ${allEmails.length} emails`);
          
          const sessionMatch = message.match(/(?:session\s+)(\d+|[^,\n\r]+?)(?:\s*$|\?|!|\.)/i);
          
          return {
            emails: allEmails,
            sessionId: sessionMatch && /^\d+$/.test(sessionMatch[1]) ? sessionMatch[1] : null,
            sessionName: sessionMatch && !/^\d+$/.test(sessionMatch[1]) ? sessionMatch[1].trim() : null,
            resourceType: 'ilt_session',
            action: 'bulk_enroll',
            isBulk: true
          };
        },
        confidence: this.extractMultipleEmails(message).length > 1 ? 0.95 : 0
      },

      // UNENROLL FROM ILT SESSION patterns
      {
        intent: 'unenroll_user_from_ilt_session',
        patterns: [
          /(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:ilt|classroom)?\s*session\s+(.+)/i,
          /(?:remove|drop)\s+(.+?)\s+(?:from|out of)\s+session\s+(.+)/i
        ],
        extractEntities: () => {
          const unenrollMatch = message.match(/(?:unenroll|remove|drop)\s+(.+?)\s+(?:from|out of)\s+(?:ilt|classroom)?\s*session\s+(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (unenrollMatch) {
            const userPart = unenrollMatch[1].trim();
            let sessionPart = unenrollMatch[2].trim();
            
            sessionPart = sessionPart.replace(/[\.!?]+$/, '');
            
            return {
              email: this.extractEmailFromText(userPart) || userPart,
              sessionId: /^\d+$/.test(sessionPart) ? sessionPart : null,
              sessionName: !/^\d+$/.test(sessionPart) ? sessionPart : null,
              resourceType: 'ilt_session',
              action: 'unenroll'
            };
          }
          
          return {
            email: this.extractEmail(message),
            sessionId: this.extractSessionId(message),
            sessionName: this.extractSessionName(message),
            resourceType: 'ilt_session',
            action: 'unenroll'
          };
        },
        confidence: 0.95
      },

      // MARK ATTENDANCE patterns
      {
        intent: 'mark_session_attendance',
        patterns: [
          /(?:mark|set)\s+(.+?)\s+as\s+(attended|completed|absent|no-show)\s+(?:in|for)\s+session\s+(.+)/i,
          /(?:mark|set)\s+attendance\s+(?:for\s+)?(.+?)\s+(?:in|for)\s+session\s+(.+)/i,
          /(?:attended|completed|absent)\s+(.+?)\s+(?:in|for)\s+session\s+(.+)/i,
          /(?:mark|record)\s+(.+?)\s+(?:attended|completed|absent)\s+(?:session\s+)?(.+)/i
        ],
        extractEntities: () => {
          console.log(`📋 ATTENDANCE: Analyzing message: "${message}"`);
          
          // Extract attendance status
          const attendanceStatus = message.match(/\b(attended|completed|absent|no-show)\b/i)?.[1]?.toLowerCase() || 'attended';
          const completionStatus = attendanceStatus === 'completed' ? 'completed' : 
                                 attendanceStatus === 'attended' ? 'completed' : 'not_completed';
          
          // Extract users and session
          const markMatch = message.match(/(?:mark|set)\s+(.+?)\s+as\s+(?:attended|completed|absent|no-show)\s+(?:in|for)\s+session\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                           message.match(/(?:mark|set)\s+attendance\s+(?:for\s+)?(.+?)\s+(?:in|for)\s+session\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                           message.match(/(?:attended|completed|absent)\s+(.+?)\s+(?:in|for)\s+session\s+(.+?)(?:\s*$|\?|!|\.)/i) ||
                           message.match(/(?:mark|record)\s+(.+?)\s+(?:attended|completed|absent)\s+(?:session\s+)?(.+?)(?:\s*$|\?|!|\.)/i);
          
          if (markMatch) {
            const userPart = markMatch[1].trim();
            let sessionPart = markMatch[2].trim();
            
            sessionPart = sessionPart.replace(/[\.!?]+$/, '');
            
            // Check for multiple users
            const allEmails = this.extractMultipleEmails(userPart);
            
            return {
              email: allEmails.length === 1 ? allEmails[0] : this.extractEmailFromText(userPart),
              emails: allEmails.length > 1 ? allEmails : null,
              sessionId: /^\d+$/.test(sessionPart) ? sessionPart : null,
              sessionName: !/^\d+$/.test(sessionPart) ? sessionPart : null,
              attendanceStatus: attendanceStatus,
              completionStatus: completionStatus,
              resourceType: 'ilt_session',
              action: 'mark_attendance'
            };
          }
          
          return {
            email: this.extractEmail(message),
            emails: this.extractMultipleEmails(message),
            sessionId: this.extractSessionId(message),
            sessionName: this.extractSessionName(message),
            attendanceStatus: attendanceStatus,
            completionStatus: completionStatus,
            resourceType: 'ilt_session',
            action: 'mark_attendance'
          };
        },
        confidence: 0.96
      },

      // HELP patterns
      {
        intent: 'docebo_help',
        patterns: [
          /(?:help|assistance|support|guide)/i,
          /(?:how to|what is|explain)/i,
          /(?:docebo help|help with docebo)/i
        ],
        extractEntities: () => {
          return {
            query: message
          };
        },
        confidence: 0.6
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

  // FIXED: Enhanced course name extraction specifically for unenroll commands
  static extractCourseNameForUnenroll(message: string): string | null {
    console.log(`🔍 UNENROLL COURSE NAME: Extracting from: "${message}"`);
    
    const patterns = [
      // Unenroll specific patterns
      /(?:unenroll|remove|drop)\s+.+?\s+(?:from|out of)\s+(?:course|training)\s+(.+?)(?:\s*$|\?|!|\.)/i,
      /(?:from|out of)\s+(?:course|training)\s+(.+?)(?:\s*$|\?|!|\.)/i,
      
      // Quoted content - highest priority
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
      /'([^']+)'/,
      
      // Course ID patterns
      /(?:course|training)\s+(\d+)(?:\s|$|\?|!|\.)/i,
      
      // Generic course extraction
      /(?:course|training)\s+(.+?)(?:\s*$|\?|!|\.(?:\s|$))/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 0) {
        let name = match[1].trim();
        
        console.log(`🎯 UNENROLL COURSE NAME: Pattern matched: ${pattern.source} -> "${name}"`);
        
        // Clean up common suffixes for unenroll commands
        name = name.replace(/\s+(please|now|immediately|today|asap)$/i, '');
        name = name.replace(/[\.!?]+$/, '');
        
        if (name.length > 0) {
          console.log(`✅ UNENROLL COURSE NAME: Final extracted: "${name}"`);
          return name;
        }
      }
    }
    
    console.log(`❌ UNENROLL COURSE NAME: Could not extract course name from: "${message}"`);
    return null;
  }

  // Enhanced general course name extraction
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

  // Helper methods
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

  static extractTimezone(message: string): string | null {
    const timezoneMatch = message.match(/\b(UTC|GMT|EST|CST|MST|PST|EDT|CDT|MDT|PDT)\b/i);
    return timezoneMatch ? timezoneMatch[1].toUpperCase() : null;
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

  static extractOffset(message: string): number | null {
    const offsetMatch = message.match(/(?:offset|from|starting at)\s+(\d+)/i);
    return offsetMatch ? parseInt(offsetMatch[1]) : null;
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

  // ========================= HELPER METHODS FOR ILT =========================
  static extractSessionId(message: string): string | null {
    const patterns = [
      /(?:session\s+)(\d+)(?:\s|$)/i,
      /(?:session\s+id\s+)(\d+)/i,
      /(?:ilt\s+session\s+)(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  static extractSessionName(message: string): string | null {
    const patterns = [
      /(?:session\s+)['""]([^'""\n\r]+)['"\"]/i,
      /(?:session\s+)([A-Za-z][^,\n\r]*?)(?:\s+on|\s+at|\s+for|\s*$)/i,
      /(?:in\s+session\s+)['""]([^'""\n\r]+)['"\"]/i,
      /(?:in\s+session\s+)([A-Za-z][^,\n\r]*?)(?:\s*$|\?|!|\.)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 0) {
        let name = match[1].trim();
        
        // Don't return if it's just a number (likely an ID)
        if (!/^\d+$/.test(name)) {
          return name;
        }
      }
    }
    return null;
  }

  static parseDate(dateStr: string): string | null {
    try {
      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // Handle natural language dates
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
    } catch (error) {
      console.log('Date parsing failed:', error);
    }
    return null;
  }

  static parseTime(timeStr: string): string | null {
    try {
      // Convert various time formats to HH:MM:SS
      let time = timeStr.toLowerCase().trim();
      
      // Handle AM/PM
      const isPM = time.includes('pm');
      const isAM = time.includes('am');
      time = time.replace(/\s*(am|pm)/i, '');
      
      // Split time parts
      const parts = time.split(':');
      let hours = parseInt(parts[0]);
      let minutes = parseInt(parts[1] || '0');
      let seconds = parseInt(parts[2] || '0');
      
      // Convert 12-hour to 24-hour
      if (isPM && hours !== 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      
      // Format as HH:MM:SS
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
    } catch (error) {
      console.log('Time parsing failed:', error);
    }
    return null;
  }
  
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      /(?:learning\s+plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private static validateEntities(entities: any, intent: string): boolean {
    switch (intent) {
      case 'unenroll_user_from_course':
        return !!(entities.email && entities.courseName);
      case 'unenroll_user_from_learning_plan':
        return !!(entities.email && entities.learningPlanName);
      case 'enroll_user_in_course':
        return !!(entities.email && entities.courseName);
      case 'enroll_user_in_learning_plan':
        return !!(entities.email && entities.learningPlanName);
      case 'search_courses':
        return !!entities.searchTerm;
      case 'search_users':
        return !!(entities.email || entities.searchTerm || entities.userId);
      case 'bulk_enroll_course':
        return !!(entities.emails && entities.emails.length > 1 && entities.courseName);
      case 'bulk_enroll_learning_plan':
        return !!(entities.emails && entities.emails.length > 1 && entities.learningPlanName);
      case 'bulk_unenroll':
        return !!(entities.emails && entities.emails.length > 1 && entities.resourceName);
      case 'load_more_enrollments':
        return !!entities.email;
      case 'create_ilt_session':
        return !!(entities.courseId || entities.courseName);
      case 'enroll_user_in_ilt_session':
        return !!(entities.email && (entities.sessionId || entities.sessionName));
      case 'bulk_enroll_ilt_session':
        return !!(entities.emails && entities.emails.length > 1 && (entities.sessionId || entities.sessionName));
      case 'mark_session_attendance':
        return !!((entities.email || entities.emails) && (entities.sessionId || entities.sessionName));
      default:
        return true;
    }
  }
}
