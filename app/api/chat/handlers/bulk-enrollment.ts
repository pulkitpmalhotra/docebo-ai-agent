// app/api/chat/handlers/bulk-enrollment.ts - FIXED with proper method structure

import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';

interface BulkEnrollmentResult {
  successful: Array<{
    email: string;
    userId: string;
    resourceName: string;
    resourceId: string;
  }>;
  failed: Array<{
    email: string;
    error: string;
    resourceName: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class BulkEnrollmentHandlers {
  
  static async handleBulkCourseEnrollment(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { emails, courseName } = entities;
      
      const assignmentType = entities.assignmentType;
      const startValidity = entities.startValidity;
      const endValidity = entities.endValidity;
      
      console.log(`🎯 BULK COURSE: Processing entities:`, { 
        emails, 
        courseName, 
        assignmentType, 
        startValidity, 
        endValidity 
      });
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need a list of user emails for bulk enrollment.\n\n**Examples**: \n• "Enroll john@co.com,sarah@co.com,mike@co.com in course Python Programming"\n• "Bulk enroll marketing team in learning plan Leadership Development with assignment type mandatory"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      if (!courseName) {
        return NextResponse.json({
          response: '❌ **Missing Course**: Please specify which course to enroll users in.\n\n**Example**: "Enroll john@co.com,sarah@co.com in course Python Programming with assignment type mandatory"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 BULK COURSE: Processing bulk course enrollment: ${emails.length} users -> ${courseName}`);

      // Find the course first with EXACT matching
      let course;
      try {
        course = await api.findCourseByIdentifier(courseName);
      } catch (courseError) {
        return NextResponse.json({
          response: `❌ **Course Not Found for Bulk Enrollment**: ${courseError instanceof Error ? courseError.message : 'Unknown error'}

**💡 For bulk operations, exact course matching is critical:**
• Use the complete, exact course name
• Check spelling and capitalization
• Use course ID if you know it (e.g., "12345")
• If multiple courses exist with similar names, use course ID

**⚠️ Important**: Bulk enrollment requires exact matching to prevent enrolling users in the wrong course.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseId = (course.id || course.course_id || course.idCourse).toString();
      const displayCourseName = api.getCourseName(course);

      console.log(`📚 BULK COURSE: Found exact course match "${displayCourseName}" (ID: ${courseId}) for ${emails.length} users`);

      const result = await this.processBulkCourseEnrollment(
        emails, 
        courseId, 
        displayCourseName, 
        api, 
        assignmentType,
        startValidity,
        endValidity
      );

      return this.formatBulkResponse(result, displayCourseName, 'course');

    } catch (error) {
      console.error('❌ Bulk course enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Course Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• All email addresses are correct
• Course name is **exact** and matches exactly one course
• Assignment type is one of: mandatory, required, recommended, optional
• Dates are in YYYY-MM-DD format
• You have permission to enroll users`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleBulkLearningPlanEnrollment(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { emails, learningPlanName } = entities;
      
      console.log(`🎯 BULK LP: Processing entities:`, { emails, learningPlanName });
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need a list of user emails for bulk enrollment.\n\n**Examples**: \n• "Enroll john@co.com,sarah@co.com in learning plan Data Science"\n• "Bulk enroll sales team in learning plan Leadership Development"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      if (!learningPlanName) {
        return NextResponse.json({
          response: '❌ **Missing Learning Plan**: Please specify which learning plan to enroll users in.\n\n**Example**: "Enroll john@co.com,sarah@co.com in learning plan Data Science"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 BULK LP: Processing bulk learning plan enrollment: ${emails.length} users -> ${learningPlanName}`);

      // Find the learning plan first with EXACT matching
      let learningPlan;
      try {
        learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      } catch (lpError) {
        return NextResponse.json({
          response: `❌ **Learning Plan Not Found for Bulk Enrollment**: ${lpError instanceof Error ? lpError.message : 'Unknown error'}

**💡 For bulk operations, exact learning plan matching is critical:**
• Use the complete, exact learning plan name
• Check spelling and capitalization
• Use learning plan ID if you know it (e.g., "274")
• If multiple learning plans exist with similar names, use learning plan ID

**⚠️ Important**: Bulk enrollment requires exact matching to prevent enrolling users in the wrong learning plan.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      console.log(`📋 BULK LP: Found exact learning plan match "${displayLearningPlanName}" (ID: ${learningPlanId}) for ${emails.length} users`);

      const result = await this.processBulkLearningPlanEnrollment(emails, learningPlanId, displayLearningPlanName, api);

      return this.formatBulkResponse(result, displayLearningPlanName, 'learning_plan');

    } catch (error) {
      console.error('❌ Bulk learning plan enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Learning Plan Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• All email addresses are correct
• Learning plan name is **exact** and matches exactly one learning plan
• You have permission to enroll users
• Users don't already have conflicting enrollments`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleBulkUnenrollment(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { emails, resourceName, resourceType } = entities;
      
      console.log(`🎯 BULK UNENROLL: Processing entities:`, { emails, resourceName, resourceType });
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need a list of user emails for bulk unenrollment.\n\n**Examples**: \n• "Remove john@co.com,sarah@co.com from course Excel Training"\n• "Unenroll marketing team from learning plan Old Program"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      if (!resourceName) {
        return NextResponse.json({
          response: '❌ **Missing Resource**: Please specify which course or learning plan to unenroll users from.\n\n**Example**: "Remove john@co.com,sarah@co.com from course Excel Training"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const finalResourceType = resourceType || 'course';
      
      console.log(`🎯 BULK UNENROLL: Processing bulk unenrollment: ${emails.length} users from ${finalResourceType} "${resourceName}"`);

      try {
        if (finalResourceType === 'course') {
          await api.findCourseByIdentifier(resourceName);
        } else {
          await api.findLearningPlanByIdentifier(resourceName);
        }
      } catch (resourceError) {
        return NextResponse.json({
          response: `❌ **${finalResourceType === 'course' ? 'Course' : 'Learning Plan'} Not Found for Bulk Unenrollment**: ${resourceError instanceof Error ? resourceError.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const result = await this.processBulkUnenrollment(emails, resourceName, finalResourceType as 'course' | 'learning_plan', api);

      return this.formatBulkResponse(result, resourceName, finalResourceType as 'course' | 'learning_plan', 'unenroll');

    } catch (error) {
      console.error('❌ Bulk unenrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Private helper methods
  private static async processBulkCourseEnrollment(
    emails: string[], 
    courseId: string, 
    courseName: string,
    api: DoceboAPI,
    assignmentType?: string,
    startValidity?: string,
    endValidity?: string
  ): Promise<BulkEnrollmentResult> {
    const result: BulkEnrollmentResult = {
      successful: [],
      failed: [],
      summary: {
        total: emails.length,
        successful: 0,
        failed: 0
      }
    };

    console.log(`🔄 BULK COURSE: Processing ${emails.length} course enrollments for course ${courseId}`);

    const batchSize = 3;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (email, index) => {
        const globalIndex = i + index + 1;
        console.log(`📧 BULK COURSE [${globalIndex}/${emails.length}]: Processing ${email}`);
        
        try {
          const users = await api.searchUsers(email, 5);
          const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          
          if (!user) {
            console.log(`❌ BULK COURSE [${globalIndex}]: User not found: ${email}`);
            result.failed.push({
              email: email,
              error: 'User not found',
              resourceName: courseName
            });
            return;
          }

          const userId = (user.user_id || user.id).toString();
          console.log(`👤 BULK COURSE [${globalIndex}]: Found user ${user.fullname} (ID: ${userId})`);

          const enrollmentOptions: any = { level: 'student' };
          
          if (assignmentType && assignmentType !== 'none') {
            enrollmentOptions.assignmentType = assignmentType;
          }
          if (startValidity) {
            enrollmentOptions.startValidity = startValidity;
          }
          if (endValidity) {
            enrollmentOptions.endValidity = endValidity;
          }

          await api.enrollUserInCourse(userId, courseId, enrollmentOptions);
          
          result.successful.push({
            email: email,
            userId: userId,
            resourceName: courseName,
            resourceId: courseId
          });

          console.log(`✅ BULK COURSE [${globalIndex}]: Successfully enrolled ${email} in ${courseName}`);

        } catch (error) {
          console.error(`❌ BULK COURSE [${globalIndex}]: Failed to enroll ${email}:`, error);
          result.failed.push({
            email: email,
            error: error instanceof Error ? error.message : 'Enrollment failed',
            resourceName: courseName
          });
        }
      }));

      if (i + batchSize < emails.length) {
        console.log(`⏸️ BULK COURSE: Pausing between batches (processed ${Math.min(i + batchSize, emails.length)}/${emails.length})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    console.log(`📊 BULK COURSE: Completed - ${result.summary.successful}/${result.summary.total} successful enrollments`);
    return result;
  }

  private static async processBulkLearningPlanEnrollment(
    emails: string[], 
    learningPlanId: string, 
    learningPlanName: string,
    api: DoceboAPI
  ): Promise<BulkEnrollmentResult> {
    const result: BulkEnrollmentResult = {
      successful: [],
      failed: [],
      summary: {
        total: emails.length,
        successful: 0,
        failed: 0
      }
    };

    console.log(`🔄 BULK LP: Processing ${emails.length} learning plan enrollments for plan ${learningPlanId}`);

    const batchSize = 3;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (email, index) => {
        const globalIndex = i + index + 1;
        console.log(`📧 BULK LP [${globalIndex}/${emails.length}]: Processing ${email}`);
        
        try {
          const users = await api.searchUsers(email, 5);
          const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          
          if (!user) {
            console.log(`❌ BULK LP [${globalIndex}]: User not found: ${email}`);
            result.failed.push({
              email: email,
              error: 'User not found',
              resourceName: learningPlanName
            });
            return;
          }

          const userId = (user.user_id || user.id).toString();
          console.log(`👤 BULK LP [${globalIndex}]: Found user ${user.fullname} (ID: ${userId})`);

          await api.enrollUserInLearningPlan(userId, learningPlanId, {});
          
          result.successful.push({
            email: email,
            userId: userId,
            resourceName: learningPlanName,
            resourceId: learningPlanId
          });

          console.log(`✅ BULK LP [${globalIndex}]: Successfully enrolled ${email} in ${learningPlanName}`);

        } catch (error) {
          console.error(`❌ BULK LP [${globalIndex}]: Failed to enroll ${email}:`, error);
          result.failed.push({
            email: email,
            error: error instanceof Error ? error.message : 'Enrollment failed',
            resourceName: learningPlanName
          });
        }
      }));

      if (i + batchSize < emails.length) {
        console.log(`⏸️ BULK LP: Pausing between batches (processed ${Math.min(i + batchSize, emails.length)}/${emails.length})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    console.log(`📊 BULK LP: Completed - ${result.summary.successful}/${result.summary.total} successful enrollments`);
    return result;
  }

  private static async processBulkUnenrollment(
    emails: string[],
    resourceName: string,
    resourceType: 'course' | 'learning_plan',
    api: DoceboAPI
  ): Promise<BulkEnrollmentResult> {
    const result: BulkEnrollmentResult = {
      successful: [],
      failed: [],
      summary: {
        total: emails.length,
        successful: 0,
        failed: 0
      }
    };

    let resourceId: string;
    try {
      if (resourceType === 'course') {
        const course = await api.findCourseByIdentifier(resourceName);
        resourceId = (course.id || course.course_id || course.idCourse).toString();
      } else {
        const learningPlan = await api.findLearningPlanByIdentifier(resourceName);
        resourceId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      }
      console.log(`📋 FIXED: Found ${resourceType} ID for unenrollment: ${resourceId}`);
    } catch (error) {
      emails.forEach(email => {
        result.failed.push({
          email: email,
          error: `${resourceType === 'course' ? 'Course' : 'Learning plan'} not found: ${resourceName}`,
          resourceName: resourceName
        });
      });
      result.summary.failed = emails.length;
      return result;
    }

    const batchSize = 3;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (email) => {
        try {
          const users = await api.searchUsers(email, 5);
          const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          
          if (!user) {
            result.failed.push({
              email: email,
              error: 'User not found',
              resourceName: resourceName
            });
            return;
          }

          const userId = (user.user_id || user.id).toString();

          if (resourceType === 'course') {
            await api.unenrollUserFromCourse(userId, resourceId);
          } else {
            await api.unenrollUserFromLearningPlan(userId, resourceId);
          }
          
          result.successful.push({
            email: email,
            userId: userId,
            resourceName: resourceName,
            resourceId: resourceId
          });

          console.log(`✅ FIXED: Bulk unenrolled: ${email} from ${resourceName}`);

        } catch (error) {
          console.error(`❌ FIXED: Failed to unenroll ${email}:`, error);
          result.failed.push({
            email: email,
            error: error instanceof Error ? error.message : 'Unenrollment failed',
            resourceName: resourceName
          });
        }
      }));

      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    return result;
  }

  private static formatBulkResponse(
    result: BulkEnrollmentResult, 
    resourceName: string, 
    resourceType: 'course' | 'learning_plan',
    action: 'enroll' | 'unenroll' = 'enroll'
  ): NextResponse {
    const actionText = action === 'enroll' ? 'Enrollment' : 'Unenrollment';
    const actionPastTense = action === 'enroll' ? 'enrolled' : 'unenrolled';
    const resourceIcon = resourceType === 'course' ? '📚' : '📋';
    const resourceTypeText = resourceType === 'course' ? 'Course' : 'Learning Plan';

    let responseMessage = `📊 **Bulk ${resourceTypeText} ${actionText} Results**

${resourceIcon} **${resourceTypeText}**: ${resourceName}
🎯 **Exact Match Used**: Confirmed single resource match
📈 **Summary**: ${result.summary.successful}/${result.summary.total} users ${actionPastTense} successfully

`;

    if (result.successful.length > 0) {
      responseMessage += `✅ **Successful (${result.successful.length})**:\n`;
      result.successful.slice(0, 10).forEach((success, index) => {
        responseMessage += `${index + 1}. ${success.email}\n`;
      });
      
      if (result.successful.length > 10) {
        responseMessage += `... and ${result.successful.length - 10} more users\n`;
      }
      responseMessage += '\n';
    }

    if (result.failed.length > 0) {
      responseMessage += `❌ **Failed (${result.failed.length})**:\n`;
      result.failed.slice(0, 5).forEach((failure, index) => {
        responseMessage += `${index + 1}. ${failure.email} - ${failure.error}\n`;
      });
      
      if (result.failed.length > 5) {
        responseMessage += `... and ${result.failed.length - 5} more failures\n`;
      }
      responseMessage += '\n';
    }

    if (result.failed.length > 0) {
      responseMessage += `💡 **Next Steps**:
• Check failed email addresses for typos
• Verify users exist in the system
• Check for existing enrollment conflicts
• Try individual enrollments for failed users`;
    } else {
      responseMessage += `🎉 **All users successfully ${actionPastTense}!**

✅ **Exact Matching**: Used precise ${resourceTypeText.toLowerCase()} identification
🚀 **Zero Errors**: All operations completed successfully`;
    }

    responseMessage += `\n\n📅 **Completed**: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;

    return NextResponse.json({
      response: responseMessage,
      success: result.summary.successful > 0,
      data: {
        bulkResult: result,
        resourceName: resourceName,
        resourceType: resourceType,
        action: action,
        exactMatchUsed: true
      },
      totalCount: result.summary.total,
      successCount: result.summary.successful,
      failureCount: result.summary.failed,
      timestamp: new Date().toISOString()
    });
  }

  static parseEmailList(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    return [...new Set(emails.map(email => email.toLowerCase()))];
  }

  static parseTeamReference(text: string): { teamName?: string; emails?: string[] } {
    const teamPatterns = [
      /\b(marketing|sales|hr|engineering|finance|support|admin|management)\s+team\b/i,
      /\b(developers?|managers?|admins?|analysts?)\b/i
    ];

    for (const pattern of teamPatterns) {
      const match = text.match(pattern);
      if (match) {
        return { teamName: match[1] };
      }
    }

    return {};
  }
}
