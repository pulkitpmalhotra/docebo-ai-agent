import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

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
      user_email: z.string().email(),
    }),
  }),
  z.object({
    intent: z.literal('enroll_user'),
    entities: z.object({
      user_email: z.string().email(),
      course_name: z.string(),
    }),
    requires_approval: z.literal(true),
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

type AIAction = z.infer<typeof ActionSchema>;

export async function processUserQuery(query: string): Promise<AIAction> {
  console.log('Processing query:', query);
  
  // Use improved simple pattern matching first
  const simpleResult = getImprovedFallback(query);
  console.log('Simple fallback result:', simpleResult);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.0,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 200,
      },
    });

    const prompt = `Extract intent and entities from this user query. Respond ONLY with valid JSON.

Query: "${query}"

Examples:
"Find users named John" → {"intent":"search_users","entities":{"query":"John"}}
"Show me Python courses" → {"intent":"search_courses","entities":{"query":"Python"}}
"enrollment statistics" → {"intent":"get_stats","entities":{"type":"enrollment"}}

JSON:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log('Gemini raw response:', text);
    
    // Extract JSON from response
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').replace(/```\n?|\n?```/g, '').trim();
    
    // Find the JSON object
    const jsonMatch = jsonStr.match(/\{[^}]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    console.log('Extracted JSON:', jsonStr);
    
    const parsed = JSON.parse(jsonStr);
    const validated = ActionSchema.parse(parsed);
    
    console.log('Gemini processed successfully:', validated);
    return validated;
    
  } catch (error) {
    console.error('Gemini failed, using simple fallback:', error);
    return simpleResult;
  }
}

function getImprovedFallback(query: string): AIAction {
  const queryLower = query.toLowerCase().trim();
  console.log('Processing fallback for:', queryLower);
  
  // Extract email if present
  const emailMatch = query.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  
  if (emailMatch) {
    if (queryLower.includes('enroll')) {
      // Extract course name
      const coursePatterns = [
        /\b(?:in|into)\s+(.+?)(?:\s|$)/i,
        /\benroll.*?in\s+(.+?)(?:\s|$)/i,
        /\b(?:course|training)[\s:]+(.+?)(?:\s|$)/i
      ];
      
      let courseName = 'course';
      for (const pattern of coursePatterns) {
        const match = query.match(pattern);
        if (match && match[1]) {
          courseName = match[1].trim();
          break;
        }
      }
      
      return {
        intent: 'enroll_user',
        entities: {
          user_email: emailMatch[0],
          course_name: courseName
        },
        requires_approval: true
      };
    }
    
    if (queryLower.includes('enrollment') || queryLower.includes('course')) {
      return {
        intent: 'get_user_enrollments',
        entities: {
          user_email: emailMatch[0]
        }
      };
    }
  }
  
  // User search patterns
  if (queryLower.includes('find') && queryLower.includes('user')) {
    let searchTerm = query
      .replace(/find/gi, '')
      .replace(/users?/gi, '')
      .replace(/named/gi, '')
      .replace(/called/gi, '')
      .trim();
    
    // Clean up extra spaces
    searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
    
    if (!searchTerm) searchTerm = 'all';
    
    console.log('User search term extracted:', searchTerm);
    
    return {
      intent: 'search_users',
      entities: { query: searchTerm }
    };
  }
  
  // Course search patterns
  if (queryLower.includes('course') || queryLower.includes('training') || 
      queryLower.includes('show me') || queryLower.includes('python') ||
      queryLower.includes('javascript') || queryLower.includes('excel')) {
    
    let searchTerm = query
      .replace(/show\s+me/gi, '')
      .replace(/courses?/gi, '')
      .replace(/training/gi, '')
      .replace(/find/gi, '')
      .trim();
    
    // Clean up extra spaces
    searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
    
    if (!searchTerm) searchTerm = 'all';
    
    console.log('Course search term extracted:', searchTerm);
    
    return {
      intent: 'search_courses',
      entities: { query: searchTerm }
    };
  }
  
  // Statistics patterns
 if (queryLower.includes('statistic') || queryLower.includes('stats') || 
      (queryLower.includes('enrollment') && (queryLower.includes('show') || queryLower.includes('statistic'))) ||
      queryLower.includes('overview') || queryLower.includes('report') ||
      queryLower.includes('analytics') || queryLower.includes('dashboard')) {
    
    let type: 'overview' | 'enrollment' | 'course' | 'user' = 'overview';
    
    if (queryLower.includes('enrollment')) type = 'enrollment';
    else if (queryLower.includes('course') && !queryLower.includes('show me')) type = 'course';
    else if (queryLower.includes('user') && !queryLower.includes('find')) type = 'user';
    
    console.log('Statistics search detected, type:', type);
    
    return {
      intent: 'get_stats',
      entities: { type }
    };
  }
  
  // Help patterns
  if (queryLower.includes('help') || queryLower.includes('how') || 
      queryLower.includes('what is') || queryLower.includes('explain')) {
    return {
      intent: 'get_help',
      entities: { topic: query }
    };
  }
  
  // Default: treat as course search if it contains recognizable course terms
  const courseKeywords = ['python', 'javascript', 'excel', 'sales', 'marketing', 'leadership'];
  const hasKeyword = courseKeywords.some(keyword => queryLower.includes(keyword));
  
  if (hasKeyword) {
    return {
      intent: 'search_courses',
      entities: { query: query.trim() }
    };
  }
  
  // Final fallback
  return {
    intent: 'get_help',
    entities: { topic: query }
  };
}

export async function generateHelpResponse(topic: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Provide helpful information about Docebo LMS topic: ${topic}

Keep response under 400 words, be practical and actionable.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Help response error:', error);
    return `I'd be happy to help with "${topic}". Here are some general tips:

- **User Management**: Find and manage user accounts, enrollments, and progress
- **Course Management**: Create, organize, and monitor training content  
- **Reporting**: Track completion rates, user activity, and learning outcomes
- **Administration**: Configure settings, permissions, and integrations

For specific guidance, try asking more detailed questions about what you'd like to accomplish.`;
  }
}
