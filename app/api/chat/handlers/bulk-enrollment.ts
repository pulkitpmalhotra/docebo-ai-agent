// app/api/chat/handlers/bulk-enrollment.ts - Bulk enrollment management
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
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need a list of user emails for bulk enrollment.\n\n**Examples**: \n• "Enroll john@co.com,sarah@co.com,mike@co.com in course Python Programming"\n• "Bulk enroll marketing team in course Excel Training"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      if (!courseName) {
        return NextResponse.json({
          response: '❌ **Missing Course**: Please specify which course to enroll users in.\n\n**Example**: "Enroll john@co.com,sarah@co.com in course Python Programming"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing bulk course enrollment: ${emails.length} users -> ${courseName}`);

      // Find the course first
      let course;
      try {
        course = await api.findCourseByIdentifier(courseName);
      } catch (error) {
        return NextResponse.json({
          response: `❌ **Course Not Found**: "${courseName}"\n\nPlease check the course name and try again.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseId = course.id || course.course_id || course.idCourse;
      const displayCourseName = api.getCourseName(course);

      // Process bulk enrollment
      const result = await this.processBulkEnrollment(
        emails, 
        courseName, 
        'course', 
        api,
        async (userId: string) => await api.enrollUserInCourse(userId, courseId, { level: 'student', assignmentType: 'required' })
      );

      return this.formatBulkResponse(result, displayCourseName, 'course');

    } catch (error) {
      console.error('❌ Bulk course enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Course Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• All email addresses are correct
• Course name is spelled correctly
• You have permission to enroll users
• Users don't already have conflicting enrollments`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleBulkLearningPlanEnrollment(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { emails, learningPlanName } = entities;
      
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

      console.log(`🎯 Processing bulk learning plan enrollment: ${emails.length} users -> ${learningPlanName}`);

      // Find the learning plan first
      let learningPlan;
      try {
        learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      } catch (error) {
        return NextResponse.json({
          response: `❌ **Learning Plan Not Found**: "${learningPlanName}"\n\nPlease check the learning plan name and try again.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanId = learningPlan.learning_plan_id || learningPlan.id;
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      // Process bulk enrollment
      const result = await this.processBulkEnrollment(
        emails, 
        learningPlanName, 
        'learning_plan', 
        api,
        async (userId: string) => await api.enrollUserInLearningPlan(userId, learningPlanId, { assignmentType: 'required' })
      );

      return this.formatBulkResponse(result, displayLearningPlanName, 'learning_plan');

    } catch (error) {
      console.error('❌ Bulk learning plan enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Learning Plan Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• All email addresses are correct
• Learning plan name is spelled correctly
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
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: '❌ **Missing Information**: I need a list of user emails for bulk unenrollment.\n\n**Examples**: \n• "Unenroll john@co.com,sarah@co.com from course Python Programming"\n• "Remove marketing team from learning plan Leadership"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 Processing bulk unenrollment: ${emails.length} users from ${resourceType} ${resourceName}`);

      const result = await this.processBulkUnenrollment(emails, resourceName, resourceType, api);
      return this.formatBulkResponse(result, resourceName, resourceType, 'unenroll');

    } catch (error) {
      console.error('❌ Bulk unenrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

private static async processBulkEnrollment(
  emails: string[], 
  resourceName: string, 
  resourceType: 'course' | 'learning_plan',
  api: DoceboAPI,
  enrollFunction: (userId: string, resourceId: string, options: any) => Promise<any>
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

  console.log(`🔄 FIXED: Processing ${emails.length} bulk enrollments...`);

  // Find the resource first to get its ID
  let resourceId: string;
  try {
    if (resourceType === 'course') {
      const course = await api.findCourseByIdentifier(resourceName);
      resourceId = (course.id || course.course_id || course.idCourse).toString();
    } else {
      const learningPlan = await api.findLearningPlanByIdentifier(resourceName);
      resourceId = (learningPlan.learning_plan_id || learningPlan.id).toString();
    }
    console.log(`📋 FIXED: Found ${resourceType} ID: ${resourceId}`);
  } catch (error) {
    // If resource not found, mark all as failed
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

  // Process enrollments in batches to be API-friendly
  const batchSize = 3;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (email) => {
      try {
        // Find user
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

        // FIXED: Use the corrected enrollment methods based on resource type
        if (resourceType === 'course') {
          await api.enrollUserInCourse(userId, resourceId, { 
            level: 'student', 
            assignmentType: 'required' 
          });
        } else {
          await api.enrollUserInLearningPlan(userId, resourceId, { 
            assignmentType: 'required' 
          });
        }
        
        result.successful.push({
          email: email,
          userId: userId,
          resourceName: resourceName,
          resourceId: resourceId
        });

        console.log(`✅ FIXED: Bulk enrolled: ${email} in ${resourceName}`);

      } catch (error) {
        console.error(`❌ FIXED: Failed to enroll ${email}:`, error);
        result.failed.push({
          email: email,
          error: error instanceof Error ? error.message : 'Enrollment failed',
          resourceName: resourceName
        });
      }
    }));

    // Small delay between batches to be API-friendly
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  result.summary.successful = result.successful.length;
  result.summary.failed = result.failed.length;

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

  // Find resource first to get its ID
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
    // If resource not found, mark all as failed
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

  // Process unenrollments in batches
  const batchSize = 3;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (email) => {
      try {
        // Find user
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

        // FIXED: Use the corrected unenrollment methods based on resource type
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

    // Small delay between batches
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
📈 **Summary**: ${result.summary.successful}/${result.summary.total} users ${actionPastTense} successfully

`;

    // Show successful enrollments
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

    // Show failed enrollments
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

    // Add recommendations
    if (result.failed.length > 0) {
      responseMessage += `💡 **Next Steps**:
• Check failed email addresses for typos
• Verify users exist in the system
• Check for existing enrollment conflicts
• Try individual enrollments for failed users`;
    } else {
      responseMessage += `🎉 **All users successfully ${actionPastTense}!**`;
    }

    responseMessage += `\n\n📅 **Completed**: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;

    return NextResponse.json({
      response: responseMessage,
      success: result.summary.successful > 0,
      data: {
        bulkResult: result,
        resourceName: resourceName,
        resourceType: resourceType,
        action: action
      },
      totalCount: result.summary.total,
      successCount: result.summary.successful,
      failureCount: result.summary.failed,
      timestamp: new Date().toISOString()
    });
  }

  // Utility method to parse email lists from natural language
  static parseEmailList(text: string): string[] {
    // Extract emails from various formats
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    
    // Remove duplicates and return
    return [...new Set(emails.map(email => email.toLowerCase()))];
  }

  // Utility method to detect team/group references
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
