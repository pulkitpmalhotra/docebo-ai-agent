import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Define what actions our AI can perform
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
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 1024,
    },
  });

  const systemPrompt = `You are an intelligent assistant for Docebo LMS administrators. Your job is to understand user requests and convert them into structured actions.

AVAILABLE ACTIONS:
1. search_users - Find users by name, email, or department
2. search_courses - Find courses by name or category  
3. get_user_enrollments - Get enrollment details for a specific user
4. enroll_user - Enroll a user in a course (requires approval)
5. get_help - Provide help about Docebo features
6. get_stats - Get statistics and analytics

IMPORTANT RULES:
- ALWAYS respond with valid JSON matching the schema
- Any write operations (enroll_user) must include "requires_approval": true
- Extract specific entities from user requests
- If request is unclear, choose the most likely intent
- For user searches, look for names, emails, or departments
- For course searches, look for course names or topics

EXAMPLES:
User: "Find users named John" 
Response: {"intent": "search_users", "entities": {"query": "John"}}

User: "Show me Python courses"
Response: {"intent": "search_courses", "entities": {"query": "Python"}}

User: "What are jane@company.com's enrollments?"
Response: {"intent": "get_user_enrollments", "entities": {"user_email": "jane@company.com"}}

User: "Enroll sarah@company.com in Excel training"
Response: {"intent": "enroll_user", "entities": {"user_email": "sarah@company.com", "course_name": "Excel training"}, "requires_approval": true}

User: "Help me understand learning paths"
Response: {"intent": "get_help", "entities": {"topic": "learning paths"}}

User: "Show me enrollment statistics"
Response: {"intent": "get_stats", "entities": {"type": "enrollment"}}

Now process this user request: "${query}"

Respond with ONLY the JSON:`;

  try {
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response (remove markdown formatting if present)
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    
    console.log('Raw Gemini response:', text);
    console.log('Cleaned JSON:', cleanJson);
    
    const parsed = JSON.parse(cleanJson);
    return ActionSchema.parse(parsed);
  } catch (error) {
    console.error('Gemini processing error:', error);
    
    // Fallback: try to extract intent from the query manually
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('find') && queryLower.includes('user')) {
      return {
        intent: 'search_users',
        entities: { query: query.replace(/find|user|users/gi, '').trim() }
      };
    }
    
    if (queryLower.includes('course') || queryLower.includes('training')) {
      return {
        intent: 'search_courses', 
        entities: { query: query.replace(/show|me|course|courses/gi, '').trim() }
      };
    }
    
    // Default to help
    return {
      intent: 'get_help',
      entities: { topic: query }
    };
  }
}

export async function generateHelpResponse(topic: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a Docebo LMS expert. Provide helpful information about: ${topic}

Keep your response:
- Concise but comprehensive (300-500 words)
- Practical and actionable
- Include best practices
- Use bullet points for clarity
- Professional but friendly tone

Topic: ${topic}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini help response error:', error);
    return `I'd be happy to help with "${topic}". However, I'm experiencing a technical issue right now. Please try rephrasing your question or contact your administrator for assistance.`;
  }
}
