// app/api/chat/handlers/info.ts - Info and details handlers
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

      console.log(`🔍 Checking enrollment: ${email} -> ${resourceName} (${resourceType})`);

      // Find user
      const userDetails = await api.getUserDetails(email);
      
      // Get user's enrollments
      const enrollmentData = await api.getUserAllEnrollments(userDetails.id);
      
      let found = false;
      let enrollmentDetails = null;
      let responseMessage = '';

      if (resourceType === 'learning_plan') {
        // Check learning plan enrollments
        const lpEnrollments = enrollmentData.learningPlans.enrollments;
        enrollmentDetails = lpEnrollments.find((enrollment: any) => {
          const lpName = api.getLearningPlanName(enrollment).toLowerCase();
          return lpName.includes(resourceName.toLowerCase());
        });
        
        if (enrollmentDetails) {
          found = true;
          const formatted = api.formatLearningPlanEnrollment(enrollmentDetails);
          
          responseMessage = `✅ **Enrollment Found**: ${userDetails.fullname}

📋 **Learning Plan**: ${formatted.learningPlanName}
📊 **Status**: ${formatted.enrollmentStatus.toUpperCase()}
📅 **Enrolled**: ${formatted.enrollmentDate || 'Date not available'}
📈 **Progress**: ${formatted.completedCourses || 0}/${formatted.totalCourses || 0} courses completed
${formatted.completionDate ? `🎯 **Completed**: ${formatted.completionDate}` : ''}
${formatted.dueDate ? `⏰ **Due Date**: ${formatted.dueDate}` : ''}`;
        }
      } else {
        // Check course enrollments
        const courseEnrollments = enrollmentData.courses.enrollments;
        enrollmentDetails = courseEnrollments.find((enrollment: any) => {
          const courseName = api.getCourseName(enrollment).toLowerCase();
          return courseName.includes(resourceName.toLowerCase());
        });
        
        if (enrollmentDetails) {
          found = true;
          const formatted = api.formatCourseEnrollment(enrollmentDetails);
          
          responseMessage = `✅ **Enrollment Found**: ${userDetails.fullname}

📚 **Course**: ${formatted.courseName}
📊 **Status**: ${formatted.enrollmentStatus.toUpperCase()}
📅 **Enrolled**: ${formatted.enrollmentDate || 'Date not available'}
📈 **Progress**: ${formatted.progress}%
${formatted.score ? `🎯 **Score**: ${formatted.score}` : ''}
${formatted.completionDate ? `✅ **Completed**: ${formatted.completionDate}` : ''}
${formatted.dueDate ? `⏰ **Due Date**: ${formatted.dueDate}` : ''}`;
        }
      }

      if (!found) {
        responseMessage = `❌ **No Enrollment Found**: ${userDetails.fullname}

👤 **User**: ${userDetails.fullname} (${email})
${resourceType === 'learning_plan' ? '📋' : '📚'} **${resourceType === 'learning_plan' ? 'Learning Plan' : 'Course'}**: ${resourceName}

The user is not currently enrolled in this ${resourceType === 'learning_plan' ? 'learning plan' : 'course'}.

📊 **User's Current Enrollments**: 
• **Courses**: ${enrollmentData.totalCourses}
• **Learning Plans**: ${enrollmentData.totalLearningPlans}

💡 **Next Steps**: 
• "User enrollments ${email}" to see all enrollments
• "Enroll ${email} in ${resourceType === 'learning_plan' ? 'learning plan' : 'course'} ${resourceName}" to enroll`;
      }

      return NextResponse.json({
        response: responseMessage,
        success: found,
        data: {
          user: userDetails,
          found: found,
          enrollmentDetails: enrollmentDetails,
          resourceType: resourceType,
          checkType: checkType,
          totalEnrollments: {
            courses: enrollmentData.totalCourses,
            learningPlans: enrollmentData.totalLearningPlans
          }
        },
        timestamp: new Date().toISOString()
      });

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

      console.log(`📚 Getting user enrollments: ${identifier}`);

      // Get user details
      const userDetails = await api.getUserDetails(identifier);
      
      // Get all enrollments
      const enrollmentData = await api.getUserAllEnrollments(userDetails.id);
      
      let responseMessage = `📚 **${userDetails.fullname}'s Enrollments**

👤 **User**: ${userDetails.fullname} (${userDetails.email})
🆔 **User ID**: ${userDetails.id}
📊 **Status**: ${userDetails.status}

📈 **Summary**:
• **Courses**: ${enrollmentData.totalCourses}
• **Learning Plans**: ${enrollmentData.totalLearningPlans}`;

      // Show courses
      if (enrollmentData.totalCourses > 0) {
        const courseList = enrollmentData.courses.enrollments.slice(0, 15).map((enrollment: any, index: number) => {
          const formatted = api.formatCourseEnrollment(enrollment);
          let statusIcon = '📚';
          if (formatted.enrollmentStatus === 'completed') statusIcon = '✅';
          else if (formatted.enrollmentStatus === 'in_progress') statusIcon = '🔄';
          else if (formatte
