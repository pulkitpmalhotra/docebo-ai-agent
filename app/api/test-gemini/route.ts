import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  try {
    // Check if API key exists
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'GOOGLE_GEMINI_API_KEY not found in environment variables',
        status: 'failed',
        help: 'Add your Gemini API key in Vercel dashboard under Environment Variables'
      }, { status: 500 });
    }

    console.log('Testing Gemini API connection...');
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Test with a simple request
    const result = await model.generateContent('Respond with: {"status": "success", "message": "Gemini API working on Vercel!"}');
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      status: 'success',
      message: 'Gemini API is working on Vercel!',
      gemini_response: text,
      timestamp: new Date().toISOString(),
      environment: 'vercel'
    });

  } catch (error) {
    console.error('Gemini API test failed:', error);
    
    // Properly handle the error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      help: 'Check your GOOGLE_GEMINI_API_KEY in Vercel environment variables'
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'API key not configured' 
      }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Test with a more complex request
    const testPrompt = `
You are a Docebo LMS assistant. Respond with JSON in this exact format:
{
  "intent": "test_connection",
  "message": "Connection successful",
  "capabilities": ["search_users", "search_courses", "help_queries"],
  "ready": true
}
`;

    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse as JSON
    let parsedResponse;
    try {
      // Clean the response (remove markdown formatting if present)
      const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanJson);
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
      parsedResponse = { raw_response: text, parse_error: parseErrorMessage };
    }

    return NextResponse.json({
      status: 'success',
      test_type: 'structured_response',
      gemini_output: parsedResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
