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

  // FIXED: Main handleUserEnrollments method with proper pagination
static async handleUserEnrollments(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { email, userId, loadMore, offset } = entities;
    const identifier = email || userId;
    const currentOffset = parseInt(offset || '0');
    const pageSize = 10; // Show fewer items initially for speed
    
    if (!identifier) {
      return NextResponse.json({
        response: '❌ **Missing Information**: Please provide a user email.\n\n**Example**: "User enrollments mike@company.com"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📚 FAST: Getting user enrollments: ${identifier} (offset: ${currentOffset})`);

    // STEP 1: Get user details quickly (8 second timeout)
    const userDetails = await Promise.race([
      api.getUserDetails(identifier),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User lookup timeout')), 8000)
      )
    ]) as any;
    
    // STEP 2: Try fast enrollment fetch (15 second timeout)
    try {
      const fastResult = await Promise.race([
        this.getFastEnrollmentPage(userDetails.id, api, currentOffset, pageSize),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fast enrollment timeout')), 15000)
        )
      ]) as any;
      
      // STEP 3: Return quick response with what we have
      return this.buildQuickEnrollmentResponse(userDetails, fastResult, currentOffset, pageSize);
      
    } catch (enrollmentError) {
      console.error('❌ Fast enrollment fetch failed:', enrollmentError);
      
      // STEP 4: Suggest background processing for heavy users
      return this.buildTimeoutResponse(userDetails, identifier);
    }

  } catch (error) {
    console.error('❌ User enrollments error:', error);
    
    return NextResponse.json({
      response: `❌ **User Enrollments Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**⚡ Quick Solutions:**
• Try: "Find user ${entities.email || entities.userId}" (basic info only)
• Try: "User summary ${entities.email || entities.userId}" 
• Use CSV export for complete enrollment data`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

// ADD this new method for fast enrollment fetching:
private static async getFastEnrollmentPage(userId: string, api: DoceboAPI, offset: number, pageSize: number) {
  console.log(`⚡ Fast enrollment fetch for user: ${userId}, offset: ${offset}`);
  
  // Method 1: Try fastest endpoint with pagination
  try {
    const result = await api.apiRequest(`/course/v1/courses/enrollments`, 'GET', null, {
      'user_id[]': userId,
      page_size: pageSize,
      page: Math.floor(offset / pageSize) + 1
    });
    
    if (result.data?.items?.length > 0) {
      const userEnrollments = result.data.items.filter((e: any) => 
        e.user_id?.toString() === userId.toString()
      );
      
      console.log(`✅ Fast method found ${userEnrollments.length} enrollments`);
      
      return {
        courses: userEnrollments.map((e: any) => api.formatCourseEnrollment(e)),
        learningPlans: [], // Skip LPs for speed
        totalCourses: userEnrollments.length,
        totalLearningPlans: 0,
        hasMoreData: result.data?.has_more_data === true,
        method: 'fast_courses_only',
        isPartial: true
      };
    }
  } catch (error) {
    console.log('❌ Fast courses method failed:', error);
  }
  
  // Method 2: Fallback to basic user search if fast method fails
  return {
    courses: [],
    learningPlans: [],
    totalCourses: 0,
    totalLearningPlans: 0,
    hasMoreData: false,
    method: 'fallback_empty',
    isPartial: true
  };
}

// ADD this method for quick response building:
private static buildQuickEnrollmentResponse(
  userDetails: any, 
  enrollmentData: any, 
  currentOffset: number, 
  pageSize: number
): NextResponse {
  
  const totalShown = enrollmentData.courses.length;
  const hasMore = enrollmentData.hasMoreData || totalShown >= pageSize;
  
  let responseMessage = `📚 **${userDetails.fullname}'s Enrollments** (Fast Mode)

👤 **User**: ${userDetails.fullname} (${userDetails.email})
🆔 **User ID**: ${userDetails.id}

⚡ **Quick Results**:
• **Courses Shown**: ${totalShown}
• **Method**: ${enrollmentData.method}
• **Showing**: Items ${currentOffset + 1}-${currentOffset + totalShown}`;

  if (enrollmentData.isPartial) {
    responseMessage += `\n\n⚠️ **Partial Results**: Showing courses only for speed`;
  }

  if (totalShown > 0) {
    responseMessage += `\n\n📋 **Enrollments**:\n`;
    
    enrollmentData.courses.forEach((enrollment: any, index: number) => {
      let statusIcon = '📚';
      if (enrollment.enrollmentStatus === 'completed') statusIcon = '✅';
      else if (enrollment.enrollmentStatus === 'in_progress') statusIcon = '🔄';
      else if (enrollment.enrollmentStatus === 'suspended') statusIcon = '🚫';
      else if (enrollment.enrollmentStatus === 'not_started') statusIcon = '⏸️';
      
      const itemNumber = currentOffset + index + 1;
      
      responseMessage += `${itemNumber}. ${statusIcon} **${enrollment.enrollmentStatus.toUpperCase()}** COURSE\n`;
      responseMessage += `   📖 ${enrollment.courseName}\n`;
      if (enrollment.enrollmentDate) {
        responseMessage += `   📅 Enrolled: ${enrollment.enrollmentDate}\n`;
      }
      responseMessage += '\n';
    });
  } else {
    responseMessage += `\n\n📋 **No Enrollments Found** in first page.`;
  }

  // Add load more or background processing suggestions
  if (hasMore) {
    responseMessage += `\n🔄 **More Data Available**\n`;
    responseMessage += `💡 **For Complete Data**: Use background processing\n`;
    responseMessage += `• Try: "Load all enrollments in background for ${userDetails.email}"`;
  }

  const loadMoreCommand = hasMore ? `Load more enrollments for ${userDetails.email}` : null;

  return NextResponse.json({
    response: responseMessage,
    success: true,
    data: {
      user: userDetails,
      enrollments: enrollmentData.courses,
      pagination: {
        currentOffset: currentOffset,
        pageSize: pageSize,
        totalItems: totalShown,
        hasMore: hasMore,
        isPartial: true,
        method: enrollmentData.method
      }
    },
    totalCount: totalShown,
    hasMore: hasMore,
    loadMoreCommand: loadMoreCommand,
    isPartialResult: true,
    timestamp: new Date().toISOString()
  });
}

// ADD this method for timeout responses:
private static buildTimeoutResponse(userDetails: any, identifier: string): NextResponse {
  return NextResponse.json({
    response: `⏱️ **Large Dataset Detected**: ${userDetails.fullname} likely has many enrollments.

👤 **User Found**: ${userDetails.fullname} (${userDetails.email})
🆔 **User ID**: ${userDetails.id}

**🔄 Recommended Solutions:**

**1. Background Processing** (Best for heavy users):
• Use: "Process enrollments in background for ${identifier}"
• Get results via job status checking

**2. Quick Alternatives**:
• "Find user ${identifier}" (user details only)
• "Check if ${identifier} is enrolled in [specific course name]" 
• "User summary ${identifier}"

**3. CSV Export**:
• Use CSV upload feature to export enrollment data
• Process offline for users with 100+ enrollments

**4. Specific Queries**:
• "Show recent enrollments for ${identifier}"
• "Count enrollments for ${identifier}"

💡 **Why This Happens**: Users with 50+ enrollments can take 60+ seconds to process, but Vercel limits us to 30 seconds.`,
    success: false,
    suggestBackgroundProcessing: true,
    backgroundCommand: `Process enrollments in background for ${identifier}`,
    userFound: true,
    userData: {
      id: userDetails.id,
      fullname: userDetails.fullname,
      email: userDetails.email
    },
    timestamp: new Date().toISOString()
  });
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
          response: '❌ **Missing Information**: Please provide a course name or ID.\n\n**Example**: "Course info Python Programming"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseDetails = await api.getCourseDetails(identifier);
      const courseDisplayName = api.getCourseName(courseDetails);
      
      let responseMessage = `📚 **Course Information**: ${courseDisplayName}

🆔 **Course ID**: ${courseDetails.id || courseDetails.course_id || 'Not available'}
📂 **Type**: ${courseDetails.type || courseDetails.course_type || 'Not specified'}
📊 **Status**: ${courseDetails.status || courseDetails.course_status || 'Not specified'}`;

      if (courseDetails.description) {
        const cleanDescription = courseDetails.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        responseMessage += `\n📄 **Description**: ${cleanDescription.length > 200 ? cleanDescription.substring(0, 200) + '...' : cleanDescription}`;
      }

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          course: courseDetails,
          courseName: courseDisplayName
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course info error:', error);
      
      return NextResponse.json({
        response: `❌ **Course Information Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleLearningPlanInfo(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { learningPlanName } = entities;
      
      if (!learningPlanName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: Please provide a learning plan name.\n\n**Example**: "Learning plan info Data Science Program"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanDetails = await api.getLearningPlanDetails(learningPlanName);
      const displayName = api.getLearningPlanName(learningPlanDetails);
      
      let responseMessage = `📋 **Learning Plan Information**: ${displayName}

🆔 **Learning Plan ID**: ${learningPlanDetails.learning_plan_id || learningPlanDetails.id || 'Not available'}`;

      let status = 'Not specified';
      if (learningPlanDetails.is_published === true || learningPlanDetails.is_published === 1) {
        status = 'Published';
      } else if (learningPlanDetails.is_published === false || learningPlanDetails.is_published === 0) {
        status = 'Draft';
      }
      responseMessage += `\n📊 **Status**: ${status}`;

      if (learningPlanDetails.description) {
        const cleanDescription = learningPlanDetails.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        responseMessage += `\n📄 **Description**: ${cleanDescription.length > 200 ? cleanDescription.substring(0, 200) + '...' : cleanDescription}`;
      }

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          learningPlan: learningPlanDetails,
          learningPlanName: displayName
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan info error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Information Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleDoceboHelp(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { query } = entities;
      
      let responseMessage = `🆘 **Docebo Help**

I can help you with various Docebo administration tasks:

**📚 Enrollment Management**:
• "Enroll john@company.com in course Python Programming"
• "Enroll sarah@company.com in learning plan Data Science"
• "Check if user@company.com is enrolled in learning plan 274"

**🔍 Search Functions**:
• "Find user mike@company.com" - Get user details
• "Find Python courses" - Search for courses
• "Find Python learning plans" - Search learning plans

**📊 Information & Status**:
• "User enrollments mike@company.com" - See all enrollments
• "Course info Python Programming" - Get course details
• "Learning plan info Data Science" - Get learning plan details`;

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
