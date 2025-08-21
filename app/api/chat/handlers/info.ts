// app/api/chat/handlers/info.ts - Fixed enrollment checking logic
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
    // Map the status from the API response
    let enrollmentStatus = 'unknown';
    if (enrollment.status) {
      switch (enrollment.status.toLowerCase()) {
        case 'completed':
          enrollmentStatus = 'completed';
          break;
        case 'in progress':
        case 'in_progress':
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
          enrollmentStatus = enrollment.status.toLowerCase().replace(' ', '_');
      }
    } else if (enrollment.status_id) {
      // Map by status ID if available
      switch (enrollment.status_id.toString()) {
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
          enrollmentStatus = `status_${enrollment.status_id}`;
      }
    }

    return {
      courseId: enrollment.course_id?.toString(),
      courseName: enrollment.course_name || 'Unknown Course',
      enrollmentStatus: enrollmentStatus,
      enrollmentDate: enrollment.enrollment_date,
      completionDate: enrollment.date_complete,
      progress: this.calculateProgressFromStatus(enrollmentStatus),
      score: parseFloat(enrollment.score_given || '0'),
      assignmentType: enrollment.assignment_type,
      activeFrom: enrollment.active_from,
      activeUntil: enrollment.active_until,
      userLevel: enrollment.level,
      userStatus: enrollment.user_status,
      statusId: enrollment.status_id,
      levelId: enrollment.level_id,
      userStatusId: enrollment.user_status_id,
      forcedScore: enrollment.forced_score_given
    };
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
    
    let responseMessage = `✅ **Enrollment Found**: ${userDetails.fullname}

${isLearningPlan ? '📋' : '📚'} **${isLearningPlan ? 'Learning Plan' : 'Course'}**: ${isLearningPlan ? formatted.learningPlanName : formatted.courseName}

👤 **User Details**:
• **Name**: ${rawData?.first_name || userDetails.fullname} ${rawData?.last_name || ''}
• **Username**: ${rawData?.username || userDetails.username}
• **Email**: ${rawData?.email || userDetails.email}
• **User Level**: ${rawData?.level || userDetails.level}
• **User Status**: ${rawData?.user_status || userDetails.status}

📊 **Enrollment Details**:
• **Status**: ${formatted.enrollmentStatus.toUpperCase()} ${rawData?.status_id ? `(ID: ${rawData.status_id})` : ''}
• **Assignment Type**: ${rawData?.assignment_type || formatted.assignmentType || 'Not specified'}
• **Enrolled**: ${rawData?.enrollment_date || formatted.enrollmentDate || 'Date not available'}`;

    // Course-specific fields
    if (!isLearningPlan && rawData) {
      if (rawData.active_from) {
        responseMessage += `\n• **Active From**: ${rawData.active_from}`;
      }
      if (rawData.active_until) {
        responseMessage += `\n• **Active Until**: ${rawData.active_until}`;
      }
      if (rawData.date_complete) {
        responseMessage += `\n• **Completed**: ${rawData.date_complete}`;
      }
      if (rawData.score_given !== undefined) {
        responseMessage += `\n• **Score**: ${rawData.score_given}${rawData.forced_score_given ? ' (Forced)' : ''}`;
      }
    }

    // Learning Plan specific fields
    if (isLearningPlan) {
      responseMessage += `\n• **Progress**: ${formatted.completedCourses || 0}/${formatted.totalCourses || 0} courses completed (${formatted.progress || 0}%)`;
      
      if (formatted.timeSpent !== undefined && formatted.timeSpent > 0) {
        responseMessage += `\n• **Time Spent**: ${formatted.timeSpent} minutes`;
      }
      
      if (formatted.validityBegin) {
        responseMessage += `\n• **Validity Period**: ${formatted.validityBegin} to ${formatted.validityEnd || 'No end date'}`;
      }
      
      if (formatted.lastUpdated) {
        responseMessage += `\n• **Last Updated**: ${formatted.lastUpdated}`;
      }
    } else {
      // Course progress and score info
      if (formatted.progress !== undefined) {
        responseMessage += `\n• **Progress**: ${formatted.progress}%`;
      }
    }

    responseMessage += `\n\n🔧 **Technical Details**:
• **Found via**: ${enrollmentCheck.method}`;
    
    if (enrollmentCheck.endpoint) {
      responseMessage += `\n• **API Endpoint**: ${enrollmentCheck.endpoint}`;
    }

    // Additional technical details for debugging
    if (rawData) {
      if (isLearningPlan) {
        if (rawData.learning_plan_id) {
          responseMessage += `\n• **Learning Plan ID**: ${rawData.learning_plan_id}`;
        }
        if (rawData.user_id) {
          responseMessage += `\n• **User ID**: ${rawData.user_id}`;
        }
      } else {
        if (rawData.user_id) {
          responseMessage += `\n• **User ID**: ${rawData.user_id}`;
        }
        if (rawData.level_id) {
          responseMessage += `\n• **Level ID**: ${rawData.level_id}`;
        }
        if (rawData.user_status_id) {
          responseMessage += `\n• **User Status ID**: ${rawData.user_status_id}`;
        }
      }
    }

    // Summary based on completion status
    if (rawData?.status === 'Completed' || formatted.enrollmentStatus === 'completed') {
      responseMessage += `\n\n🎉 **Completion Summary**:
This user has successfully completed this ${isLearningPlan ? 'learning plan' : 'course'}.`;
      
      if (!isLearningPlan && rawData?.date_complete) {
        responseMessage += `\nCompleted on: ${rawData.date_complete}`;
      }
      
      if (!isLearningPlan && rawData?.score_given) {
        responseMessage += `\nFinal Score: ${rawData.score_given}`;
      }
    } else if (rawData?.status === 'In Progress' || formatted.enrollmentStatus === 'in_progress') {
      responseMessage += `\n\n📈 **Progress Summary**:
This user is currently working on this ${isLearningPlan ? 'learning plan' : 'course'}.`;
      
      if (!isLearningPlan && rawData?.active_until) {
        const activeUntil = new Date(rawData.active_until);
        const now = new Date();
        const daysRemaining = Math.ceil((activeUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > 0) {
          responseMessage += `\nTime remaining: ${daysRemaining} days`;
        } else if (daysRemaining < 0) {
          responseMessage += `\nExpired ${Math.abs(daysRemaining)} days ago`;
        }
      }
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
          userName: rawData?.first_name && rawData?.last_name ? `${rawData.first_name} ${rawData.last_name}` : null,
          userLevel: rawData?.level,
          userStatus: rawData?.user_status,
          statusId: rawData?.status_id,
          levelId: rawData?.level_id,
          userStatusId: rawData?.user_status_id,
          assignmentType: rawData?.assignment_type,
          activeFrom: rawData?.active_from,
          activeUntil: rawData?.active_until,
          dateComplete: rawData?.date_complete,
          scoreGiven: rawData?.score_given,
          forcedScoreGiven: rawData?.forced_score_given
        }
      },
      timestamp: new Date().toISOString()
    });
  }

  static async handleUserEnrollments(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, userId } = entities;
      const identifier = email || userId;
      
      if (!identifier) {
        return NextResponse.json({
          response: '❌ **Missing Information**: Please provide a user email.\n\n**Example**: "User enrollments mike@company.com"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const userDetails = await api.getUserDetails(identifier);
      const enrollmentData = await api.getUserAllEnrollments(userDetails.id);
      
      let responseMessage = `📚 **${userDetails.fullname}'s Enrollments**

👤 **User**: ${userDetails.fullname} (${userDetails.email})
📊 **Summary**: ${enrollmentData.totalCourses} courses, ${enrollmentData.totalLearningPlans} learning plans`;

      if (enrollmentData.totalCourses > 0) {
        const courseList = enrollmentData.courses.enrollments.slice(0, 10).map((enrollment: any, index: number) => {
          const formatted = api.formatCourseEnrollment(enrollment);
          return `${index + 1}. ${formatted.enrollmentStatus.toUpperCase()} - ${formatted.courseName}`;
        }).join('\n');

        responseMessage += `\n\n📚 **Courses**:\n${courseList}`;
        
        if (enrollmentData.totalCourses > 10) {
          responseMessage += `\n... and ${enrollmentData.totalCourses - 10} more courses`;
        }
      }

      if (enrollmentData.totalLearningPlans > 0) {
        const lpList = enrollmentData.learningPlans.enrollments.slice(0, 5).map((enrollment: any, index: number) => {
          const formatted = api.formatLearningPlanEnrollment(enrollment);
          return `${index + 1}. ${formatted.enrollmentStatus.toUpperCase()} - ${formatted.learningPlanName}`;
        }).join('\n');

        responseMessage += `\n\n📋 **Learning Plans**:\n${lpList}`;
        
        if (enrollmentData.totalLearningPlans > 5) {
          responseMessage += `\n... and ${enrollmentData.totalLearningPlans - 5} more learning plans`;
        }
      }

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          user: userDetails,
          enrollments: enrollmentData
        },
        totalCount: enrollmentData.totalCourses + enrollmentData.totalLearningPlans,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ User enrollments error:', error);
      
      return NextResponse.json({
        response: `❌ **User Enrollments Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
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
