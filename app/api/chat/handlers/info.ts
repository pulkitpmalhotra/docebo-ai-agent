// app/api/chat/handlers/info.ts - Fixed pagination response for load more functionality
import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';
import { APIResponse } from '../types';

export class InfoHandlers {
  
  static async handleSpecificEnrollmentCheck(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, resourceName, resourceType, checkType, query } = entities;
      
      if (!email || !resourceName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and resource name to check enrollment.\n\n**Examples**: \n• "Check if john@company.com is enrolled in course Python Programming"\n• "Has sarah@company.com completed learning plan Data Science?"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔍 Enhanced enrollment check: ${email} -> ${resourceName} (${resourceType})`);

      // Find user
      const userDetails = await api.getUserDetails(email);
      
      // Enhanced enrollment checking logic
      if (resourceType === 'learning_plan') {
        return await this.checkLearningPlanEnrollment(userDetails, resourceName, checkType, api);
      } else {
        return await this.checkCourseEnrollment(userDetails, resourceName, checkType, api);
      }

    } catch (error) {
      console.error('❌ Enrollment check error:', error);
      
      return NextResponse.json({
        response: `❌ **Enrollment Check Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email is correct
• Resource name is spelled correctly
• User exists in the system`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  private static async checkLearningPlanEnrollment(userDetails: any, resourceName: string, checkType: string, api: DoceboAPI): Promise<NextResponse> {
    console.log(`📋 Checking learning plan enrollment for user ${userDetails.id}`);
    
    try {
      // Method 1: Direct learning plan enrollment check by learning plan ID
      if (/^\d+$/.test(resourceName)) {
        console.log(`🔍 Method 1: Direct LP ID check for ID ${resourceName}`);
        const directCheck = await this.checkDirectLearningPlanEnrollment(userDetails.id, resourceName, api);
        if (directCheck.found) {
          return this.formatEnrollmentResponse(userDetails, directCheck, resourceName, 'learning_plan', checkType);
        }
      }

      // Method 2: Search learning plans and check enrollments
      console.log(`🔍 Method 2: Search learning plans and check enrollments`);
      const learningPlans = await api.searchLearningPlans(resourceName, 50);
      console.log(`📊 Found ${learningPlans.length} learning plans matching "${resourceName}"`);
      
      for (const lp of learningPlans) {
        const lpName = api.getLearningPlanName(lp);
        const lpId = lp.learning_plan_id || lp.id;
        
        console.log(`🔍 Checking LP: "${lpName}" (ID: ${lpId})`);
        
        if (this.isLearningPlanMatch(lpName, resourceName) && lpId) {
          const enrollmentCheck = await this.checkDirectLearningPlanEnrollment(userDetails.id, lpId.toString(), api);
          if (enrollmentCheck.found) {
            return this.formatEnrollmentResponse(userDetails, enrollmentCheck, lpName, 'learning_plan', checkType);
          }
        }
      }

      // Method 3: Get all user enrollments and search within them
      console.log(`🔍 Method 3: Get all user enrollments and search within them`);
      const enrollmentData = await api.getUserAllEnrollments(userDetails.id);
      
      if (enrollmentData.learningPlans.enrollments.length > 0) {
        console.log(`📊 Found ${enrollmentData.learningPlans.enrollments.length} total LP enrollments`);
        
        for (const enrollment of enrollmentData.learningPlans.enrollments) {
          const formatted = api.formatLearningPlanEnrollment(enrollment);
          const lpName = formatted.learningPlanName || 'Unknown Learning Plan';
          console.log(`🔍 Checking enrollment: "${lpName}"`);
          
          if (formatted.learningPlanName && this.isLearningPlanMatch(formatted.learningPlanName, resourceName)) {
            return this.formatEnrollmentResponse(userDetails, {
              found: true,
              enrollment: formatted,
              method: 'user_enrollments'
            }, formatted.learningPlanName, 'learning_plan', checkType);
          }
        }
      }

      // Method 4: Try alternative learning plan endpoints
      console.log(`🔍 Method 4: Alternative learning plan endpoints`);
      const alternativeCheck = await this.checkAlternativeLearningPlanEndpoints(userDetails.id, resourceName, api);
      if (alternativeCheck.found) {
        return this.formatEnrollmentResponse(userDetails, alternativeCheck, resourceName, 'learning_plan', checkType);
      }

      // Not found in any method
      return NextResponse.json({
        response: `❌ **No Learning Plan Enrollment Found**: ${userDetails.fullname}

👤 **User**: ${userDetails.fullname} (${userDetails.email})
📋 **Learning Plan**: ${resourceName}

The user is not currently enrolled in this learning plan.

📊 **User's Current Enrollments**: 
• **Courses**: ${enrollmentData.totalCourses}
• **Learning Plans**: ${enrollmentData.totalLearningPlans}

🔍 **Search Methods Used**:
• Direct LP ID lookup
• Learning plan search and enrollment check
• User enrollment data analysis
• Alternative API endpoints

💡 **Next Steps**: 
• "User enrollments ${userDetails.email}" to see all enrollments
• "Enroll ${userDetails.email} in learning plan ${resourceName}" to enroll
• Try using the exact learning plan name or ID from Docebo`,
        success: false,
        data: {
          user: userDetails,
          found: false,
          resourceType: 'learning_plan',
          checkType: checkType,
          totalEnrollments: {
            courses: enrollmentData.totalCourses,
            learningPlans: enrollmentData.totalLearningPlans
          },
          methodsUsed: ['direct_id', 'search_and_check', 'user_enrollments', 'alternative_endpoints']
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan enrollment check error:', error);
      throw error;
    }
  }

  private static async checkDirectLearningPlanEnrollment(userId: string, learningPlanId: string, api: DoceboAPI): Promise<any> {
    const endpoints = [
      `/learningplan/v1/learningplans/enrollments?user_id[]=${userId}&learning_plan_id[]=${learningPlanId}`,
      `/learningplan/v1/learningplans/enrollments?user_id=${userId}&learning_plan_id=${learningPlanId}`,
      `/learningplan/v1/learningplans/${learningPlanId}/enrollments?user_id=${userId}`,
      `/learningplan/v1/learningplans/${learningPlanId}/enrollments?user_id[]=${userId}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying direct LP enrollment endpoint: ${endpoint}`);
        const result = await api.apiRequest(endpoint, 'GET');
        
        if (result.data?.items?.length > 0) {
          console.log(`📊 Found ${result.data.items.length} enrollment(s) from ${endpoint}`);
          
          const userEnrollment = result.data.items.find((enrollment: any) => {
            const enrollmentUserId = enrollment.user_id || enrollment.id_user || enrollment.userId;
            const enrollmentLpId = enrollment.learning_plan_id || enrollment.lp_id || enrollment.id_learning_plan;
            
            return enrollmentUserId?.toString() === userId.toString() && 
                   enrollmentLpId?.toString() === learningPlanId.toString();
          });
          
          if (userEnrollment) {
            console.log(`✅ Found LP enrollment via ${endpoint}`);
            const formatted = this.formatDoceboLearningPlanEnrollment(userEnrollment);
            return {
              found: true,
              enrollment: formatted,
              method: 'direct_api',
              endpoint: endpoint,
              rawData: userEnrollment
            };
          }
        }
      } catch (error) {
        console.log(`❌ Direct LP enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }

