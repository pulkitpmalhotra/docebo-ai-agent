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
    
    return NextResponse.json({
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      help: 'Check your GOOGLE_GEMINI_API_KEY in Vercel environment variables'
    }, { status: 500 });
  }
}
