// app/api/chat/handlers/enrollment.ts - Enhanced with better error handling for exact matching

import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';
import { APIResponse } from '../types';

export class EnrollmentHandlers {
  
  static async handleEnrollUserInCourse(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, courseName, assignmentType, startValidity, endValidity } = entities;
      
      if (!email || !courseName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and course name to process enrollment.\n\n**Enhanced Example**: "Enroll john@company.com in course Python Programming with assignment type required from 2024-01-15 to 2024-12-31"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing course enrollment: ${email} -> ${courseName}`);

      // Find user first
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find course with enhanced error handling
      let course;
      try {
        course = await api.findCourseByIdentifier(courseName);
      } catch (courseError) {
        return NextResponse.json({
          response: `❌ **Course Search Error**: ${courseError instanceof Error ? courseError.message : 'Unknown error'}\n\n**💡 Tips for exact matching:**\n• Use the complete, exact course name\n• Check spelling and capitalization\n• Use course ID if you know it (e.g., "12345")\n• If multiple courses exist with similar names, use course ID`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseId = (course.id || course.course_id || course.idCourse).toString();
      const displayCourseName = api.getCourseName(course);

      // Prepare enrollment options with enhanced parameters
      const enrollmentOptions = {
        level: 'student',
        assignmentType: assignmentType || 'required',
        startValidity: startValidity,
        endValidity: endValidity
      };

      // Enroll user
      const enrollmentResult = await api.enrollUserInCourse(user.user_id || user.id, courseId, enrollmentOptions);

      let responseMessage = `✅ **Course Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
📚 **Course**: ${displayCourseName}
🔗 **Course ID**: ${courseId}
📋 **Assignment Type**: ${enrollmentOptions.assignmentType.toUpperCase()}
📅 **Enrolled**: ${new Date().toLocaleDateString()}`;

      // Add validity information if provided
      if (startValidity) {
        responseMessage += `\n📅 **Start Validity**: ${startValidity}`;
      }
      if (endValidity) {
        responseMessage += `\n📅 **End Validity**: ${endValidity}`;
      }

      responseMessage += '\n\nThe user has been successfully enrolled in the course with the specified parameters.';

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          course: {
            id: courseId,
            name: displayCourseName
          },
          enrollmentOptions: enrollmentOptions,
          enrollmentResult: enrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email exists in the system
• Learning plan name is **exact** and matches a single learning plan
• User is currently enrolled in the learning plan
• You have permission to unenroll users from learning plans

**💡 Pro Tip**: For unenrollment operations, exact learning plan name matching is critical to prevent accidental unenrollments from wrong learning plans.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
}❌ **Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email exists in the system
• Course name is **exact** and complete
• Assignment type is "required" or "optional"
• Validity dates are in YYYY-MM-DD format
• End validity is after start validity
• You have permission to enroll users

**💡 Pro Tip**: Use course IDs (numbers) for guaranteed exact matching when dealing with courses that have similar names.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleEnrollUserInLearningPlan(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, learningPlanName, assignmentType, startValidity, endValidity } = entities;
      
      if (!email || !learningPlanName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and learning plan name to process enrollment.\n\n**Enhanced Example**: "Enroll sarah@company.com in learning plan Data Science with assignment type optional from 2024-02-01 to 2024-11-30"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing learning plan enrollment: ${email} -> ${learningPlanName}`);