    return { found: false };
  }

  private static formatDoceboLearningPlanEnrollment(enrollment: any): any {
    return {
      learningPlanId: enrollment.learning_plan_id?.toString(),
      learningPlanName: enrollment.learning_plan_name || 'Unknown Learning Plan',
      learningPlanCode: enrollment.learning_plan_code,
      enrollmentStatus: this.mapDoceboEnrollmentStatus(enrollment),
      enrollmentDate: enrollment.enrollment_created_at || enrollment.enrollment_validity_begin_date,
      completionDate: enrollment.completion_date || enrollment.date_completed,
      progress: this.calculateLearningPlanProgress(enrollment),
      completedCourses: parseInt(enrollment.mandatory_courses_completed_at_completion || '0'),
      totalCourses: parseInt(enrollment.mandatory_courses_total_at_completion || '0'),
      dueDate: enrollment.enrollment_validity_end_date || enrollment.enrollment_validity_end_datetime,
      assignmentType: enrollment.assignment_type || 'Not specified',
      timeSpent: enrollment.enrollment_time_spent || 0,
      validityBegin: enrollment.enrollment_validity_begin_datetime,
      validityEnd: enrollment.enrollment_validity_end_datetime,
      lastUpdated: enrollment.enrollment_date_last_updated
    };
  }

  private static mapDoceboEnrollmentStatus(enrollment: any): string {
    const completedCourses = parseInt(enrollment.mandatory_courses_completed_at_completion || '0');
    const totalCourses = parseInt(enrollment.mandatory_courses_total_at_completion || '0');
    
    if (totalCourses > 0 && completedCourses >= totalCourses) {
      return 'completed';
    } else if (completedCourses > 0) {
      return 'in_progress';
    } else {
      return 'enrolled';
    }
  }

  private static calculateLearningPlanProgress(enrollment: any): number {
    const completedCourses = parseInt(enrollment.mandatory_courses_completed_at_completion || '0');
    const totalCourses = parseInt(enrollment.mandatory_courses_total_at_completion || '0');
    
    if (totalCourses === 0) return 0;
    return Math.round((completedCourses / totalCourses) * 100);
  }

  private static async checkAlternativeLearningPlanEndpoints(userId: string, resourceName: string, api: DoceboAPI): Promise<any> {
    const endpoints = [
      `/learningplan/v1/learningplans/enrollments?user_id[]=${userId}`,
      `/learningplan/v1/learningplans/enrollments?user_id=${userId}`,
      `/manage/v1/user/${userId}/learningplans`,
      `/learn/v1/users/${userId}/learningplans`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying alternative LP endpoint: ${endpoint}`);
        const result = await api.apiRequest(endpoint, 'GET');
        
        let enrollments = [];
        if (result.data?.items) {
          enrollments = result.data.items;
        } else if (Array.isArray(result.data)) {
          enrollments = result.data;
        } else if (Array.isArray(result)) {
          enrollments = result;
        }

        if (enrollments.length > 0) {
          console.log(`📊 Found ${enrollments.length} enrollments from ${endpoint}`);
          
          for (const enrollment of enrollments) {
            const lpName = enrollment.learning_plan_name || api.getLearningPlanName(enrollment);
            const lpId = enrollment.learning_plan_id?.toString();
            
            if (/^\d+$/.test(resourceName) && lpId === resourceName) {
              const formatted = this.formatDoceboLearningPlanEnrollment(enrollment);
              return {
                found: true,
                enrollment: formatted,
                method: 'alternative_endpoint_by_id',
                endpoint: endpoint,
                rawData: enrollment
              };
            }
            
            if (lpName && this.isLearningPlanMatch(lpName, resourceName)) {
              const formatted = this.formatDoceboLearningPlanEnrollment(enrollment);
              return {
                found: true,
                enrollment: formatted,
                method: 'alternative_endpoint_by_name',
                endpoint: endpoint,
                rawData: enrollment
              };
            }
          }
        }
      } catch (error) {
        console.log(`❌ Alternative LP endpoint ${endpoint} failed:`, error);
        continue;
      }
    }

    return { found: false };
  }

  private static async checkCourseEnrollment(userDetails: any, resourceName: string, checkType: string, api: DoceboAPI): Promise<NextResponse> {
    console.log(`📚 Checking course enrollment for user ${userDetails.id}`);
    
    try {
      if (/^\d+$/.test(resourceName)) {
        const directCheck = await this.checkDirectCourseEnrollment(userDetails.id, resourceName, api);
        if (directCheck.found) {
          return this.formatEnrollmentResponse(userDetails, directCheck, resourceName, 'course', checkType);
        }
      }

      const courses = await api.searchCourses(resourceName, 50);
      for (const course of courses) {
        const courseName = api.getCourseName(course);
        const courseId = course.id || course.course_id || course.idCourse;
        
        if (this.isCourseMatch(courseName, resourceName) && courseId) {
          const enrollmentCheck = await this.checkDirectCourseEnrollment(userDetails.id, courseId.toString(), api);
          if (enrollmentCheck.found) {
            return this.formatEnrollmentResponse(userDetails, enrollmentCheck, courseName, 'course', checkType);
          }
        }
      }

      const enrollmentData = await api.getUserAllEnrollments(userDetails.id);
      
      if (enrollmentData.courses.enrollments.length > 0) {
        for (const enrollment of enrollmentData.courses.enrollments) {
          const formatted = api.formatCourseEnrollment(enrollment);
          
          if (formatted.courseName && this.isCourseMatch(formatted.courseName, resourceName)) {
            return this.formatEnrollmentResponse(userDetails, {
              found: true,
              enrollment: formatted,
              method: 'user_enrollments'
            }, formatted.courseName, 'course', checkType);
          }
        }
      }

      return NextResponse.json({
        response: `❌ **No Course Enrollment Found**: ${userDetails.fullname}

👤 **User**: ${userDetails.fullname} (${userDetails.email})
📚 **Course**: ${resourceName}

The user is not currently enrolled in this course.

📊 **User's Current Enrollments**: 
• **Courses**: ${enrollmentData.totalCourses}
• **Learning Plans**: ${enrollmentData.totalLearningPlans}

💡 **Next Steps**: 
• "User enrollments ${userDetails.email}" to see all enrollments
• "Enroll ${userDetails.email} in course ${resourceName}" to enroll`,
        success: false,
        data: {
          user: userDetails,
          found: false,
          resourceType: 'course',
          checkType: checkType,
          totalEnrollments: {
            courses: enrollmentData.totalCourses,
            learningPlans: enrollmentData.totalLearningPlans
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course enrollment check error:', error);
      throw error;
    }
  }

  private static async checkDirectCourseEnrollment(userId: string, courseId: string, api: DoceboAPI): Promise<any> {
    const endpoints = [
      `/course/v1/courses/${courseId}/enrollments?search_text=${userId}`,
      `/course/v1/courses/enrollments?user_id[]=${userId}&course_id[]=${courseId}`,
      `/course/v1/courses/enrollments?user_id=${userId}&course_id=${courseId}`,
      `/course/v1/courses/${courseId}/enrollments?user_id=${userId}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying direct course enrollment endpoint: ${endpoint}`);
        const result = await api.apiRequest(endpoint, 'GET');
        
        if (result.data?.items?.length > 0) {
          console.log(`📊 Found ${result.data.items.length} enrollment(s) from ${endpoint}`);
          console.log(`📋 Raw enrollment data:`, JSON.stringify(result.data.items, null, 2));
          
          const userEnrollment = result.data.items.find((enrollment: any) => {
            const enrollmentUserId = enrollment.user_id || enrollment.id_user;
            const enrollmentCourseId = enrollment.course_id || enrollment.id_course;
            
            // For search_text endpoints, check if this is the right user by email or user_id
            if (endpoint.includes('search_text')) {
              return enrollment.user_id?.toString() === userId.toString() || 
                     enrollment.email?.toLowerCase().includes(userId.toLowerCase());
            }
            
            return enrollmentUserId?.toString() === userId.toString() && 
                   (enrollmentCourseId?.toString() === courseId.toString() || !enrollmentCourseId);
          });
          
          if (userEnrollment) {
            console.log(`✅ Found course enrollment via ${endpoint}`);
            console.log(`📋 Enrollment details:`, JSON.stringify(userEnrollment, null, 2));
            
            // Enhanced formatting using the rich API response data
            const formatted = this.formatEnhancedCourseEnrollment(userEnrollment);
            return {
              found: true,
              enrollment: formatted,
              method: 'direct_api',
              endpoint: endpoint,
              rawData: userEnrollment
            };
          }
        }
      } catch (error) {
        console.log(`❌ Direct course enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }

    return { found: false };
  }

  private static formatEnhancedCourseEnrollment(enrollment: any): any {
    console.log(`🔧 Formatting enhanced course enrollment:`, JSON.stringify(enrollment, null, 2));
    
    // Map the status from the API response - handle both formats
    let enrollmentStatus = 'unknown';
    const statusField = enrollment.enrollment_status || enrollment.status;
    
    if (statusField) {
      switch (statusField.toLowerCase()) {
        case 'completed':
          enrollmentStatus = 'completed';
          break;
        case 'in progress':
        case 'in_progress':
        case 'enrolled':
          enrollmentStatus = 'in_progress';
          break;
        case 'not started':
        case 'not_started':
          enrollmentStatus = 'not_started';
          break;
        case 'suspended':
          enrollmentStatus = 'suspended';
          break;
        default:
          enrollmentStatus = statusField.toLowerCase().replace(' ', '_');
      }
    } else if (enrollment.status_id || enrollment.enrollment_status_id) {
      // Map by status ID if available
      const statusId = enrollment.status_id || enrollment.enrollment_status_id;
      switch (statusId.toString()) {
        case '0':
          enrollmentStatus = 'not_started';
          break;
        case '1':
          enrollmentStatus = 'in_progress';
          break;
        case '2':
          enrollmentStatus = 'completed';
          break;
        case '3':
          enrollmentStatus = 'suspended';
          break;
        default:
          enrollmentStatus = `status_${statusId}`;
      }
    }

    // Calculate progress based on status and available data
    let progress = this.calculateProgressFromStatus(enrollmentStatus);
    if (enrollment.enrollment_score !== undefined && enrollmentStatus === 'completed') {
      progress = 100;
    }

    const formatted = {
      courseId: (enrollment.course_id || enrollment.id_course)?.toString(),
      courseName: enrollment.course_name || enrollment.name || 'Unknown Course',
      courseCode: enrollment.course_code || enrollment.code,
      courseUid: enrollment.course_uid || enrollment.uid,
      courseType: enrollment.course_type || enrollment.type,
      enrollmentStatus: enrollmentStatus,
      enrollmentDate: enrollment.enrollment_created_at || enrollment.enrollment_date || enrollment.enroll_date_of_enrollment,
      completionDate: enrollment.enrollment_completion_date || enrollment.date_complete || enrollment.completion_date,
      progress: progress,
      score: enrollment.enrollment_score !== undefined ? parseFloat(enrollment.enrollment_score) : 
             (enrollment.score_given !== undefined ? parseFloat(enrollment.score_given) : 0),
      assignmentType: enrollment.assignment_type,
      enrollmentLevel: enrollment.enrollment_level || enrollment.level,
      validityBegin: enrollment.enrollment_validity_begin_datetime || enrollment.active_from,
      validityEnd: enrollment.enrollment_validity_end_datetime || enrollment.active_until,
      lastUpdated: enrollment.enrollment_date_last_updated || enrollment.last_update,
      createdBy: enrollment.enrollment_created_by,
      // Additional API fields
      userLevel: enrollment.level,
      userStatus: enrollment.user_status,
      statusId: enrollment.status_id || enrollment.enrollment_status_id,
      levelId: enrollment.level_id,
      userStatusId: enrollment.user_status_id,
      forcedScore: enrollment.forced_score_given
    };

    console.log(`✅ Formatted course enrollment:`, JSON.stringify(formatted, null, 2));
    return formatted;
  }

  private static calculateProgressFromStatus(status: string): number {
    switch (status) {
      case 'completed':
        return 100;
      case 'in_progress':
        return 50; // Default assumption for in-progress
      case 'not_started':
        return 0;
      case 'suspended':
        return 0;
      default:
        return 0;
    }
  }

  private static isCourseMatch(courseName: string, searchTerm: string): boolean {
    const courseLower = courseName.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return courseLower === searchLower || 
           courseLower.includes(searchLower) || 
           searchLower.includes(courseLower);
  }

  private static isLearningPlanMatch(lpName: string, searchTerm: string): boolean {
    const lpLower = lpName.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return lpLower === searchLower || 
           lpLower.includes(searchLower) || 
           searchLower.includes(lpLower);
  }

  private static formatEnrollmentResponse(userDetails: any, enrollmentCheck: any, resourceName: string, resourceType: string, checkType: string): NextResponse {
    const formatted = enrollmentCheck.enrollment;
    const rawData = enrollmentCheck.rawData;
    const isLearningPlan = resourceType === 'learning_plan';
    
    console.log(`🎨 Formatting enrollment response - formatted:`, JSON.stringify(formatted, null, 2));
    console.log(`🎨 Raw data available:`, JSON.stringify(rawData, null, 2));
    
    let responseMessage = `✅ **Enrollment Found**: ${userDetails.fullname}

${isLearningPlan ? '📋' : '📚'} **${isLearningPlan ? 'Learning Plan' : 'Course'}**: ${isLearningPlan ? formatted.learningPlanName : formatted.courseName}`;

    // Add course details for courses
    if (!isLearningPlan && formatted.courseCode) {
      responseMessage += `\n🏷️ **Course Code**: ${formatted.courseCode}`;
    }
    if (!isLearningPlan && formatted.courseType) {
      responseMessage += `\n📂 **Course Type**: ${formatted.courseType}`;
    }

    responseMessage += `\n\n👤 **User Details**:
• **Name**: ${userDetails.fullname}
• **Username**: ${userDetails.username}
• **Email**: ${userDetails.email}
• **User Level**: ${userDetails.level}
• **User Status**: ${userDetails.status}`;

    responseMessage += `\n\n📊 **Enrollment Details**:
• **Status**: ${formatted.enrollmentStatus.toUpperCase()}
• **Assignment Type**: ${formatted.assignmentType || 'Not specified'}
• **Enrollment Level**: ${formatted.enrollmentLevel || 'Student'}`;

    // Course-specific timing information
    if (!isLearningPlan) {
      if (formatted.enrollmentDate) {
        responseMessage += `\n• **Enrolled**: ${formatted.enrollmentDate}`;
      }
      if (formatted.validityBegin && formatted.validityEnd) {
        responseMessage += `\n• **Validity Period**: ${formatted.validityBegin} to ${formatted.validityEnd}`;
      }
      if (formatted.completionDate) {
        responseMessage += `\n• **Completed**: ${formatted.completionDate}`;
      }
      if (formatted.lastUpdated) {
        responseMessage += `\n• **Last Updated**: ${formatted.lastUpdated}`;
      }
    }

    // Progress and scoring
    if (!isLearningPlan) {
      if (formatted.progress !== undefined) {
        responseMessage += `\n• **Progress**: ${formatted.progress}%`;
      }
      if (formatted.score !== undefined && formatted.score > 0) {
        responseMessage += `\n• **Score**: ${formatted.score}${formatted.forcedScore ? ' (Forced)' : ''}`;
      }
    } else {
      // Learning Plan specific fields
      responseMessage += `\n• **Progress**: ${formatted.completedCourses || 0}/${formatted.totalCourses || 0} courses completed (${formatted.progress || 0}%)`;
      
      if (formatted.timeSpent !== undefined && formatted.timeSpent > 0) {
        responseMessage += `\n• **Time Spent**: ${formatted.timeSpent} minutes`;
      }
      
      if (formatted.validityBegin) {
        responseMessage += `\n• **Validity Period**: ${formatted.validityBegin} to ${formatted.validityEnd || 'No end date'}`;
      }
    }

    responseMessage += `\n\n🔧 **Technical Details**:
• **Found via**: ${enrollmentCheck.method}`;
    
    if (enrollmentCheck.endpoint) {
      responseMessage += `\n• **API Endpoint**: ${enrollmentCheck.endpoint}`;
    }

    // Additional technical details
    if (rawData) {
      if (!isLearningPlan) {
        if (rawData.course_id) {
          responseMessage += `\n• **Course ID**: ${rawData.course_id}`;
        }
        if (rawData.user_id) {
          responseMessage += `\n• **User ID**: ${rawData.user_id}`;
        }
        if (rawData.course_uid) {
          responseMessage += `\n• **Course UID**: ${rawData.course_uid}`;
        }
        if (rawData.enrollment_created_by) {
          responseMessage += `\n• **Enrolled By**: User ID ${rawData.enrollment_created_by}`;
        }
      } else {
        if (rawData.learning_plan_id) {
          responseMessage += `\n• **Learning Plan ID**: ${rawData.learning_plan_id}`;
        }
        if (rawData.user_id) {
          responseMessage += `\n• **User ID**: ${rawData.user_id}`;
        }
      }
    }

    // Status-specific summary
    if (formatted.enrollmentStatus === 'completed') {
      responseMessage += `\n\n🎉 **Completion Summary**:
This user has successfully completed this ${isLearningPlan ? 'learning plan' : 'course'}.`;
      
      if (!isLearningPlan && formatted.completionDate) {
        responseMessage += `\nCompleted on: ${formatted.completionDate}`;
      }
      
      if (!isLearningPlan && formatted.score !== undefined && formatted.score >= 0) {
        responseMessage += `\nFinal Score: ${formatted.score}`;
      }
    } else if (formatted.enrollmentStatus === 'in_progress') {
      responseMessage += `\n\n📈 **Progress Summary**:
This user is currently working on this ${isLearningPlan ? 'learning plan' : 'course'}.`;
      
      if (!isLearningPlan && formatted.validityEnd) {
        const validityEnd = new Date(formatted.validityEnd);
        const now = new Date();
        const daysRemaining = Math.ceil((validityEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > 0) {
          responseMessage += `\nTime remaining: ${daysRemaining} days`;
        } else if (daysRemaining < 0) {
          responseMessage += `\nExpired ${Math.abs(daysRemaining)} days ago`;
        }
      }
    } else if (formatted.enrollmentStatus === 'not_started') {
      responseMessage += `\n\n⏳ **Status Summary**:
This user is enrolled but has not yet started this ${isLearningPlan ? 'learning plan' : 'course'}.`;
    }

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        user: userDetails,
        found: true,
        enrollmentDetails: formatted,
        rawEnrollmentData: rawData,
        resourceType: resourceType,
        checkType: checkType,
        method: enrollmentCheck.method,
        endpoint: enrollmentCheck.endpoint,
        enhancedFields: {
          courseName: formatted.courseName,
          courseCode: formatted.courseCode,
          courseType: formatted.courseType,
          courseUid: formatted.courseUid,
          enrollmentStatus: formatted.enrollmentStatus,
          enrollmentLevel: formatted.enrollmentLevel,
          assignmentType: formatted.assignmentType,
          enrollmentDate: formatted.enrollmentDate,
          completionDate: formatted.completionDate,
          validityBegin: formatted.validityBegin,
          validityEnd: formatted.validityEnd,
          lastUpdated: formatted.lastUpdated,
          progress: formatted.progress,
          score: formatted.score,
          createdBy: formatted.createdBy
        }
      },
      timestamp: new Date().toISOString()
    });
  }

