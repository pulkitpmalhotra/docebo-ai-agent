// app/api/chat/intent-analyzer.ts - FIXED Load More Intent Detection
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
          /load more\s+(.+)/i  // ADDED: More flexible pattern
        ],
        extractEntities: () => {
          // IMPROVED: Better pattern matching for load more commands
          const loadMorePatterns = [
            /load more enrollments for\s+(.+?)(?:\s*$)/i,
            /show more enrollments for\s+(.+?)(?:\s*$)/i,
            /more enrollments for\s+(.+?)(?:\s*$)/i,
            /continue enrollments for\s+(.+?)(?:\s*$)/i,
            /load more for\s+(.+?)(?:\s*$)/i,
            /get more enrollments\s+(.+?)(?:\s*$)/i,
            /load more\s+(.+?)(?:\s*$)/i  // ADDED: More flexible
          ];
          
          let userIdentifier = '';
          
          // Try each pattern to extract user identifier
          for (const pattern of loadMorePatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
              userIdentifier = match[1].trim();
              console.log(`🔄 LOAD MORE: Pattern matched: "${pattern.source}" -> "${userIdentifier}"`);
              break;
            }
          }
          
          // Fallback to extracted email if no pattern matched
          if (!userIdentifier) {
            userIdentifier = email || userId || '';
            console.log(`🔄 LOAD MORE: Using fallback identifier: "${userIdentifier}"`);
          }
          
          console.log(`🔄 LOAD MORE: Final extracted user identifier: "${userIdentifier}"`);
          
          return {
            email: userIdentifier ? this.extractEmailFromText(userIdentifier) || userIdentifier : null,
            userId: userIdentifier,
            loadMore: true,
            offset: '20' // Default offset for load more
          };
        },
        confidence: 0.99 // HIGHEST confidence
      },

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

      // FIXED: User enrollments (regular paginated) - LOWERED PRIORITY
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
        confidence: email || userId ? 0.85 : 0.75  // LOWERED to avoid conflicts
      },

      // Rest of the patterns remain the same...
      // (Include all other patterns from the original file)
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
      if (bestMatch.confidence > 0.98) { // High confidence cutoff
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
  
  // Rest of the extraction methods remain the same...
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
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      /(?:tell me about course\s+|info about course\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      /(?:in|to|for)\s+(?:course|training)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      /(?:course|training)\s+(?:named|called)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
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
  
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      /(?:learning plan info\s+|lp info\s+|plan info\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      /(?:tell me about learning plan\s+|info about learning plan\s+)(.+?)(?:\s*$|\s+id|\s+\d+)/i,
      /(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      /(?:learning plan|lp)\s+(?:named|called)\s+(.+?)(?:\s*$|\s+with|\s+as)/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/,
      /(?:learning plan|lp)\s+(.+?)(?:\s*$|\?|!|\.)/i,
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