      // Find user first
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find learning plan with enhanced error handling
      let learningPlan;
      try {
        learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      } catch (lpError) {
        return NextResponse.json({
          response: `❌ **Learning Plan Search Error**: ${lpError instanceof Error ? lpError.message : 'Unknown error'}\n\n**💡 Tips for exact matching:**\n• Use the complete, exact learning plan name\n• Check spelling and capitalization\n• Use learning plan ID if you know it (e.g., "274")\n• If multiple learning plans exist with similar names, use learning plan ID`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      // Prepare enrollment options with enhanced parameters
      const enrollmentOptions = {
        assignmentType: assignmentType || 'required',
        startValidity: startValidity,
        endValidity: endValidity
      };

      // Enroll user
      const enrollmentResult = await api.enrollUserInLearningPlan(user.user_id || user.id, learningPlanId, enrollmentOptions);

      let responseMessage = `✅ **Learning Plan Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
📋 **Learning Plan**: ${displayLearningPlanName}
🔗 **Learning Plan ID**: ${learningPlanId}
📋 **Assignment Type**: ${enrollmentOptions.assignmentType.toUpperCase()}
📅 **Enrolled**: ${new Date().toLocaleDateString()}`;

      // Add validity information if provided
      if (startValidity) {
        responseMessage += `\n📅 **Start Validity**: ${startValidity}`;
      }
      if (endValidity) {
        responseMessage += `\n📅 **End Validity**: ${endValidity}`;
      }

      responseMessage += '\n\nThe user has been successfully enrolled in the learning plan with the specified parameters.';

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          learningPlan: {
            id: learningPlanId,
            name: displayLearningPlanName
          },
          enrollmentOptions: enrollmentOptions,
          enrollmentResult: enrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email exists in the system
• Learning plan name is **exact** and complete
• Assignment type is "required" or "optional"
• Validity dates are in YYYY-MM-DD format
• End validity is after start validity
• You have permission to enroll users in learning plans

**💡 Pro Tip**: Use learning plan IDs (numbers) for guaranteed exact matching when dealing with learning plans that have similar names.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleUnenrollUserFromCourse(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, courseName, action } = entities;
      
      if (!email || !courseName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and course name to process unenrollment.\n\n**Example**: "Unenroll mike@company.com from course Excel Training"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing course unenrollment: ${email} -> ${courseName}`);

      // Find user first
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find course with enhanced error handling
      let course;
      try {
        course = await api.findCourseByIdentifier(courseName);
      } catch (courseError) {
        return NextResponse.json({
          response: `❌ **Course Search Error for Unenrollment**: ${courseError instanceof Error ? courseError.message : 'Unknown error'}\n\n**💡 For unenrollment, exact matching is required:**\n• Use the complete, exact course name\n• Check spelling and capitalization carefully\n• Use course ID if you know it (e.g., "12345")\n• If multiple courses exist with similar names, use course ID`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseId = (course.id || course.course_id || course.idCourse).toString();
      const displayCourseName = api.getCourseName(course);

      // Unenroll user
      const unenrollmentResult = await api.unenrollUserFromCourse(user.user_id || user.id, courseId);

      return NextResponse.json({
        response: `✅ **Course Unenrollment Successful**

👤 **User**: ${user.fullname} (${email})
📚 **Course**: ${displayCourseName}
🔗 **Course ID**: ${courseId}
📅 **Unenrolled**: ${new Date().toLocaleDateString()}

The user has been successfully unenrolled from the course.`,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          course: {
            id: courseId,
            name: displayCourseName
          },
          unenrollmentResult: unenrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course unenrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email exists in the system
• Course name is **exact** and matches a single course
• User is currently enrolled in the course
• You have permission to unenroll users

**💡 Pro Tip**: For unenrollment operations, exact course name matching is critical to prevent accidental unenrollments from wrong courses.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleUnenrollUserFromLearningPlan(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, learningPlanName, action } = entities;
      
      if (!email || !learningPlanName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and learning plan name to process unenrollment.\n\n**Example**: "Remove user@company.com from learning plan Leadership"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing learning plan unenrollment: ${email} -> ${learningPlanName}`);

      // Find user first
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find learning plan with enhanced error handling
      let learningPlan;
      try {
        learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      } catch (lpError) {
        return NextResponse.json({
          response: `❌ **Learning Plan Search Error for Unenrollment**: ${lpError instanceof Error ? lpError.message : 'Unknown error'}\n\n**💡 For unenrollment, exact matching is required:**\n• Use the complete, exact learning plan name\n• Check spelling and capitalization carefully\n• Use learning plan ID if you know it (e.g., "274")\n• If multiple learning plans exist with similar names, use learning plan ID`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      // Unenroll user
      const unenrollmentResult = await api.unenrollUserFromLearningPlan(user.user_id || user.id, learningPlanId);

      return NextResponse.json({
        response: `✅ **Learning Plan Unenrollment Successful**

👤 **User**: ${user.fullname} (${email})
📋 **Learning Plan**: ${displayLearningPlanName}
🔗 **Learning Plan ID**: ${learningPlanId}
📅 **Unenrolled**: ${new Date().toLocaleDateString()}

The user has been successfully unenrolled from the learning plan.`,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          learningPlan: {
            id: learningPlanId,
            name: displayLearningPlanName
          },
          unenrollmentResult: unenrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan unenrollment error:', error);
      
      return NextResponse.json({
        response: `
