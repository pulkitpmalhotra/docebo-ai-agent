// app/api/chat/handlers/enrollment.ts - Enrollment management handlers
import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';
import { APIResponse } from '../types';

export class EnrollmentHandlers {
  
  static async handleEnrollUserInCourse(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, courseName, action } = entities;
      
      if (!email || !courseName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and course name to process enrollment.\n\n**Example**: "Enroll john@company.com in course Python Programming"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing course enrollment: ${email} -> ${courseName}`);

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find course
      const course = await api.findCourseByIdentifier(courseName);
      const courseId = course.id || course.course_id || course.idCourse;
      const displayCourseName = api.getCourseName(course);

      // Enroll user
      const enrollmentResult = await api.enrollUserInCourse(user.user_id || user.id, courseId, {
        level: 'student',
        assignmentType: 'required'
      });

      return NextResponse.json({
        response: `✅ **Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
📚 **Course**: ${displayCourseName}
🔗 **Course ID**: ${courseId}
📅 **Enrolled**: ${new Date().toLocaleDateString()}

The user has been successfully enrolled in the course.`,
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
          enrollmentResult: enrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email exists in the system
• Course name is correct
• User doesn't already have an enrollment conflict
• You have permission to enroll users`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleEnrollUserInLearningPlan(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, learningPlanName, action } = entities;
      
      if (!email || !learningPlanName) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need both a user email and learning plan name to process enrollment.\n\n**Example**: "Enroll sarah@company.com in learning plan Data Science"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing learning plan enrollment: ${email} -> ${learningPlanName}`);

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find learning plan
      const learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      const learningPlanId = learningPlan.learning_plan_id || learningPlan.id;
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      // Enroll user
      const enrollmentResult = await api.enrollUserInLearningPlan(user.user_id || user.id, learningPlanId, {
        assignmentType: 'required'
      });

      return NextResponse.json({
        response: `✅ **Learning Plan Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
📋 **Learning Plan**: ${displayLearningPlanName}
🔗 **Learning Plan ID**: ${learningPlanId}
📅 **Enrolled**: ${new Date().toLocaleDateString()}

The user has been successfully enrolled in the learning plan.`,
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
• Learning plan name is correct
• User doesn't already have an enrollment conflict
• You have permission to enroll users in learning plans`,
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

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find course
      const course = await api.findCourseByIdentifier(courseName);
      const courseId = course.id || course.course_id || course.idCourse;
      const displayCourseName = api.getCourseName(course);

      // Unenroll user
      const unenrollmentResult = await api.unenrollUserFromCourse(user.user_id || user.id, courseId);

      return NextResponse.json({
        response: `✅ **Unenrollment Successful**

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
• Course name is correct
• User is currently enrolled in the course
• You have permission to unenroll users`,
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

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}\n\nNo user found with that email address.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find learning plan
      const learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      const learningPlanId = learningPlan.learning_plan_id || learningPlan.id;
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
        response: `❌ **Learning Plan Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email exists in the system
• Learning plan name is correct
• User is currently enrolled in the learning plan
• You have permission to unenroll users from learning plans`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
}
