import { NextResponse } from 'next/server';
import { DoceboClient } from '@/lib/docebo';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiCostTracker } from '@/lib/gemini';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      docebo: { status: 'unknown' },
      gemini: { status: 'unknown' },
      database: { status: 'unknown' },
    },
    costs: {
      monthly_usage: 0,
      budget_remaining: 20,
    }
  };

  try {
    // Check Docebo API
    const docebo = new DoceboClient();
    const doceboHealth = await docebo.healthCheck();
    health.services.docebo = doceboHealth;
  } catch (error) {
    health.services.docebo = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  try {
    // Check Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    await model.generateContent('test');
    health.services.gemini = { status: 'healthy' };
  } catch (error) {
    health.services.gemini = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  try {
    // Check cost usage
    const costTracker = GeminiCostTracker.getInstance();
    const usage = costTracker.getUsageStats();
    health.costs.monthly_usage = usage.estimated_cost;
    health.costs.budget_remaining = 20 - usage.estimated_cost;
  } catch (error) {
    console.error('Cost tracking error:', error);
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