// REPLACE the existing methods in app/api/chat/handlers/info.ts with these optimized versions

static async handleUserSummary(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { email, userId } = entities;
    const identifier = email || userId;
    
    if (!identifier) {
      return NextResponse.json({
        response: '❌ **Missing Information**: Please provide a user email.\n\n**Example**: "User summary mike@company.com"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📊 OPTIMIZED: Getting user summary for: ${identifier}`);

    // Get user details quickly
    const userDetails = await Promise.race([
      api.getUserDetails(identifier),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User lookup timeout')), 8000)
      )
    ]) as any;

    // Get enrollment counts using OPTIMIZED endpoints
    let enrollmentSummary;
    try {
      enrollmentSummary = await Promise.race([
        this.getOptimizedEnrollmentCounts(userDetails.id, api),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Summary timeout')), 12000)
        )
      ]) as any;
    } catch (error) {
      console.log('❌ Could not get enrollment counts, using fallback');
      enrollmentSummary = {
        totalCourses: 'Unknown',
        totalLearningPlans: 'Unknown',
        recentActivity: 'Unable to fetch'
      };
    }

    // Build summary response
    let responseMessage = `📊 **User Summary**: ${userDetails.fullname}

👤 **Basic Information**:
• **Name**: ${userDetails.fullname}
• **Email**: ${userDetails.email}
• **User ID**: ${userDetails.id}
• **Status**: ${userDetails.status}
• **Level**: ${userDetails.level}
• **Department**: ${userDetails.department}

📚 **Enrollment Summary**:
• **Total Courses**: ${enrollmentSummary.totalCourses}
• **Total Learning Plans**: ${enrollmentSummary.totalLearningPlans}
• **Account Created**: ${userDetails.creationDate}
• **Last Access**: ${userDetails.lastAccess}

🏢 **Organization**:
• **Language**: ${userDetails.language}
• **Timezone**: ${userDetails.timezone}`;

    // Add manager info if available
    try {
      const enhancedDetails = await api.getEnhancedUserDetails(userDetails.id);
      if (enhancedDetails.manager) {
        responseMessage += `\n• **Direct Manager**: ${enhancedDetails.manager.fullname}`;
      }
      
      if (enhancedDetails.additionalFields?.jobTitle) {
        responseMessage += `\n• **Job Title**: ${enhancedDetails.additionalFields.jobTitle}`;
      }
      
      if (enhancedDetails.additionalFields?.location) {
        responseMessage += `\n• **Location**: ${enhancedDetails.additionalFields.location}`;
      }
    } catch (error) {
      console.log('Could not get enhanced details for summary');
    }

    responseMessage += `\n\n💡 **Quick Actions**:
• "User enrollments ${userDetails.email}" - See all enrollments (paginated)
• "Recent enrollments ${userDetails.email}" - Recent activity only
• "Check if ${userDetails.email} is enrolled in [course name]" - Specific checks
• "Load all enrollments in background for ${userDetails.email}" - Complete data`;

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        user: userDetails,
        summary: {
          totalCourses: enrollmentSummary.totalCourses,
          totalLearningPlans: enrollmentSummary.totalLearningPlans,
          lastAccess: userDetails.lastAccess,
          status: userDetails.status
        },
        summaryType: 'user_overview'
      },
      totalCount: 1,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ User summary error:', error);
    
    return NextResponse.json({
      response: `❌ **User Summary Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Alternatives**:
• "Find user ${entities.email || entities.userId}" - Basic user info
• "User enrollments ${entities.email || entities.userId}" - Paginated enrollment list`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

// OPTIMIZED: User enrollments with pages 1-5 limit and better pagination
static async handleUserEnrollments(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { email, userId, loadMore, offset } = entities;
    const identifier = email || userId;
    const currentOffset = parseInt(offset || '0');
    const pageSize = 100; // Items to display per page
    
    console.log(`📚 FIXED PAGINATION: Getting user enrollments: ${identifier} (offset: ${currentOffset}, loadMore: ${loadMore})`);
    
    if (!identifier) {
      return NextResponse.json({
        response: '❌ **Missing Information**: Please provide a user email.\n\n**Example**: "User enrollments mike@company.com"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    // Get user details
    const userDetails = await Promise.race([
      api.getUserDetails(identifier),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User lookup timeout')), 8000)
      )
    ]) as any;
    
    // Get enrollments using FIXED PAGINATION method
    const enrollmentData = await Promise.race([
      this.getFixedPaginationEnrollments(userDetails.id, api, currentOffset, pageSize),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Enrollment fetch timeout')), 20000)
      )
    ]) as any;
    
    // Process and format results
    const displayEnrollments = enrollmentData.enrollments.map((e: any) => ({
      ...e,
      type: e.type || (e.learningPlanName ? 'learning_plan' : 'course')
    }));

    // Sort by enrollment date (most recent first)  
    displayEnrollments.sort((a: any, b: any) => {
      const dateA = new Date(a.enrollmentDate || '1970-01-01');
      const dateB = new Date(b.enrollmentDate || '1970-01-01');
      return dateB.getTime() - dateA.getTime();
    });

    const totalItems = enrollmentData.totalEstimate || displayEnrollments.length;
    const hasMore = enrollmentData.hasMoreData;
    const nextOffset = currentOffset + pageSize;
    const showingStart = currentOffset + 1;
    const showingEnd = Math.min(currentOffset + displayEnrollments.length, totalItems);

    console.log(`📊 PAGINATION INFO: Showing ${showingStart}-${showingEnd} of ${totalItems}, hasMore: ${hasMore}, nextOffset: ${nextOffset}`);

    let responseMessage = `📚 **${userDetails.fullname}'s Enrollments** ${loadMore ? '(Load More)' : '(Optimized)'}

👤 **User**: ${userDetails.fullname} (${userDetails.email})
🆔 **User ID**: ${userDetails.id}
📊 **Status**: ${userDetails.status}

📈 **Summary**:
• **Total Courses**: ${enrollmentData.totalCourses || 'Loading...'}
• **Total Learning Plans**: ${enrollmentData.totalLearningPlans || 'Loading...'}
• **Showing**: Items ${showingStart}-${showingEnd} of ${totalItems}
• **Method**: ${loadMore ? 'Load More Pagination' : 'Pages 1-5 optimized fetch'}`;

    if (displayEnrollments.length > 0) {
      responseMessage += `\n\n📋 **Enrollments**:\n`;
      
      displayEnrollments.forEach((enrollment: any, index: number) => {
        let statusIcon = enrollment.type === 'course' ? '📚' : '📋';
        if (enrollment.enrollmentStatus === 'completed') statusIcon = '✅';
        else if (enrollment.enrollmentStatus === 'in_progress') statusIcon = '🔄';
        else if (enrollment.enrollmentStatus === 'suspended') statusIcon = '🚫';
        else if (enrollment.enrollmentStatus === 'not_started') statusIcon = '⏸️';
        
        const absoluteIndex = currentOffset + index + 1;
        const name = enrollment.type === 'course' ? enrollment.courseName : enrollment.learningPlanName;
        const typeLabel = enrollment.type === 'course' ? 'COURSE' : 'LEARNING PLAN';
        
        let progressInfo = '';
        if (enrollment.type === 'course') {
          progressInfo = enrollment.progress ? ` (${enrollment.progress}%)` : '';
          if (enrollment.score && enrollment.score > 0) {
            progressInfo += ` [Score: ${enrollment.score}]`;
          }
        } else {
          const completed = enrollment.completedCourses || 0;
          const total = enrollment.totalCourses || 0;
          progressInfo = total > 0 ? ` (${completed}/${total} courses)` : '';
        }
        
        responseMessage += `${absoluteIndex}. ${statusIcon} **${enrollment.enrollmentStatus.toUpperCase()}** ${typeLabel}\n`;
        responseMessage += `   📖 ${name}${progressInfo}\n`;
        if (enrollment.enrollmentDate) {
          responseMessage += `   📅 Enrolled: ${enrollment.enrollmentDate}\n`;
        }
        responseMessage += '\n';
      });
    }

    // Add load more section
    if (hasMore) {
      responseMessage += `\n🔄 **Load More Data Available**\n`;
      responseMessage += `💡 **To see more**: "Load more enrollments for ${userDetails.email}"`;
    } else {
      responseMessage += `\n✅ **All Enrollments Shown**\n`;
      responseMessage += `📊 **Total**: ${totalItems} enrollments displayed`;
    }

    // Add optimization info
    responseMessage += `\n\n🔗 **Performance Info**:
• **Fetch Method**: ${loadMore ? 'Offset-based pagination' : 'Optimized API calls (pages 1-5)'}
• **Response Time**: ~10-15 seconds
• **Items Displayed**: ${displayEnrollments.length}
• **Current Range**: ${showingStart}-${showingEnd}`;

    const loadMoreCommand = hasMore ? `Load more enrollments for ${userDetails.email}` : null;

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        user: userDetails,
        enrollments: displayEnrollments,
        pagination: {
          currentOffset: currentOffset,
          pageSize: pageSize,
          totalItems: totalItems,
          hasMore: hasMore,
          nextOffset: nextOffset,
          showingStart: showingStart,
          showingEnd: showingEnd
        },
        summary: {
          totalCourses: enrollmentData.totalCourses,
          totalLearningPlans: enrollmentData.totalLearningPlans,
          totalEnrollments: totalItems
        },
        method: loadMore ? 'load_more_pagination' : 'optimized_pages_1_to_5'
      },
      totalCount: totalItems,
      hasMore: hasMore,
      loadMoreCommand: loadMoreCommand,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ User enrollments error:', error);
    
    return NextResponse.json({
      response: `❌ **User Enrollments Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Quick Alternatives**:
• "User summary ${entities.email || entities.userId}" - Overview with counts
• "Recent enrollments ${entities.email || entities.userId}" - Latest activity
• "Find user ${entities.email || entities.userId}" - User details only`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

// FIXED: New method for proper offset-based pagination
private static async getFixedPaginationEnrollments(userId: string, api: DoceboAPI, offset: number, pageSize: number): Promise<any> {
  console.log(`📚 FIXED PAGINATION: Getting enrollment data for user: ${userId}, offset: ${offset}, pageSize: ${pageSize}`);
  
  // Calculate which API pages we need based on offset
  const apiPageSize = 50; // Items per API call
  const startApiPage = Math.floor(offset / apiPageSize) + 1;
  const endApiPage = Math.floor((offset + pageSize - 1) / apiPageSize) + 1;
  
  console.log(`📄 API Pages needed: ${startApiPage} to ${endApiPage} (offset ${offset}, pageSize ${pageSize})`);
  
  let allCourses: any[] = [];
  let allLearningPlans: any[] = [];
  let hasMoreData = false;
  let totalCourses = 0;
  let totalLearningPlans = 0;
  
  try {
    // Get courses from required pages
    for (let page = startApiPage; page <= Math.min(endApiPage, 5); page++) { // Max 5 pages
      console.log(`📄 Fetching course page ${page}...`);
      
      const courseResult = await api.apiRequest(`/course/v1/courses/enrollments`, 'GET', null, {
        'user_id[]': userId,
        page: page,
        page_size: apiPageSize
      });
      
      if (courseResult?.data?.items?.length > 0) {
        const userEnrollments = courseResult.data.items.filter((e: any) => 
          e.user_id?.toString() === userId.toString()
        );
        allCourses.push(...userEnrollments);
        
        console.log(`📄 Course page ${page}: Found ${userEnrollments.length} enrollments`);
        
        if (courseResult.data?.has_more_data === true) {
          hasMoreData = true;
        }
      }
    }
    
    // Get learning plans from required pages  
    for (let page = startApiPage; page <= Math.min(endApiPage, 5); page++) { // Max 5 pages
      console.log(`📄 Fetching LP page ${page}...`);
      
      const lpResult = await api.apiRequest(`/learningplan/v1/learningplans/enrollments`, 'GET', null, {
        'user_id[]': userId,
        page: page,
        page_size: apiPageSize
      });
      
      if (lpResult?.data?.items?.length > 0) {
        const userEnrollments = lpResult.data.items.filter((e: any) => 
          (e.user_id || e.id_user)?.toString() === userId.toString()
        );
        allLearningPlans.push(...userEnrollments);
        
        console.log(`📄 LP page ${page}: Found ${userEnrollments.length} enrollments`);
      }
    }
    
    totalCourses = allCourses.length;
    totalLearningPlans = allLearningPlans.length;
    
  } catch (error) {
    console.error('❌ Fixed pagination error:', error);
  }
  
  // Format enrollments
  const formattedCourses = allCourses.map(e => ({
    ...api.formatCourseEnrollment(e),
    type: 'course'
  }));
  
  const formattedLPs = allLearningPlans.map(e => ({
    ...api.formatLearningPlanEnrollment(e),
    type: 'learning_plan'
  }));
  
  // Combine and sort all enrollments by date
  const allEnrollments = [...formattedCourses, ...formattedLPs];
  allEnrollments.sort((a: any, b: any) => {
    const dateA = new Date(a.enrollmentDate || '1970-01-01');
    const dateB = new Date(b.enrollmentDate || '1970-01-01');
    return dateB.getTime() - dateA.getTime();
  });
  
  // Extract the requested slice
  const requestedEnrollments = allEnrollments.slice(offset, offset + pageSize);
  const hasMore = allEnrollments.length > (offset + pageSize) || hasMoreData;
  
  console.log(`📊 FIXED PAGINATION RESULT: Total fetched: ${allEnrollments.length}, Requested slice: ${offset}-${offset + pageSize}, Returned: ${requestedEnrollments.length}, HasMore: ${hasMore}`);
  
  return {
    enrollments: requestedEnrollments,
    totalCourses: totalCourses,
    totalLearningPlans: totalLearningPlans,
    totalEstimate: allEnrollments.length,
    hasMoreData: hasMore,
    pagesProcessed: endApiPage - startApiPage + 1
  };
}

static async handleRecentEnrollments(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { email, userId, limit } = entities;
    const identifier = email || userId;
    const enrollmentLimit = limit || 20; // INCREASED from 10 to 20
    
    if (!identifier) {
      return NextResponse.json({
        response: '❌ **Missing Information**: Please provide a user email.\n\n**Example**: "Recent enrollments mike@company.com"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📅 OPTIMIZED: Getting recent enrollments for: ${identifier}, limit: ${enrollmentLimit}`);

    // Get user details
    const userDetails = await api.getUserDetails(identifier);
    
    // Get recent enrollments with OPTIMIZED sorting
    const recentEnrollments = await Promise.race([
      this.getOptimizedRecentEnrollments(userDetails.id, api, enrollmentLimit),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Recent enrollments timeout')), 15000)
      )
    ]) as any;

    let responseMessage = `📅 **Recent Enrollments**: ${userDetails.fullname} (Optimized)

👤 **User**: ${userDetails.fullname} (${userDetails.email})
📊 **Showing**: Last ${enrollmentLimit} enrollments (sorted by enrollment date)

`;

    if (recentEnrollments.length > 0) {
      responseMessage += `📋 **Recent Activity**:\n`;
      
      recentEnrollments.forEach((enrollment: any, index: number) => {
        let statusIcon = enrollment.type === 'course' ? '📚' : '📋';
        if (enrollment.enrollmentStatus === 'completed') statusIcon = '✅';
        else if (enrollment.enrollmentStatus === 'in_progress') statusIcon = '🔄';
        else if (enrollment.enrollmentStatus === 'suspended') statusIcon = '🚫';
        else if (enrollment.enrollmentStatus === 'not_started') statusIcon = '⏸️';
        
        const name = enrollment.type === 'course' ? enrollment.courseName : enrollment.learningPlanName;
        const typeLabel = enrollment.type === 'course' ? 'COURSE' : 'LEARNING PLAN';
        
        responseMessage += `${index + 1}. ${statusIcon} **${enrollment.enrollmentStatus.toUpperCase()}** ${typeLabel}\n`;
        responseMessage += `   📖 ${name}\n`;
        if (enrollment.enrollmentDate) {
          responseMessage += `   📅 Enrolled: ${enrollment.enrollmentDate}\n`;
        }
        responseMessage += '\n';
      });
    } else {
      responseMessage += `📋 **No Recent Enrollments Found**\n\nThis user may not have any recent enrollment activity.`;
    }

    responseMessage += `\n💡 **More Options**:
• "User enrollments ${userDetails.email}" - See all enrollments (paginated)
• "User summary ${userDetails.email}" - Complete overview
• "Load all enrollments in background for ${userDetails.email}" - Complete data

🔗 **Performance**: Optimized with sort_attr=enrollment_created_at`;

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        user: userDetails,
        recentEnrollments: recentEnrollments,
        limit: enrollmentLimit,
        method: 'optimized_sorted_recent'
      },
      totalCount: recentEnrollments.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Recent enrollments error:', error);
    
    return NextResponse.json({
      response: `❌ **Recent Enrollments Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Alternatives**:
• "User summary ${entities.email || entities.userId}" - Basic overview
• "Find user ${entities.email || entities.userId}" - User details only`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

// NEW OPTIMIZED HELPER METHODS

// OPTIMIZED: Get enrollment counts using your suggested endpoints
private static async getOptimizedEnrollmentCounts(userId: string, api: DoceboAPI): Promise<any> {
  console.log(`📊 OPTIMIZED: Getting enrollment counts for user: ${userId}`);
  
  let totalCourses = 0;
  let totalLearningPlans = 0;
  
  // Parallel calls for better performance
  const [courseResult, lpResult] = await Promise.all([
    // Course count using your optimized endpoint
    api.apiRequest(`/course/v1/courses/enrollments`, 'GET', null, {
      'user_id[]': userId
    }).catch(error => {
      console.log('Course count failed:', error);
      return null;
    }),
    
    // Learning plan count using your optimized endpoint
    api.apiRequest(`/learningplan/v1/learningplans/enrollments`, 'GET', null, {
      'user_id[]': userId
    }).catch(error => {
      console.log('LP count failed:', error);
      return null;
    })
  ]);
  
  // Count courses
  if (courseResult?.data?.items) {
    totalCourses = courseResult.data.items.length;
    console.log(`✅ Found ${totalCourses} course enrollments`);
  }
  
  // Count learning plans
  if (lpResult?.data?.items) {
    totalLearningPlans = lpResult.data.items.length;
    console.log(`✅ Found ${totalLearningPlans} learning plan enrollments`);
  }
  
  return {
    totalCourses: totalCourses > 0 ? totalCourses : 'None',
    totalLearningPlans: totalLearningPlans > 0 ? totalLearningPlans : 'None'
  };
}

// OPTIMIZED: Get enrollment data from pages 1-5 max
private static async getOptimizedEnrollmentPages(userId: string, api: DoceboAPI, offset: number, pageSize: number): Promise<any> {
  console.log(`📚 OPTIMIZED: Getting enrollment pages for user: ${userId}, offset: ${offset}, pageSize: ${pageSize}`);
  
  const maxPages = 5; // LIMIT TO 5 PAGES as you suggested
  let allCourses: any[] = [];
  let allLearningPlans: any[] = [];
  let pagesProcessed = 0;
  let hasMorePages = false;
  
  // Get courses (pages 1-5 max)
  try {
    for (let page = 1; page <= maxPages; page++) {
      console.log(`📄 Fetching course page ${page}...`);
      
      const courseResult = await api.apiRequest(`/course/v1/courses/enrollments`, 'GET', null, {
        'user_id[]': userId,
        page: page,
        page_size: 100 // Reasonable page size
      });
      
      if (courseResult?.data?.items?.length > 0) {
        allCourses.push(...courseResult.data.items);
        pagesProcessed++;
        
        // Check if there's more data
        if (courseResult.data?.has_more_data !== true || courseResult.data.items.length < 50) {
          console.log(`✅ Course pagination complete at page ${page}`);
          break;
        }
      } else {
        console.log(`📄 No more course data at page ${page}`);
        break;
      }
      
      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (pagesProcessed >= maxPages) {
      hasMorePages = true;
    }
  } catch (error) {
    console.error('Course pagination error:', error);
  }
  
  // Get learning plans (pages 1-5 max)
  try {
    for (let page = 1; page <= maxPages; page++) {
      console.log(`📄 Fetching LP page ${page}...`);
      
      const lpResult = await api.apiRequest(`/learningplan/v1/learningplans/enrollments`, 'GET', null, {
        'user_id[]': userId,
        page: page,
        page_size: 50
      });
      
      if (lpResult?.data?.items?.length > 0) {
        allLearningPlans.push(...lpResult.data.items);
        
        // Check if there's more data
        if (lpResult.data?.has_more_data !== true || lpResult.data.items.length < 50) {
          console.log(`✅ LP pagination complete at page ${page}`);
          break;
        }
      } else {
        console.log(`📄 No more LP data at page ${page}`);
        break;
      }
      
      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('LP pagination error:', error);
  }
  
  return {
    courses: allCourses,
    learningPlans: allLearningPlans,
    totalCourses: allCourses.length,
    totalLearningPlans: allLearningPlans.length,
    totalEstimate: allCourses.length + allLearningPlans.length,
    pagesProcessed: pagesProcessed,
    hasMorePages: hasMorePages
  };
}

// OPTIMIZED: Get recent enrollments with sorting
private static async getOptimizedRecentEnrollments(userId: string, api: DoceboAPI, limit: number): Promise<any[]> {
  console.log(`📅 OPTIMIZED: Getting recent enrollments for user: ${userId}, limit: ${limit}`);
  
  const recentEnrollments: any[] = [];
  
  // Get recent courses with sorting as you suggested
  try {
    const courseResult = await api.apiRequest(`/course/v1/courses/enrollments`, 'GET', null, {
      'user_id[]': userId,
      sort_attr: 'enrollment_created_at',
      sort_dir: 'desc',
      page_size: Math.min(limit, 100)
    });
    
    if (courseResult?.data?.items?.length > 0) {
      const recentCourses = courseResult.data.items
        .slice(0, limit)
        .map((e: any) => ({
          ...api.formatCourseEnrollment(e),
          type: 'course'
        }));
      
      recentEnrollments.push(...recentCourses);
      console.log(`✅ Found ${recentCourses.length} recent course enrollments`);
    }
  } catch (error) {
    console.log('Recent courses error:', error);
  }
  
  // Get recent learning plans with sorting
  try {
    const lpResult = await api.apiRequest(`/learningplan/v1/learningplans/enrollments`, 'GET', null, {
      'user_id[]': userId,
      sort_attr: 'enrollment_created_at',
      sort_dir: 'desc',
      page_size: Math.min(limit, 100)
    });
    
    if (lpResult?.data?.items?.length > 0) {
      const recentLPs = lpResult.data.items
        .slice(0, Math.floor(limit / 2)) // Balance between courses and LPs
        .map((e: any) => ({
          ...api.formatLearningPlanEnrollment(e),
          type: 'learning_plan'
        }));
      
      recentEnrollments.push(...recentLPs);
      console.log(`✅ Found ${recentLPs.length} recent LP enrollments`);
    }
  } catch (error) {
    console.log('Recent LPs error:', error);
  }
  
  // Sort all by enrollment date and limit
  recentEnrollments.sort((a, b) => {
    const dateA = new Date(a.enrollmentDate || '1970-01-01');
    const dateB = new Date(b.enrollmentDate || '1970-01-01');
    return dateB.getTime() - dateA.getTime();
  });
  
  return recentEnrollments.slice(0, limit);
}

  // New method to get ALL user enrollments across multiple pages
  private static async getAllUserEnrollments(userId: string, api: DoceboAPI): Promise<any> {
    console.log(`🔄 Fetching ALL enrollments for user: ${userId}`);
    const startTime = Date.now();
    
    try {
      // Get all course enrollments
      const allCourseEnrollments = await this.getAllCourseEnrollments(userId, api);
      
      // Get all learning plan enrollments  
      const allLearningPlanEnrollments = await this.getAllLearningPlanEnrollments(userId, api);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Retrieved ${allCourseEnrollments.enrollments.length} courses and ${allLearningPlanEnrollments.enrollments.length} learning plans in ${processingTime}ms`);
      
      return {
        courses: allCourseEnrollments,
        learningPlans: allLearningPlanEnrollments,
        totalCourses: allCourseEnrollments.enrollments.length,
        totalLearningPlans: allLearningPlanEnrollments.enrollments.length,
        success: allCourseEnrollments.success || allLearningPlanEnrollments.success,
        method: 'comprehensive_pagination',
        pagesFetched: allCourseEnrollments.pagesFetched + allLearningPlanEnrollments.pagesFetched,
        processingTime: processingTime
      };
    } catch (error) {
      console.error('❌ Error getting all enrollments:', error);
      return {
        courses: { enrollments: [], totalCount: 0, success: false },
        learningPlans: { enrollments: [], totalCount: 0, success: false },
        totalCourses: 0,
        totalLearningPlans: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getAllCourseEnrollments(userId: string, api: DoceboAPI): Promise<any> {
    console.log(`📚 Fetching all course enrollments for user: ${userId}`);
    
    const endpoints = [
      `/course/v1/courses/enrollments?user_id[]=${userId}`,
      `/course/v1/courses/enrollments?user_id=${userId}`,
      `/learn/v1/enrollments?user_id=${userId}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying course endpoint: ${endpoint}`);
        
        let allEnrollments: any[] = [];
        let currentPage = 1;
        let pagesFetched = 0;
        const maxPages = 50; // Safety limit to prevent infinite loops
        
        while (currentPage <= maxPages) {
          console.log(`📄 Fetching course page ${currentPage}...`);
          
          const result = await api.apiRequest(endpoint, 'GET', null, {
            page: currentPage,
            page_size: 200 // Get as many as possible per page
          });
          
          if (result.data?.items?.length > 0) {
            // Filter for the specific user
            const userEnrollments = result.data.items.filter((enrollment: any) => {
              return enrollment.user_id?.toString() === userId.toString();
            });
            
            allEnrollments.push(...userEnrollments);
            pagesFetched++;
            
            console.log(`📄 Page ${currentPage}: Found ${userEnrollments.length} enrollments (Total: ${allEnrollments.length})`);
            
            // Check if there's more data
            const hasMoreData = result.data?.has_more_data === true || result.data.items.length === 200;
            
            if (!hasMoreData) {
              console.log(`✅ No more course data after page ${currentPage}`);
              break;
            }
            
            currentPage++;
            
            // Small delay to be API-friendly
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } else {
            console.log(`📄 Page ${currentPage}: No items returned, stopping`);
            break;
          }
        }
        
        if (allEnrollments.length > 0) {
          console.log(`✅ Successfully retrieved ${allEnrollments.length} course enrollments from ${endpoint}`);
          return {
            enrollments: allEnrollments,
            totalCount: allEnrollments.length,
            endpoint: endpoint,
            success: true,
            pagesFetched: pagesFetched
          };
        }
        
      } catch (error) {
        console.log(`❌ Course enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    return {
      enrollments: [],
      totalCount: 0,
      endpoint: 'none_available',
      success: false,
      pagesFetched: 0
    };
  }

  private static async getAllLearningPlanEnrollments(userId: string, api: DoceboAPI): Promise<any> {
    console.log(`📋 Fetching all learning plan enrollments for user: ${userId}`);
    
    const endpoints = [
      `/learningplan/v1/learningplans/enrollments?user_id[]=${userId}`,
      `/learningplan/v1/learningplans/enrollments?user_id=${userId}`,
      `/manage/v1/user/${userId}/learningplans`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying learning plan endpoint: ${endpoint}`);
        
        let allEnrollments: any[] = [];
        let currentPage = 1;
        let pagesFetched = 0;
        const maxPages = 50; // Safety limit
        
        while (currentPage <= maxPages) {
          console.log(`📄 Fetching learning plan page ${currentPage}...`);
          
          const result = await api.apiRequest(endpoint, 'GET', null, {
            page: currentPage,
            page_size: 200
          });
          
          let pageEnrollments = [];
          if (result.data?.items) {
            pageEnrollments = result.data.items;
          } else if (Array.isArray(result.data)) {
            pageEnrollments = result.data;
          } else if (Array.isArray(result)) {
            pageEnrollments = result;
          }
          
          if (pageEnrollments.length > 0) {
            // Filter for the specific user
            const userEnrollments = pageEnrollments.filter((enrollment: any) => {
              const enrollmentUserId = enrollment.user_id || enrollment.id_user || enrollment.userId;
              return enrollmentUserId?.toString() === userId.toString();
            });
            
            allEnrollments.push(...userEnrollments);
            pagesFetched++;
            
            console.log(`📄 Page ${currentPage}: Found ${userEnrollments.length} LP enrollments (Total: ${allEnrollments.length})`);
            
            // Check if there's more data - for learning plans, this might be different
            const hasMoreData = result.data?.has_more_data === true || pageEnrollments.length === 200;
            
            if (!hasMoreData) {
              console.log(`✅ No more learning plan data after page ${currentPage}`);
              break;
            }
            
            currentPage++;
            
            // Small delay to be API-friendly
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } else {
            console.log(`📄 Page ${currentPage}: No items returned, stopping`);
            break;
          }
        }
        
        if (allEnrollments.length > 0) {
          console.log(`✅ Successfully retrieved ${allEnrollments.length} learning plan enrollments from ${endpoint}`);
          return {
            enrollments: allEnrollments,
            totalCount: allEnrollments.length,
            endpoint: endpoint,
            success: true,
            pagesFetched: pagesFetched
          };
        }
        
      } catch (error) {
        console.log(`❌ Learning plan enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    return {
      enrollments: [],
      totalCount: 0,
      endpoint: 'none_available',
      success: false,
      pagesFetched: 0
    };
  }

static async handleCourseInfo(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { courseId, courseName } = entities;
    const identifier = courseId || courseName;
    
    if (!identifier) {
      return NextResponse.json({
        response: 'Missing Information: Please provide a course name or ID.\n\nExample: "Course info Python Programming"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 ENHANCED COURSE INFO: Getting detailed course info for: ${identifier}`);
    
    let courseDetails: any = null;
    let searchMethod = '';
    
    // Method 1: Try direct course lookup by ID with multiple endpoints
    if (/^\d+$/.test(identifier)) {
      console.log(`🆔 DIRECT ID LOOKUP: Trying course ID: ${identifier}`);
      
      const directEndpoints = [
        `/learn/v1/courses/${identifier}`,
        `/course/v1/courses/${identifier}`,
        `/manage/v1/course/${identifier}`
      ];
      
      for (const endpoint of directEndpoints) {
        try {
          console.log(`🔍 Trying endpoint: ${endpoint}`);
          const result = await api.apiRequest(endpoint, 'GET');
          if (result.data) {
            courseDetails = result.data;
            searchMethod = `direct_id_${endpoint}`;
            console.log(`✅ Found course via ${endpoint}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} failed:`, error);
          continue;
        }
      }
    }
    
    // Method 2: Search approach with multiple endpoints
    if (!courseDetails) {
      console.log(`🔍 SEARCH APPROACH: Searching for course: ${identifier}`);
      
      const searchEndpoints = [
        {
          endpoint: '/learn/v1/courses',
          params: { search_text: identifier, page_size: 50 }
        },
        {
          endpoint: '/course/v1/courses',
          params: { search_text: identifier, page_size: 50 }
        }
      ];
      
      for (const { endpoint, params } of searchEndpoints) {
        try {
          console.log(`🔍 Searching via: ${endpoint}`);
          const searchResult = await api.apiRequest(endpoint, 'GET', null, params);
          const courses = searchResult.data?.items || [];
          
          if (courses.length > 0) {
            // Find best match
            courseDetails = courses.find((course: any) => {
              const courseName = course.name || course.title || '';
              const courseCode = course.code || '';
              const courseId = course.id?.toString();
              
              // Exact matches
              if (courseId === identifier.toString()) return true;
              if (courseCode === identifier) return true;
              if (courseName.toLowerCase() === identifier.toLowerCase()) return true;
              
              return false;
            });
            
            // If no exact match, try partial match
            if (!courseDetails) {
              courseDetails = courses.find((course: any) => {
                const courseName = course.name || course.title || '';
                return courseName.toLowerCase().includes(identifier.toLowerCase());
              });
            }
            
            // Default to first result if still no match
            if (!courseDetails && courses.length > 0) {
              courseDetails = courses[0];
            }
            
            if (courseDetails) {
              searchMethod = `search_${endpoint}`;
              console.log(`✅ Found course via search: ${searchMethod}`);
              break;
            }
          }
        } catch (error) {
          console.log(`❌ Search endpoint ${endpoint} failed:`, error);
          continue;
        }
      }
    }
    
    if (!courseDetails) {
      throw new Error(`Course not found: ${identifier}`);
    }
    
    // Method 3: Get additional details if we have course ID
    const finalCourseId = courseDetails.id || courseDetails.course_id || courseDetails.idCourse;
    if (finalCourseId && searchMethod.includes('search')) {
      console.log(`🔍 ADDITIONAL DETAILS: Getting more details for course ID: ${finalCourseId}`);
      
      try {
        const detailResult = await api.apiRequest(`/learn/v1/courses/${finalCourseId}`, 'GET');
        if (detailResult.data) {
          // Merge the detailed data with search results
          courseDetails = { ...courseDetails, ...detailResult.data };
          searchMethod += '_with_details';
          console.log(`✅ Enhanced with additional details`);
        }
      } catch (error) {
        console.log(`⚠️ Could not get additional details:`, error);
      }
    }

    // Enhanced field extraction and formatting
    const courseDisplayName = courseDetails.name || courseDetails.title || courseDetails.course_name || 'Unknown Course';
    
    console.log(`📊 COURSE DETAILS FOUND:`, Object.keys(courseDetails));
    
    // Build comprehensive course information response
    let responseMessage = `📚 **Course Information**: ${courseDisplayName}\n\n`;

    // Core Information Section
    responseMessage += `**🔧 Core Details:**\n`;
    responseMessage += `• **Course ID**: ${finalCourseId || 'Not available'}\n`;
    responseMessage += `• **Name**: ${courseDisplayName}\n`;
    
    if (courseDetails.code) {
      responseMessage += `• **Course Code**: ${courseDetails.code}\n`;
    }
    
    if (courseDetails.uidCourse || courseDetails.uid) {
      responseMessage += `• **UID**: ${courseDetails.uidCourse || courseDetails.uid}\n`;
    }

    // Course Type and Status
    const courseType = courseDetails.course_type || courseDetails.type || 'elearning';
    let typeDisplay = this.formatCourseType(courseType);
    responseMessage += `• **Type**: ${typeDisplay}\n`;

    // Enhanced Status Detection
    let status = this.determineCourseStatus(courseDetails);
    responseMessage += `• **Status**: ${status}\n`;

    // Language and Localization
    if (courseDetails.lang_code || courseDetails.language) {
      responseMessage += `• **Language**: ${courseDetails.language || courseDetails.lang_code}\n`;
    }

    // Enrollment Section
    responseMessage += `\n**👥 Enrollment Information:**\n`;
    
    // Enhanced enrollment count detection
    let enrollmentCount = this.getEnrollmentCount(courseDetails);
    responseMessage += `• **Current Enrollments**: ${enrollmentCount}\n`;
    
    if (courseDetails.waiting_list !== undefined) {
      responseMessage += `• **Waiting List**: ${courseDetails.waiting_list}\n`;
    }

    // Self enrollment capability
    if (courseDetails.can_subscribe !== undefined) {
      responseMessage += `• **Self Enrollment**: ${courseDetails.can_subscribe === 1 ? 'Enabled' : 'Disabled'}\n`;
    }
    
    if (courseDetails.subscription_date_start || courseDetails.subscription_date_end) {
      responseMessage += `• **Enrollment Period**: ${courseDetails.subscription_date_start || 'Open'} to ${courseDetails.subscription_date_end || 'Open'}\n`;
    }

    // Course Content and Structure
    responseMessage += `\n**📖 Course Structure:**\n`;
    
    if (courseDetails.credits && courseDetails.credits > 0) {
      responseMessage += `• **Credits**: ${courseDetails.credits}\n`;
    }

    if (courseDetails.category_name || courseDetails.category) {
      responseMessage += `• **Category**: ${courseDetails.category_name || courseDetails.category}\n`;
    }
    
    // Course materials and content
    if (courseDetails.materials_count !== undefined) {
      responseMessage += `• **Learning Materials**: ${courseDetails.materials_count}\n`;
    }
    
    if (courseDetails.sessions_count !== undefined) {
      responseMessage += `• **Sessions**: ${courseDetails.sessions_count}\n`;
    }

    // Timing Information
    responseMessage += `\n**📅 Timeline & Duration:**\n`;
    
    if (courseDetails.creation_date || courseDetails.date_creation) {
      const creationDate = this.formatDate(courseDetails.creation_date || courseDetails.date_creation);
      responseMessage += `• **Created**: ${creationDate}\n`;
    }

    if (courseDetails.last_update || courseDetails.date_modification || courseDetails.modified_on) {
      const updateDate = this.formatDate(courseDetails.last_update || courseDetails.date_modification || courseDetails.modified_on);
      responseMessage += `• **Last Updated**: ${updateDate}\n`;
    }

    // Course duration and completion time
    if (courseDetails.average_completion_time || courseDetails.duration) {
      const duration = courseDetails.average_completion_time || courseDetails.duration;
      if (duration > 0) {
        const formattedDuration = this.formatDuration(duration);
        responseMessage += `• **Average Completion Time**: ${formattedDuration}\n`;
      }
    }
    
    if (courseDetails.estimated_duration) {
      responseMessage += `• **Estimated Duration**: ${courseDetails.estimated_duration} minutes\n`;
    }

    // Completion and Assessment
    responseMessage += `\n**🎯 Assessment & Completion:**\n`;
    
    if (courseDetails.completion_rule || courseDetails.completion_type) {
      responseMessage += `• **Completion Rule**: ${courseDetails.completion_rule || courseDetails.completion_type}\n`;
    }
    
    if (courseDetails.max_attempts !== undefined) {
      responseMessage += `• **Max Attempts**: ${courseDetails.max_attempts === 0 ? 'Unlimited' : courseDetails.max_attempts}\n`;
    }
    
    if (courseDetails.passing_score !== undefined) {
      responseMessage += `• **Passing Score**: ${courseDetails.passing_score}%\n`;
    }

    // E-commerce and Pricing
    if (courseDetails.price !== undefined || courseDetails.selling_price !== undefined) {
      responseMessage += `\n**💰 E-commerce:**\n`;
      const price = courseDetails.price || courseDetails.selling_price;
      responseMessage += `• **Price**: ${price === 0 ? 'Free' : price}\n`;
      
      if (courseDetails.on_sale) {
        responseMessage += `• **On Sale**: Yes\n`;
      }
      
      if (courseDetails.currency) {
        responseMessage += `• **Currency**: ${courseDetails.currency}\n`;
      }
    }

    // Advanced Settings
    responseMessage += `\n**⚙️ Advanced Settings:**\n`;
    
    if (courseDetails.allow_overbooking !== undefined) {
      responseMessage += `• **Allow Overbooking**: ${courseDetails.allow_overbooking ? 'Yes' : 'No'}\n`;
    }

    if (courseDetails.can_enter !== undefined) {
      responseMessage += `• **Can Enter**: ${courseDetails.can_enter ? 'Yes' : 'No'}\n`;
    }
    
    if (courseDetails.show_in_catalog !== undefined) {
      responseMessage += `• **Show in Catalog**: ${courseDetails.show_in_catalog ? 'Yes' : 'No'}\n`;
    }
    
    if (courseDetails.auto_subscribe !== undefined) {
      responseMessage += `• **Auto Subscribe**: ${courseDetails.auto_subscribe ? 'Enabled' : 'Disabled'}\n`;
    }

    // Skills and Competencies
    if (courseDetails.skills && Array.isArray(courseDetails.skills) && courseDetails.skills.length > 0) {
      responseMessage += `\n**🎓 Skills & Competencies:**\n`;
      courseDetails.skills.forEach((skill: any, index: number) => {
        const skillName = skill.title || skill.name || skill;
        responseMessage += `• ${skillName}\n`;
      });
    }

    // Description
    if (courseDetails.description) {
      const cleanDescription = this.cleanDescription(courseDetails.description);
      responseMessage += `\n**📝 Description:**\n${cleanDescription}\n`;
    }

    // Administrative Information
    responseMessage += `\n**👨‍💼 Administration:**\n`;
    
    if (courseDetails.created_by && courseDetails.created_by.fullname) {
      responseMessage += `• **Created by**: ${courseDetails.created_by.fullname}\n`;
    }
    
    if (courseDetails.instructor_name || courseDetails.instructor) {
      responseMessage += `• **Primary Instructor**: ${courseDetails.instructor_name || courseDetails.instructor}\n`;
    }

    // Technical Information
    responseMessage += `\n**🔧 Technical Details:**\n`;
    responseMessage += `• **Search Method**: ${searchMethod}\n`;
    responseMessage += `• **API Endpoint Used**: Multiple endpoints for comprehensive data\n`;
    
    if (courseDetails.version) {
      responseMessage += `• **Version**: ${courseDetails.version}\n`;
    }

    // Additional Custom Fields (if any)
    const customFields = this.extractCustomFields(courseDetails);
    if (Object.keys(customFields).length > 0) {
      responseMessage += `\n**📋 Additional Fields:**\n`;
      Object.entries(customFields).forEach(([key, value]) => {
        responseMessage += `• **${key}**: ${value}\n`;
      });
    }

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        course: courseDetails,
        courseName: courseDisplayName,
        courseId: finalCourseId,
        courseType: courseType,
        status: status,
        enrollmentCount: enrollmentCount,
        searchMethod: searchMethod,
        fieldsFound: Object.keys(courseDetails).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Enhanced course info error:', error);
    
    return NextResponse.json({
      response: `❌ **Course Information Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔍 Search Methods Used:**
• Direct ID lookup via multiple endpoints
• Comprehensive search across course APIs
• Additional detail enhancement when possible

**💡 Common Issues:**
• Course name might not exist or be misspelled
• Course might be unpublished or restricted
• Try using exact course name from search results
• Use course ID for guaranteed exact matching

**📋 Supported Formats:**
• "Course info Python Programming" (by name)
• "Course info 12345" (by ID)
• "Course details Excel Training" (alternative syntax)`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}
  
  // Enhanced Learning Plan Info Handler in app/api/chat/handlers/info.ts

static async handleLearningPlanInfo(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { learningPlanName } = entities;
    
    if (!learningPlanName) {
      return NextResponse.json({
        response: 'Missing Information: Please provide a learning plan name or ID.\n\nExample: "Learning plan info Data Science Program"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 ENHANCED LP INFO: Getting detailed learning plan info for: ${learningPlanName}`);

    let learningPlanDetails: any = null;
    let searchMethod = '';
    
    // Method 1: Try direct learning plan lookup by ID with multiple endpoints
    if (/^\d+$/.test(learningPlanName)) {
      console.log(`🆔 DIRECT LP ID LOOKUP: Trying LP ID: ${learningPlanName}`);
      
      const directEndpoints = [
        `/learningplan/v1/learningplans/${learningPlanName}`,
        `/learn/v1/learningplans/${learningPlanName}`,
        `/manage/v1/learningplan/${learningPlanName}`
      ];
      
      for (const endpoint of directEndpoints) {
        try {
          console.log(`🔍 Trying LP endpoint: ${endpoint}`);
          const result = await api.apiRequest(endpoint, 'GET');
          if (result.data) {
            learningPlanDetails = result.data;
            searchMethod = `direct_id_${endpoint}`;
            console.log(`✅ Found learning plan via ${endpoint}`);
            break;
          }
        } catch (error) {
          console.log(`❌ LP Endpoint ${endpoint} failed:`, error);
          continue;
        }
      }
    }
    
    // Method 2: Search approach with enhanced error handling
    if (!learningPlanDetails) {
      console.log(`🔍 LP SEARCH APPROACH: Searching for learning plan: ${learningPlanName}`);
      
      let searchResult;
      try {
        searchResult = await api.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          search_text: learningPlanName,
          page_size: 50
        });
        searchMethod = 'search_primary';
      } catch (searchError) {
        console.log('⚠️ Primary search failed, trying fallback method...');
        
        // Fallback: Get all and filter manually
        try {
          searchResult = await api.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
            page_size: 100
          });
          
          const allItems = searchResult.data?.items || [];
          const filteredItems = allItems.filter((lp: any) => {
            const name = api.getLearningPlanName(lp).toLowerCase();
            const description = (lp.description || '').toLowerCase();
            const code = (lp.code || '').toLowerCase();
            const searchLower = learningPlanName.toLowerCase();
            
            return name.includes(searchLower) || 
                   description.includes(searchLower) ||
                   code === searchLower;
          });
          
          searchResult = {
            data: {
              items: filteredItems,
              total_count: filteredItems.length
            }
          };
          searchMethod = 'search_fallback_filtered';
        } catch (fallbackError) {
          console.error('❌ All search methods failed:', fallbackError);
          throw new Error(`Learning plan search failed: ${fallbackError}`);
        }
      }
      
      const learningPlans = searchResult.data?.items || [];
      console.log(`📊 Found ${learningPlans.length} learning plans from search`);
      
      if (learningPlans.length === 0) {
        throw new Error(`Learning plan not found: ${learningPlanName}`);
      }

      // Enhanced matching logic
      learningPlanDetails = learningPlans.find((lp: any) => {
        const lpName = api.getLearningPlanName(lp);
        const lpId = (lp.learning_plan_id || lp.id)?.toString();
        const lpCode = lp.code || '';
        
        // Exact matches
        if (lpId === learningPlanName.toString()) return true;
        if (lpName.toLowerCase() === learningPlanName.toLowerCase()) return true;
        if (lpCode.toLowerCase() === learningPlanName.toLowerCase()) return true;
        
        return false;
      });
      
      // If no exact match, try partial match
      if (!learningPlanDetails) {
        learningPlanDetails = learningPlans.find((lp: any) => {
          const lpName = api.getLearningPlanName(lp);
          return lpName.toLowerCase().includes(learningPlanName.toLowerCase());
        });
      }
      
      // Default to first result
      if (!learningPlanDetails) {
        learningPlanDetails = learningPlans[0];
      }
    }
    
    // Method 3: Get additional details if we have LP ID
    const finalLpId = learningPlanDetails.learning_plan_id || learningPlanDetails.id;
    if (finalLpId && searchMethod.includes('search')) {
      console.log(`🔍 LP ADDITIONAL DETAILS: Getting more details for LP ID: ${finalLpId}`);
      
      try {
        const detailResult = await api.apiRequest(`/learningplan/v1/learningplans/${finalLpId}`, 'GET');
        if (detailResult.data) {
          // Merge the detailed data with search results
          learningPlanDetails = { ...learningPlanDetails, ...detailResult.data };
          searchMethod += '_with_details';
          console.log(`✅ LP Enhanced with additional details`);
        }
      } catch (error) {
        console.log(`⚠️ Could not get LP additional details:`, error);
      }
    }
    
    const displayName = api.getLearningPlanName(learningPlanDetails);
    console.log(`📊 LP DETAILS FOUND:`, Object.keys(learningPlanDetails));
    
    // Build comprehensive learning plan information response
    let responseMessage = `📋 **Learning Plan Information**: ${displayName}\n\n`;

    // Core Information
    responseMessage += `**🔧 Core Details:**\n`;
    responseMessage += `• **Learning Plan ID**: ${finalLpId || 'Not available'}\n`;
    responseMessage += `• **Name**: ${displayName}\n`;

    // Code and UUID
    if (learningPlanDetails.code) {
      responseMessage += `• **Code**: ${learningPlanDetails.code}\n`;
    }

    if (learningPlanDetails.uuid) {
      responseMessage += `• **UUID**: ${learningPlanDetails.uuid}\n`;
    }

    // Enhanced Status Detection
    let status = this.determineLearningPlanStatus(learningPlanDetails);
    responseMessage += `• **Status**: ${status}\n`;

    if (learningPlanDetails.is_publishable !== undefined) {
      responseMessage += `• **Is Publishable**: ${learningPlanDetails.is_publishable ? 'Yes' : 'No'}\n`;
    }

    // Enrollment Information
    responseMessage += `\n**👥 Enrollment Information:**\n`;
    
    // Enhanced enrollment count detection
    let enrollmentCount = this.getLearningPlanEnrollmentCount(learningPlanDetails);
    responseMessage += `• **Current Enrollments**: ${enrollmentCount}\n`;

    // Course information within the learning plan
    const courseInfo = this.getLearningPlanCourseInfo(learningPlanDetails);
    if (courseInfo.total > 0) {
      responseMessage += `• **Total Courses**: ${courseInfo.total}\n`;
      if (courseInfo.mandatory > 0) {
        responseMessage += `• **Mandatory Courses**: ${courseInfo.mandatory}\n`;
      }
      if (courseInfo.optional > 0) {
        responseMessage += `• **Optional Courses**: ${courseInfo.optional}\n`;
      }
    }

    // Catalog and channel assignments
    if (learningPlanDetails.assigned_catalogs_count !== undefined) {
      responseMessage += `• **Assigned Catalogs**: ${learningPlanDetails.assigned_catalogs_count}\n`;
    }

    if (learningPlanDetails.assigned_channels_count !== undefined) {
      responseMessage += `• **Assigned Channels**: ${learningPlanDetails.assigned_channels_count}\n`;
    }

    // Timeline Information
    responseMessage += `\n**📅 Timeline:**\n`;
    
    if (learningPlanDetails.created_on || learningPlanDetails.creation_date) {
      const creationDate = this.formatDate(learningPlanDetails.created_on || learningPlanDetails.creation_date);
      responseMessage += `• **Created**: ${creationDate}\n`;
    }

    if (learningPlanDetails.updated_on || learningPlanDetails.last_update) {
      const updateDate = this.formatDate(learningPlanDetails.updated_on || learningPlanDetails.last_update);
      responseMessage += `• **Last Updated**: ${updateDate}\n`;
    }

    // Completion and Duration Settings
    responseMessage += `\n**⏱️ Duration & Completion:**\n`;
    
    if (learningPlanDetails.time_options) {
      if (learningPlanDetails.time_options.days) {
        responseMessage += `• **Validity Period**: ${learningPlanDetails.time_options.days} days\n`;
      }
      
      if (learningPlanDetails.time_options.trigger) {
        responseMessage += `• **Trigger**: ${learningPlanDetails.time_options.trigger}\n`;
      }
    }
    
    if (learningPlanDetails.estimated_duration) {
      responseMessage += `• **Estimated Duration**: ${learningPlanDetails.estimated_duration} minutes\n`;
    }

    // Credits and Certification
    if (learningPlanDetails.credits && learningPlanDetails.credits > 0) {
      responseMessage += `• **Credits**: ${learningPlanDetails.credits}\n`;
    }

    // Settings and Configuration
    responseMessage += `\n**⚙️ Settings:**\n`;
    
    if (learningPlanDetails.show_in_catalog !== undefined) {
      responseMessage += `• **Show in Catalog**: ${learningPlanDetails.show_in_catalog ? 'Yes' : 'No'}\n`;
    }
    
    if (learningPlanDetails.can_subscribe !== undefined) {
      responseMessage += `• **Self Enrollment**: ${learningPlanDetails.can_subscribe ? 'Enabled' : 'Disabled'}\n`;
    }

    // E-commerce information
    if (learningPlanDetails.ecommerce) {
      responseMessage += `\n**💰 E-commerce:**\n`;
      responseMessage += `• **Is Purchasable**: ${learningPlanDetails.ecommerce.is_purchasable ? 'Yes' : 'No'}\n`;
      
      if (learningPlanDetails.ecommerce.price !== undefined && learningPlanDetails.ecommerce.price !== null) {
        responseMessage += `• **Price**: ${learningPlanDetails.ecommerce.price === 0 ? 'Free' : learningPlanDetails.ecommerce.price}\n`;
      }
      
      if (learningPlanDetails.ecommerce.currency) {
        responseMessage += `• **Currency**: ${learningPlanDetails.ecommerce.currency}\n`;
      }
      
      if (learningPlanDetails.ecommerce.on_sale) {
        responseMessage += `• **On Sale**: Yes\n`;
      }
    }

    // Description
    if (learningPlanDetails.description) {
      const cleanDescription = this.cleanDescription(learningPlanDetails.description);
      responseMessage += `\n**📝 Description:**\n${cleanDescription}\n`;
    }

    // Certificate information
    if (learningPlanDetails.certificate) {
      responseMessage += `\n**🏆 Certificate:**\n`;
      responseMessage += `• **Certificate Available**: Yes\n`;
      if (learningPlanDetails.certificate.title) {
        responseMessage += `• **Certificate Title**: ${learningPlanDetails.certificate.title}\n`;
      }
    } else {
      responseMessage += `\n**🏆 Certificate**: Not configured\n`;
    }

    // Administration
    responseMessage += `\n**👨‍💼 Administration:**\n`;
    
    if (learningPlanDetails.created_by && learningPlanDetails.created_by.fullname) {
      responseMessage += `• **Created by**: ${learningPlanDetails.created_by.fullname}\n`;
    }

    if (learningPlanDetails.updated_by && learningPlanDetails.updated_by.fullname) {
      responseMessage += `• **Updated by**: ${learningPlanDetails.updated_by.fullname}\n`;
    }

    // Media and Assets
    if (learningPlanDetails.thumbnail_url) {
      responseMessage += `\n**📸 Media:**\n`;
      responseMessage += `• **Has Thumbnail**: Yes\n`;
    }

    // Access and Deep Links
    if (learningPlanDetails.deeplink && learningPlanDetails.deeplink.hash) {
      responseMessage += `\n**🔗 Access:**\n`;
      responseMessage += `• **Deep Link Available**: Yes\n`;
      responseMessage += `• **Deep Link Hash**: ${learningPlanDetails.deeplink.hash}\n`;
    }

    // Technical Information
    responseMessage += `\n**🔧 Technical Details:**\n`;
    responseMessage += `• **Search Method**: ${searchMethod}\n`;
    responseMessage += `• **API Endpoint Used**: Multiple endpoints for comprehensive data\n`;
    responseMessage += `• **Fields Retrieved**: ${Object.keys(learningPlanDetails).length}\n`;

    // Additional Custom Fields (if any)
    const customFields = this.extractCustomFields(learningPlanDetails);
    if (Object.keys(customFields).length > 0) {
      responseMessage += `\n**📋 Additional Fields:**\n`;
      Object.entries(customFields).forEach(([key, value]) => {
        responseMessage += `• **${key}**: ${value}\n`;
      });
    }

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        learningPlan: learningPlanDetails,
        learningPlanName: displayName,
        learningPlanId: finalLpId,
        status: status,
        enrollmentCount: enrollmentCount,
        searchMethod: searchMethod,
        fieldsFound: Object.keys(learningPlanDetails).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Enhanced learning plan info error:', error);
    
    return NextResponse.json({
      response: `❌ **Learning Plan Information Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔍 Search Methods Used:**
• Direct ID lookup via multiple endpoints
• Comprehensive search with fallback filtering
• Additional detail enhancement when possible

**💡 Common Issues:**
• Learning plan name might not exist or be misspelled
• Learning plan might be in draft status or restricted
• Try using exact learning plan name from search results
• Use learning plan ID for guaranteed exact matching`

      if (query && query.length > 10) {
        responseMessage += `\n\n**Your Query**: "${query}"

For specific help with "${query}", try more specific questions.`;
      }

      responseMessage += `\n\n**🌐 Additional Resources**:
• [Docebo Help Center](https://help.docebo.com)
• [API Documentation](https://help.docebo.com/hc/en-us/sections/360004313314-API)

**💡 Tips**:
• Use exact email addresses for user operations
• Learning plan IDs (like 274) are supported
• All operations provide detailed feedback and error messages`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        helpRequest: true,
        data: {
          query: query,
          helpType: 'docebo_general'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Docebo help error:', error);
      
      return NextResponse.json({
        response: `❌ **Help System Error**: ${error instanceof Error ? error.message : 'Unknown error'}

Please try asking a specific question about Docebo functionality.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
}
