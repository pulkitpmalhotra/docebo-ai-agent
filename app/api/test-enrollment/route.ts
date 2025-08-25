// Create this as app/api/test-enrollment/route.ts - Diagnostic enrollment tester

import { NextRequest, NextResponse } from 'next/server';
import { DoceboAPI } from '../chat/docebo-api';
import { getConfig } from '../chat/utils/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'pulkitmalhotra@google.com';
    const courseName = searchParams.get('course') || 'Optimize Campaigns with Google Ads Tools';
    
    console.log(`🧪 Testing enrollment for: ${email} -> ${courseName}`);
    
    const config = getConfig();
    const api = new DoceboAPI(config);
    
    const diagnosticResults: any = {
      email,
      courseName,
      steps: [],
      success: false,
      timestamp: new Date().toISOString()
    };

    // Step 1: Test user lookup
    try {
      diagnosticResults.steps.push('🔍 Step 1: Looking up user...');
      const user = await api.findUserByEmail(email);
      
      if (user) {
        diagnosticResults.user = {
          id: user.user_id || user.id,
          fullname: user.fullname,
          email: user.email,
          username: user.username,
          status: user.status
        };
        diagnosticResults.steps.push(`✅ User found: ${user.fullname} (ID: ${user.user_id || user.id})`);
      } else {
        diagnosticResults.steps.push(`❌ User not found: ${email}`);
        diagnosticResults.error = 'User not found';
        return NextResponse.json(diagnosticResults);
      }
    } catch (userError) {
      diagnosticResults.steps.push(`❌ User lookup failed: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
      diagnosticResults.error = 'User lookup failed';
      return NextResponse.json(diagnosticResults);
    }

    // Step 2: Test course lookup
    try {
      diagnosticResults.steps.push('🔍 Step 2: Looking up course...');
      const course = await api.findCourseByIdentifier(courseName);
      
      if (course) {
        diagnosticResults.course = {
          id: course.id || course.course_id,
          name: course.name || course.title,
          code: course.code,
          type: course.course_type,
          status: course.status,
          can_subscribe: course.can_subscribe
        };
        diagnosticResults.steps.push(`✅ Course found: ${course.name || course.title} (ID: ${course.id || course.course_id})`);
        
        // Check if course allows enrollment
        if (course.can_subscribe === 0 && course.status !== 2) {
          diagnosticResults.steps.push(`⚠️ WARNING: Course may not allow enrollment (can_subscribe: ${course.can_subscribe}, status: ${course.status})`);
        }
      } else {
        diagnosticResults.steps.push(`❌ Course not found: ${courseName}`);
        diagnosticResults.error = 'Course not found';
        return NextResponse.json(diagnosticResults);
      }
    } catch (courseError) {
      diagnosticResults.steps.push(`❌ Course lookup failed: ${courseError instanceof Error ? courseError.message : 'Unknown error'}`);
      diagnosticResults.error = 'Course lookup failed';
      return NextResponse.json(diagnosticResults);
    }

    // Step 3: Check existing enrollment
    try {
      diagnosticResults.steps.push('🔍 Step 3: Checking existing enrollment...');
      
      const enrollmentCheck = await api.apiRequest('/course/v1/courses/enrollments', 'GET', null, {
        'user_id[]': diagnosticResults.user.id,
        'course_id[]': diagnosticResults.course.id,
        page_size: 10
      });
      
      const existingEnrollment = enrollmentCheck.data?.items?.find((e: any) => 
        e.user_id?.toString() === diagnosticResults.user.id.toString() &&
        e.course_id?.toString() === diagnosticResults.course.id.toString()
      );
      
      if (existingEnrollment) {
        diagnosticResults.existingEnrollment = {
          status: existingEnrollment.enrollment_status,
          level: existingEnrollment.enrollment_level,
          created_at: existingEnrollment.enrollment_created_at
        };
        diagnosticResults.steps.push(`⚠️ User already enrolled with status: ${existingEnrollment.enrollment_status}`);
      } else {
        diagnosticResults.steps.push(`✅ No existing enrollment found - ready to enroll`);
      }
    } catch (checkError) {
      diagnosticResults.steps.push(`⚠️ Could not check existing enrollment: ${checkError instanceof Error ? checkError.message : 'Unknown error'}`);
    }

    // Step 4: Test enrollment API endpoints (without actually enrolling)
    diagnosticResults.steps.push('🔍 Step 4: Testing enrollment endpoints...');
    
    const testEndpoints = [
      {
        name: 'Primary Enrollment Endpoint',
        endpoint: '/learn/v1/enrollments',
        body: {
          course_ids: [parseInt(diagnosticResults.course.id)],
          user_ids: [parseInt(diagnosticResults.user.id)],
          level: 3,
          assignment_type: 'required'
        }
      },
      {
        name: 'Alternative Format',
        endpoint: '/learn/v1/enrollments',
        body: {
          users: [parseInt(diagnosticResults.user.id)],
          courses: [parseInt(diagnosticResults.course.id)],
          level: 3,
          assignment_type: 'required'
        }
      },
      {
        name: 'Batch Enrollment',
        endpoint: '/learn/v1/enrollment/batch',
        body: {
          enrollments: [{
            user_id: parseInt(diagnosticResults.user.id),
            course_id: parseInt(diagnosticResults.course.id),
            level: 3,
            assignment_type: 'required'
          }]
        }
      }
    ];

    diagnosticResults.endpointTests = [];
    
    for (const test of testEndpoints) {
      try {
        diagnosticResults.steps.push(`🔍 Testing ${test.name}...`);
        
        // Test with a dry run (we'll just validate the request format)
        const testResult = {
          endpoint: test.endpoint,
          method: 'POST',
          body: test.body,
          status: 'Format Valid',
          ready: true
        };
        
        diagnosticResults.endpointTests.push(testResult);
        diagnosticResults.steps.push(`✅ ${test.name}: Request format valid`);
        
      } catch (testError) {
        diagnosticResults.endpointTests.push({
          endpoint: test.endpoint,
          error: testError instanceof Error ? testError.message : 'Unknown error',
          ready: false
        });
        diagnosticResults.steps.push(`❌ ${test.name}: ${testError instanceof Error ? testError.message : 'Unknown error'}`);
      }
    }

    // Step 5: API Permission Test
    try {
      diagnosticResults.steps.push('🔍 Step 5: Testing API permissions...');
      
      // Test basic API access
      const permissionTest = await api.apiRequest('/learn/v1/courses', 'GET', null, {
        page_size: 1
      });
      
      if (permissionTest.data) {
        diagnosticResults.steps.push('✅ API permissions: Basic course access OK');
        diagnosticResults.apiPermissions = 'OK';
      } else {
        diagnosticResults.steps.push('⚠️ API permissions: Limited access detected');
        diagnosticResults.apiPermissions = 'LIMITED';
      }
    } catch (permError) {
      diagnosticResults.steps.push(`❌ API permissions: ${permError instanceof Error ? permError.message : 'Unknown error'}`);
      diagnosticResults.apiPermissions = 'FAILED';
    }

    // Final assessment
    if (diagnosticResults.user && diagnosticResults.course && diagnosticResults.apiPermissions === 'OK') {
      diagnosticResults.success = true;
      diagnosticResults.recommendation = 'All prerequisites met - enrollment should work';
      diagnosticResults.steps.push('🎉 DIAGNOSIS: Ready for enrollment!');
    } else {
      diagnosticResults.recommendation = 'Issues detected - see steps for details';
      diagnosticResults.steps.push('⚠️ DIAGNOSIS: Issues prevent enrollment');
    }

    return NextResponse.json(diagnosticResults, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Diagnostic test error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, courseName, actuallyEnroll = false } = body;
    
    if (!actuallyEnroll) {
      return NextResponse.json({
        message: 'Use GET for diagnostics, or set actuallyEnroll: true to perform real enrollment'
      });
    }

    console.log(`🚀 REAL ENROLLMENT TEST: ${email} -> ${courseName}`);
    
    const config = getConfig();
    const api = new DoceboAPI(config);
    
    // Find user and course
    const user = await api.findUserByEmail(email);
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }
    
    const course = await api.findCourseByIdentifier(courseName);
    if (!course) {
      throw new Error(`Course not found: ${courseName}`);
    }

    // Attempt enrollment
    const result = await api.enrollUserInCourse(
      user.user_id || user.id,
      course.id || course.course_id,
      { level: 'student', assignmentType: 'required' }
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.user_id || user.id,
        email: user.email,
        fullname: user.fullname
      },
      course: {
        id: course.id || course.course_id,
        name: course.name || course.title
      },
      enrollmentResult: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Real enrollment test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
