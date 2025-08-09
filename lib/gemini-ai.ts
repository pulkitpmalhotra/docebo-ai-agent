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
  // First try to process with simple pattern matching as fallback
  const fallbackAction = getSimpleFallback(query);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.0,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 500,
      },
    });

    const prompt = `You are a JSON converter for Docebo LMS commands. Convert the user query to JSON ONLY.

Available intents: search_users, search_courses, get_user_enrollments, enroll_user, get_help, get_stats

Examples:
Input: "Find users named John"
Output: {"intent": "search_users", "entities": {"query": "John"}}

Input: "Show me Python courses"  
Output: {"intent": "search_courses", "entities": {"query": "Python"}}

Input: "What are jane@company.com's enrollments?"
Output: {"intent": "get_user_enrollments", "entities": {"user_email": "jane@company.com"}}

Input: "Enroll sarah@company.com in Excel training"
Output: {"intent": "enroll_user", "entities": {"user_email": "sarah@company.com", "course_name": "Excel training"}, "requires_approval": true}

Convert this query to JSON: "${query}"

JSON:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log('Raw Gemini response:', JSON.stringify(text));
    
    // Clean and extract JSON
    let jsonStr = text;
    
    // Remove markdown formatting
    jsonStr = jsonStr.replace(/```json\n?|\n?```/g, '');
    jsonStr = jsonStr.replace(/```\n?|\n?```/g, '');
    
    // Find JSON object in the response
    const jsonMatch = jsonStr.match(/\{[^}]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    console.log('Cleaned JSON string:', JSON.stringify(jsonStr));
    
    const parsed = JSON.parse(jsonStr);
    console.log('Parsed object:', parsed);
    
    return ActionSchema.parse(parsed);
    
  } catch (error) {
    console.error('Gemini processing failed, using fallback:', error);
    return fallbackAction;
  }
}

function getSimpleFallback(query: string): AIAction {
  const queryLower = query.toLowerCase();
  
  // Extract email if present
  const emailMatch = query.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  
  if (emailMatch && queryLower.includes('enroll')) {
    // Extract course name after "in" or "into"
    const courseMatch = query.match(/\b(?:in|into)\s+(.+)$/i);
    const courseName = courseMatch ? courseMatch[1].trim() : 'course';
    
    return {
      intent: 'enroll_user',
      entities: {
        user_email: emailMatch[0],
        course_name: courseName
      },
      requires_approval: true
    };
  }
  
  if (emailMatch && (queryLower.includes('enrollment') || queryLower.includes('course'))) {
    return {
      intent: 'get_user_enrollments',
      entities: {
        user_email: emailMatch[0]
      }
    };
  }
  
  if (queryLower.includes('find') && queryLower.includes('user')) {
    const searchTerm = query.replace(/find|user|users|named/gi, '').trim();
    return {
      intent: 'search_users',
      entities: { query: searchTerm || 'all' }
    };
  }
  
  if (queryLower.includes('course') || queryLower.includes('training') || queryLower.includes('show')) {
    const searchTerm = query.replace(/show|me|course|courses|training/gi, '').trim();
    return {
      intent: 'search_courses',
      entities: { query: searchTerm || 'all' }
    };
  }
  
  if (queryLower.includes('help')) {
    return {
      intent: 'get_help',
      entities: { topic: query }
    };
  }
  
  if (queryLower.includes('stat') || queryLower.includes('overview')) {
    return {
      intent: 'get_stats',
      entities: { type: 'overview' }
    };
  }
  
  // Default fallback
  return {
    intent: 'get_help',
    entities: { topic: query }
  };
}

export async function generateHelpResponse(topic: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Provide helpful information about Docebo LMS topic: ${topic}

Keep response under 400 words, be practical and actionable.

Topic: ${topic}`;

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
