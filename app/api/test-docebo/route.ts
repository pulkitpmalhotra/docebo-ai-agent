import { NextResponse } from 'next/server';
import { DoceboClient } from '@/lib/docebo';

export async function GET() {
  try {
    const requiredEnvVars = ['DOCEBO_DOMAIN', 'DOCEBO_CLIENT_ID', 'DOCEBO_CLIENT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json({
        status: 'failed',
        error: `Missing environment variables: ${missingVars.join(', ')}`
      }, { status: 500 });
    }

    console.log('Testing Docebo API connection...');
    
    const docebo = new DoceboClient();
    
    // Test step by step
    const tests = {
      auth: false,
      users: false,
      courses: false
    };
    
    let authToken;
    let usersData;
    let coursesData;
    
    try {
      // Test 1: Authentication
      authToken = await docebo['getAccessToken']();
      tests.auth = true;
      console.log('✅ Authentication successful');
    } catch (error) {
      console.log('❌ Authentication failed:', error);
    }
    
    try {
      // Test 2: Users endpoint
      usersData = await docebo.getUsers({ limit: 3 });
      tests.users = true;
      console.log('✅ Users endpoint working');
    } catch (error) {
      console.log('❌ Users endpoint failed:', error);
    }
    
    try {
      // Test 3: Courses endpoint
      coursesData = await docebo.getCourses({ limit: 3 });
      tests.courses = true;
      console.log('✅ Courses endpoint working');
    } catch (error) {
      console.log('❌ Courses endpoint failed:', error);
    }
    
    const overallStatus = tests.auth && (tests.users || tests.courses) ? 'success' : 'partial';
    
    return NextResponse.json({
      status: overallStatus,
      message: 'Docebo API connection test completed',
      tests_passed: tests,
      data: {
        users_found: usersData?.data?.length || 0,
        users_sample: usersData?.data?.slice(0, 2).map((user: any) => ({
          id: user.id,
          email: user.email,
          name: `${user.firstname} ${user.lastname}`
        })) || [],
        courses_found: coursesData?.data?.length || 0,
        courses_sample: coursesData?.data?.slice(0, 2).map((course: any) => ({
          id: course.id,
          name: course.name,
          type: course.course_type
        })) || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Docebo API test failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
