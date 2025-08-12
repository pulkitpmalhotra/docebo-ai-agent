// lib/gemini-ai.ts - Fixed AI processing for Phase 1 MVP
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config/environment';
import { z } from 'zod';

// Initialize Gemini AI with error handling
let genAI: GoogleGenerativeAI;
try {
  genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  console.log('✅ Gemini AI initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error);
  throw new Error('Gemini AI initialization failed');
}

// Action schema for type safety
const ActionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('search_users'),
    entities: z.object({
      query: z.string(),
      limit: z.number().optional(),
      department: z.string().optional(),
    }),
  }),
  z.object({
    intent: z.literal('search_courses'),
    entities: z.object({
      query: z.string(),
      limit: z.number().optional(),
      category: z.string().optional(),
    }),
  }),
  z.object({
    intent: z.literal('get_user_enrollments'),
    entities: z.object({
      user_email: z.string(),
    }),
  }),
  z.object({
    intent: z.literal('enroll_user'),
    entities: z.object({
      user_email: z.string(),
      course_name: z.string(),
      level: z.string().optional(),
      assignment_type: z.string().optional(),
      due_date: z.string().optional(),
    }),
    requires_approval: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal('get_course_enrollments'),
    entities: z.object({
      course_name: z.string(),
    }),
  }),
  z.object({
    intent: z.literal('get_help'),
    entities: z.object({
      topic: z.string(),
    }),
  }),
  z.object({
    intent: z.literal('get_stats'),
    entities: z.object({
      type: z.enum(['overview', 'course', 'user', 'enrollment']),
      timeframe: z.string().optional(),
    }),
  }),
]);

export type AIAction = z.infer<typeof ActionSchema>;

// Main query processing function
export async function processUserQuery(query: string): Promise<AIAction> {
  console.log('🧠 Processing query:', query);
  
  // Use improved fallback first (faster and more reliable for MVP)
  const fallbackResult = getImprovedFallback(query);
  console.log('📋 Fallback result:', fallbackResult);
  
  // Try AI processing if fallback seems uncertain
  if (fallbackResult.intent === 'get_help' && !query.toLowerCase().includes('help')) {
    try {
      const aiResult = await processWithAI(query);
      console.log('🤖 AI result:', aiResult);
      return aiResult;
    } catch (error) {
      console.warn('⚠️ AI processing failed, using fallback:', error);
      return fallbackResult;
    }
  }
  
  return fallbackResult;
}

