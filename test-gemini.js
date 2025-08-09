// test-gemini.js - Save this file in your project root
require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error('❌ GOOGLE_GEMINI_API_KEY not found in .env.local');
      return;
    }

    console.log('🧪 Testing Gemini API connection...');
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent('Say "Hello, Docebo AI!" in JSON format');
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini API working!');
    console.log('Response:', text);
    console.log('✅ Ready to proceed with implementation');
    
  } catch (error) {
    console.error('❌ Gemini API test failed:', error.message);
    console.log('Please check your API key and try again.');
  }
}

testGemini();
