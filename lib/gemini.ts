import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Define action schemas (same as before)
const ActionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('search_users'),
    entities: z.object({
      query: z.string(),
      limit: z.number().optional(),
    }),
  }),
  z.object({
    intent: z.literal('search_courses'),
    entities: z.object({
      query: z.string(),
      limit: z.number().optional(),
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
    intent: z.literal('get_user_enrollments'),
    entities: z.object({
      user_email: z.string().email(),
    }),
  }),
]);

type AIAction = z.infer<typeof ActionSchema>;

export async function processUserQueryWithGemini(query: string): Promise<AIAction> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 1024,
    },
  });

  const systemPrompt = `You are a helpful AI assistant for Docebo LMS administrators. 

Your job is to understand user requests and convert them into structured JSON actions.

Available intents:
- search_users: Find users by name or email
- search_courses: Find courses by name or description  
- enroll_user: Enroll a specific user in a course (requires approval)
- get_user_enrollments: Get all enrollments for a user
- get_help: Provide help about Docebo features

Important:
- Any write operations (enroll_user, create_user, etc.) must set requires_approval: true
- Always extract specific entities from the user's request
- Return ONLY valid JSON matching the schema
- If the request is ambiguous, ask for clarification

Response format example:
{
  "intent": "search_users",
  "entities": {
    "query": "John"
  }
}

Examples:
"Find users named John" → {"intent": "search_users", "entities": {"query": "John"}}
"Show me courses about JavaScript" → {"intent": "search_courses", "entities": {"query": "JavaScript"}}  
"Enroll jane@company.com in Python 101" → {"intent": "enroll_user", "entities": {"user_email": "jane@company.com", "course_name": "Python 101"}, "requires_approval": true}
`;

  const prompt = `${systemPrompt}\n\nUser request: "${query}"\n\nJSON response:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response (remove markdown formatting if present)
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    
    const parsed = JSON.parse(cleanJson);
    return ActionSchema.parse(parsed);
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to process query with Gemini');
  }
}

export async function generateHelpResponseWithGemini(topic: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a Docebo LMS expert assistant. Provide helpful, accurate information about Docebo features and best practices. 

Topic: ${topic}

Provide a comprehensive but concise response (max 500 words) covering:
1. What this feature/topic is
2. How it works in Docebo
3. Best practices
4. Common use cases
5. Tips for administrators

Keep the tone professional but friendly.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini help response error:', error);
    return 'Sorry, I could not generate a helpful response at this time.';
  }
}

// Cost tracking for Gemini
export class GeminiCostTracker {
  private static instance: GeminiCostTracker;
  private monthlyUsage = {
    characters: 0,
    requests: 0,
    estimated_cost: 0,
  };

  static getInstance() {
    if (!GeminiCostTracker.instance) {
      GeminiCostTracker.instance = new GeminiCostTracker();
    }
    return GeminiCostTracker.instance;
  }

  trackUsage(inputChars: number, outputChars: number) {
    const totalChars = inputChars + outputChars;
    this.monthlyUsage.characters += totalChars;
    this.monthlyUsage.requests += 1;
    
    // Gemini 1.5 Flash pricing: $0.075 per 1M input chars, $0.30 per 1M output chars
    const inputCost = (inputChars / 1000000) * 0.075;
    const outputCost = (outputChars / 1000000) * 0.30;
    const totalCost = inputCost + outputCost;
    
    this.monthlyUsage.estimated_cost += totalCost;

    // Alert if approaching budget
    if (this.monthlyUsage.estimated_cost > 15) {
      this.sendBudgetAlert();
    }

    return {
      request_cost: totalCost,
      monthly_total: this.monthlyUsage.estimated_cost,
      characters_used: totalChars,
    };
  }

  private sendBudgetAlert() {
    console.warn('⚠️ Approaching monthly budget limit!');
    // Implement notification logic
  }

  getUsageStats() {
    return this.monthlyUsage;
  }
}