// AI-powered processing (backup for complex queries)
async function processWithAI(query: string): Promise<AIAction> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.1,
      maxOutputTokens: 300,
    },
  });

  const prompt = `Extract intent and entities from this Docebo LMS query. Respond ONLY with valid JSON.

Query: "${query}"

Available intents:
- "search_users": Find users by name/email
- "search_courses": Find courses by name/type  
- "get_user_enrollments": Get what courses a user is enrolled in
- "get_course_enrollments": Get who is enrolled in a course
- "enroll_user": Enroll a user in a course
- "get_help": General help or unclear requests
- "get_stats": Statistics and reports

Examples:
"Find users named John" → {"intent":"search_users","entities":{"query":"John"}}
"Show me Python courses" → {"intent":"search_courses","entities":{"query":"Python"}}
"What courses is john@company.com enrolled in?" → {"intent":"get_user_enrollments","entities":{"user_email":"john@company.com"}}
"Enroll sarah@test.com in Excel course" → {"intent":"enroll_user","entities":{"user_email":"sarah@test.com","course_name":"Excel"}}
"Who is enrolled in Leadership Training?" → {"intent":"get_course_enrollments","entities":{"course_name":"Leadership Training"}}

JSON Response:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log('🤖 Gemini raw response:', text);
    
    // Extract JSON from response
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').replace(/```\n?|\n?```/g, '').trim();
    
    // Find the JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    console.log('📝 Extracted JSON:', jsonStr);
    
    const parsed = JSON.parse(jsonStr);
    const validated = ActionSchema.parse(parsed);
    
    console.log('✅ AI processed successfully:', validated);
    return validated;
    
  } catch (error) {
    console.error('❌ AI processing failed:', error);
    throw error;
  }
}

// Improved pattern-based fallback (primary method for MVP)
function getImprovedFallback(query: string): AIAction {
  const queryLower = query.toLowerCase().trim();
  console.log('🔍 Processing fallback for:', queryLower);
  
  // Extract email if present
  const emailMatch = query.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  
  // 1. ENROLLMENT PATTERNS
  if (emailMatch && queryLower.includes('enroll') && !queryLower.includes('unenroll')) {
    // Extract course name for enrollment
    const coursePatterns = [
      /\b(?:in|into|to)\s+(.+?)(?:\s+(?:as|due|level|with)|$)/i,
      /\benroll.*?(?:in|to)\s+(.+?)(?:\s+(?:as|due|level|with)|$)/i,
      /\badd.*?(?:to|in)\s+(.+?)(?:\s+(?:as|due|level|with)|$)/i,
      /"([^"]+)"/,
      /'([^']+)'/
    ];
    
    let courseName = '';
    for (const pattern of coursePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        courseName = match[1].trim();
        // Clean up common words
        courseName = courseName.replace(/\b(course|training|class|program)\b/gi, '').trim();
        break;
      }
    }
    
    // Extract optional parameters
    const levelMatch = query.match(/level\s+(\d+)/i);
    const assignmentMatch = query.match(/\bas\s+(mandatory|required|recommended|optional)/i);
    const dueDateMatch = query.match(/due\s+(\d{4}-\d{2}-\d{2})/i);
    
    return {
      intent: 'enroll_user',
      entities: {
        user_email: emailMatch[0],
        course_name: courseName || 'course',
        level: levelMatch?.[1],
        assignment_type: assignmentMatch?.[1]?.toLowerCase(),
        due_date: dueDateMatch?.[1]
      },
      requires_approval: false
    };
  }
  
  // 2. USER ENROLLMENT STATUS PATTERNS
  if (emailMatch && (queryLower.includes('enrolled') || queryLower.includes('course'))) {
    return {
      intent: 'get_user_enrollments',
      entities: {
        user_email: emailMatch[0]
      }
    };
  }
  
  // 3. COURSE ENROLLMENT STATUS PATTERNS
  if ((queryLower.includes('who is enrolled') || queryLower.includes('who enrolled')) && 
      queryLower.includes('in')) {
    
    const coursePatterns = [
      /who\s+(?:is\s+)?enrolled\s+in\s+(.+?)(?:\?|$)/i,
      /enrolled\s+in\s+(.+?)(?:\?|$)/i,
      /"([^"]+)"/,
      /'([^']+)'/
    ];
    
    let courseName = '';
    for (const pattern of coursePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        courseName = match[1].trim();
        break;
      }
    }
    
    return {
      intent: 'get_course_enrollments',
      entities: {
        course_name: courseName || 'course'
      }
    };
  }
  
  // 4. USER SEARCH PATTERNS
  if (queryLower.includes('find') && queryLower.includes('user')) {
    let searchTerm = query
      .replace(/find/gi, '')
      .replace(/users?/gi, '')
      .replace(/named/gi, '')
      .replace(/called/gi, '')
      .trim();
    
    // If email found, use that
    if (emailMatch) {
      searchTerm = emailMatch[0];
    } else {
      // Clean up extra spaces
      searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
    }
    
    if (!searchTerm) searchTerm = 'all';
    
    console.log('👥 User search term extracted:', searchTerm);
    
    return {
      intent: 'search_users',
      entities: { query: searchTerm }
    };
  }
  
  // 5. COURSE SEARCH PATTERNS
  if (queryLower.includes('course') || queryLower.includes('training') || 
      queryLower.includes('show me') || queryLower.includes('find') ||
      queryLower.includes('python') || queryLower.includes('javascript') || 
      queryLower.includes('excel') || queryLower.includes('sql')) {
    
    let searchTerm = query
      .replace(/show\s+me/gi, '')
      .replace(/courses?/gi, '')
      .replace(/training/gi, '')
      .replace(/find/gi, '')
      .replace(/search/gi, '')
      .trim();
    
    // Clean up extra spaces
    searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
    
    if (!searchTerm) {
      // Look for specific course keywords
      const courseKeywords = ['python', 'javascript', 'excel', 'sql', 'leadership'];
      const foundKeyword = courseKeywords.find(keyword => queryLower.includes(keyword));
      searchTerm = foundKeyword || 'all';
    }
    
    console.log('📚 Course search term extracted:', searchTerm);
    
    return {
      intent: 'search_courses',
      entities: { query: searchTerm }
    };
  }
  
  // 6. STATISTICS PATTERNS
  if (queryLower.includes('statistic') || queryLower.includes('stats') || 
      queryLower.includes('overview') || queryLower.includes('report') ||
      queryLower.includes('analytics') || queryLower.includes('dashboard')) {
    
    let type: 'overview' | 'enrollment' | 'course' | 'user' = 'overview';
    
    if (queryLower.includes('enrollment')) type = 'enrollment';
    else if (queryLower.includes('course') && !queryLower.includes('show me')) type = 'course';
    else if (queryLower.includes('user') && !queryLower.includes('find')) type = 'user';
    
    console.log('📊 Statistics search detected, type:', type);
    
    return {
      intent: 'get_stats',
      entities: { type }
    };
  }
  
  // 7. HELP PATTERNS
  if (queryLower.includes('help') || queryLower.includes('how') || 
      queryLower.includes('what is') || queryLower.includes('explain')) {
    return {
      intent: 'get_help',
      entities: { topic: query }
    };
  }
  
  // 8. SMART COURSE DETECTION
  const courseKeywords = ['python', 'javascript', 'excel', 'sales', 'marketing', 'leadership', 'sql'];
  const hasKeyword = courseKeywords.some(keyword => queryLower.includes(keyword));
  
  if (hasKeyword) {
    const foundKeyword = courseKeywords.find(keyword => queryLower.includes(keyword));
    return {
      intent: 'search_courses',
      entities: { query: foundKeyword || query.trim() }
    };
  }
  
  // 9. FINAL FALLBACK
  console.log('❓ No specific pattern matched, returning help');
  return {
    intent: 'get_help',
    entities: { topic: query }
  };
}

// Generate help responses
export async function generateHelpResponse(topic: string): Promise<string> {
  if (!config.app.isDevelopment) {
    // In production, use static help response for reliability
    return generateStaticHelpResponse(topic);
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 400,
      }
    });

    const prompt = `Provide helpful information about Docebo LMS topic: "${topic}"

