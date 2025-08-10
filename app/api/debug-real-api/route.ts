import { NextRequest, NextResponse } from 'next/server';
import { EnhancedDoceboClient } from '@/lib/docebo-enhanced';

export async function GET() {
  try {
    console.log('🔍 Testing Real Docebo API Connection...');
    
    // Check environment variables
    const envCheck = {
      DOCEBO_DOMAIN: process.env.DOCEBO_DOMAIN ? `Set: ${process.env.DOCEBO_DOMAIN}` : 'Missing',
      DOCEBO_CLIENT_ID: process.env.DOCEBO_CLIENT_ID ? `Set: ${process.env.DOCEBO_CLIENT_ID?.substring(0, 8)}...` : 'Missing',
      DOCEBO_CLIENT_SECRET: process.env.DOCEBO_CLIENT_SECRET ? 'Set (hidden)' : 'Missing',
      USE_MOCK_DOCEBO: process.env.USE_MOCK_DOCEBO || 'Not set'
    };
    
    console.log('Environment variables:', envCheck);
    
    // Test API connection
    const docebo = new EnhancedDoceboClient();
    
    let healthResult;
    try {
      healthResult = await docebo.healthCheck();
      console.log('Health check result:', healthResult);
    } catch (error) {
      console.error('Health check failed:', error);
      healthResult = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
    }
    
    // Test actual API calls
    let usersResult;
    try {
      console.log('Testing users API...');
      usersResult = await docebo.getUsers({ limit: 3 });
      console.log('Users API result:', usersResult);
    } catch (error) {
      console.error('Users API failed:', error);
      usersResult = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
    
    let coursesResult;
    try {
      console.log('Testing courses API...');
      coursesResult = await docebo.getCourses({ limit: 3 });
      console.log('Courses API result:', coursesResult);
    } catch (error) {
      console.error('Courses API failed:', error);
      coursesResult = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
    
    return NextResponse.json({
      status: 'debug',
      timestamp: new Date().toISOString(),
      environment_check: envCheck,
      health_check: healthResult,
      api_tests: {
        users: usersResult,
        courses: coursesResult
      },
      docebo_url: `https://${process.env.DOCEBO_DOMAIN}`,
      client_type: 'EnhancedDoceboClient'
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { test_type, identifier } = await request.json();
    
    const docebo = new EnhancedDoceboClient();
    
    let result;
    
    switch (test_type) {
      case 'user_search':
        console.log(`Testing user search for: ${identifier}`);
        result = await docebo.getUserStatus(identifier, 'email');
        break;
        
      case 'course_search':
        console.log(`Testing course search for: ${identifier}`);
        result = await docebo.searchCourses(identifier, 'title');
        break;
        
      default:
        result = { error: 'Invalid test type' };
    }
    
    return NextResponse.json({
      status: 'test_result',
      test_type,
      identifier,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'test_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