Keep response under 300 words, be practical and actionable. Focus on Phase 1 MVP features:
- User enrollment management
- Course search
- Enrollment status checking

Use friendly tone with emojis. Include specific examples.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error('❌ Help response generation failed:', error);
    return generateStaticHelpResponse(topic);
  }
}

// Static help response fallback
function generateStaticHelpResponse(topic: string): string {
  return `🎯 **Docebo Assistant Help** - Phase 1 MVP

I can help you with these key tasks:

**👥 User Management**
- Find users: "Find user john@company.com"
- Check enrollments: "What courses is sarah@test.com enrolled in?"

**📚 Course Management**  
- Search courses: "Find Python courses"
- Check who's enrolled: "Who is enrolled in Excel Training?"

**🎓 Enrollment Management**
- Enroll users: "Enroll john@company.com in Python Programming"
- Advanced enrollment: "Add sarah@test.com to Excel course as mandatory due 2025-12-31"

**💡 Tips**
- Use specific email addresses for best results
- Try exact or partial course names
- Natural language works: "Enroll John in SQL training"

**Your question**: "${topic}"

For specific guidance, try asking more detailed questions about what you'd like to accomplish!`;
}

// Utility function to validate AI responses
export function validateAIResponse(response: any): boolean {
  try {
    ActionSchema.parse(response);
    return true;
  } catch {
    return false;
  }
}

// Test function for development
export async function testAIConnection(): Promise<boolean> {
  try {
    const testQuery = "Find user test@example.com";
    const result = await processUserQuery(testQuery);
    return result.intent === 'search_users';
  } catch (error) {
    console.error('❌ AI connection test failed:', error);
    return false;
  }
}
