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
          else if (formatted.enrollmentStatus === 'suspended') statusIcon = '🚫';
          
          return `${index + 1}. ${statusIcon} **${formatted.enrollmentStatus.toUpperCase()}** - ${formatted.courseName}${formatted.progress ? ` (${formatted.progress}%)` : ''}${formatted.score ? ` [Score: ${formatted.score}]` : ''}`;
        }).join('\n');

        responseMessage += `\n\n📚 **Courses** (${enrollmentData.totalCourses}):\n${courseList}`;
        
        if (enrollmentData.totalCourses > 15) {
          responseMessage += `\n... and ${enrollmentData.totalCourses - 15} more courses`;
        }
      }

      // Show learning plans
      if (enrollmentData.totalLearningPlans > 0) {
        const lpList = enrollmentData.learningPlans.enrollments.slice(0, 10).map((enrollment: any, index: number) => {
          const formatted = api.formatLearningPlanEnrollment(enrollment);
          let statusIcon = '📋';
          if (formatted.enrollmentStatus === 'completed') statusIcon = '✅';
          else if (formatted.enrollmentStatus === 'in_progress') statusIcon = '🔄';
          else if (formatted.enrollmentStatus === 'enrolled') statusIcon = '📝';
          
          const progressText = formatted.totalCourses ? 
            ` (${formatted.completedCourses || 0}/${formatted.totalCourses} courses)` : '';
          
          return `${index + 1}. ${statusIcon} **${formatted.enrollmentStatus.toUpperCase()}** - ${formatted.learningPlanName}${progressText}`;
        }).join('\n');

        responseMessage += `\n\n📋 **Learning Plans** (${enrollmentData.totalLearningPlans}):\n${lpList}`;
        
        if (enrollmentData.totalLearningPlans > 10) {
          responseMessage += `\n... and ${enrollmentData.totalLearningPlans - 10} more learning plans`;
        }
      }

      // Add endpoint information
      responseMessage += `\n\n🔗 **Data Sources**:
• Courses: ${enrollmentData.courses.endpoint || 'Multiple endpoints tried'}
• Learning Plans: ${enrollmentData.learningPlans.endpoint || 'Multiple endpoints tried'}`;

      if (!enrollmentData.success && enrollmentData.totalCourses === 0 && enrollmentData.totalLearningPlans === 0) {
        responseMessage += `\n\n⚠️ **Note**: No enrollment data could be retrieved. This might be due to:
• API endpoint access limitations
• User has no enrollments
• Data structure differences`;
      }

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          user: userDetails,
          enrollments: enrollmentData,
          totalCourses: enrollmentData.totalCourses,
          totalLearningPlans: enrollmentData.totalLearningPlans
        },
        totalCount: enrollmentData.totalCourses + enrollmentData.totalLearningPlans,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ User enrollments error:', error);
      
      return NextResponse.json({
        response: `❌ **User Enrollments Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• User email is correct and exists in the system
• You have permission to view user enrollment data`,
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

      console.log(`📚 Getting course info: ${identifier}`);

      const courseDetails = await api.getCourseDetails(identifier);
      const courseDisplayName = api.getCourseName(courseDetails);
      const courseId = courseDetails.id || courseDetails.course_id || courseDetails.idCourse || 'Not available';
      
      let responseMessage = `📚 **Course Information**: ${courseDisplayName}

🆔 **Course ID**: ${courseId}
📝 **Name**: ${courseDisplayName}
📂 **Type**: ${courseDetails.course_type || courseDetails.type || 'Not specified'}
📊 **Status**: ${courseDetails.status || courseDetails.course_status || 'Not specified'}`;

      // FIXED: Add code field
      if (courseDetails.code) {
        responseMessage += `\n🏷️ **Code**: ${courseDetails.code}`;
      }

      // FIXED: Add language field
      if (courseDetails.language) {
        responseMessage += `\n🌍 **Language**: ${courseDetails.language}`;
      }

      // FIXED: Add description
      if (courseDetails.description) {
        responseMessage += `\n📄 **Description**: ${courseDetails.description.length > 200 ? courseDetails.description.substring(0, 200) + '...' : courseDetails.description}`;
      }

      // FIXED: Add creation date
      if (courseDetails.creation_date) {
        responseMessage += `\n📅 **Created**: ${courseDetails.creation_date}`;
      }

      // FIXED: Add last update date
      if (courseDetails.last_update) {
        responseMessage += `\n🔄 **Last Updated**: ${courseDetails.last_update}`;
      }

      // FIXED: Add duration from average_completion_time
      if (courseDetails.average_completion_time !== undefined) {
        const duration = courseDetails.average_completion_time;
        if (duration > 0) {
          const hours = Math.floor(duration / 60);
          const minutes = duration % 60;
          responseMessage += `\n⏱️ **Average Duration**: ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
        } else {
          responseMessage += `\n⏱️ **Average Duration**: Not available`;
        }
      } else if (courseDetails.duration || courseDetails.estimated_duration) {
        responseMessage += `\n⏱️ **Duration**: ${courseDetails.duration || courseDetails.estimated_duration}`;
      }

      // FIXED: Add created by information
      if (courseDetails.created_by && courseDetails.created_by.fullname) {
        responseMessage += `\n👤 **Created By**: ${courseDetails.created_by.fullname}`;
      }

      // FIXED: Add updated by information
      if (courseDetails.updated_by && courseDetails.updated_by.fullname) {
        responseMessage += `\n✏️ **Updated By**: ${courseDetails.updated_by.fullname}`;
      }

      // FIXED: Add skills information
      if (courseDetails.skills && Array.isArray(courseDetails.skills) && courseDetails.skills.length > 0) {
        const skillNames = courseDetails.skills.map((skill: any) => skill.name || skill.skill_name || 'Unknown Skill').join(', ');
        responseMessage += `\n🎯 **Skills**: ${skillNames}`;
      }

      // FIXED: Add enrollment count
      if (courseDetails.enrolled_count !== undefined) {
        responseMessage += `\n👥 **Enrollments**: ${courseDetails.enrolled_count}`;
      } else if (courseDetails.enrollment_count !== undefined) {
        responseMessage += `\n👥 **Enrollments**: ${courseDetails.enrollment_count}`;
      }

      // FIXED: Add enrollment link
      if (courseDetails.deeplink && courseDetails.deeplink.enabled && courseDetails.deeplink.hash) {
        const enrollmentLink = `https://googlesandbox.docebosaas.com/learn/course/${courseId}/${courseDetails.slug || 'course'}?generatedby=user_id&hash=${courseDetails.deeplink.hash}`;
        responseMessage += `\n🔗 **Enrollment Link**: [Direct Enrollment](${enrollmentLink})`;
      }

      // FIXED: Add course editing URL
      const courseEditUrl = `https://googlesandbox.docebosaas.com/course/edit/${courseId}`;
      responseMessage += `\n⚙️ **Course Management**: [Edit Course](${courseEditUrl})`;

      // Add completion tracking if available
      if (courseDetails.completion_tracking !== undefined) {
        responseMessage += `\n📈 **Completion Tracking**: ${courseDetails.completion_tracking ? 'Enabled' : 'Disabled'}`;
      }

      // Add credits if available
      if (courseDetails.credits || courseDetails.credit) {
        responseMessage += `\n🎓 **Credits**: ${courseDetails.credits || courseDetails.credit}`;
      }

      responseMessage += `\n\n💡 **Next Steps**: 
• "Who is enrolled in ${courseDisplayName}" to see enrollments
• "Enroll [user] in course ${courseDisplayName}" to enroll users
• "Course enrollment statistics for ${courseDisplayName}" for detailed analytics`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          course: courseDetails,
          courseName: courseDisplayName,
          courseId: courseId,
          enrollmentLink: courseDetails.deeplink?.enabled ? `https://googlesandbox.docebosaas.com/learn/course/${courseId}/${courseDetails.slug || 'course'}?generatedby=user_id&hash=${courseDetails.deeplink?.hash}` : null,
          editUrl: `https://googlesandbox.docebosaas.com/course/edit/${courseId}`
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course info error:', error);
      
      return NextResponse.json({
        response: `❌ **Course Information Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• Course name or ID is correct
• Course exists in the system
• You have permission to view course information`,
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

      console.log(`📋 Getting learning plan info: ${learningPlanName}`);

      const learningPlanDetails = await api.getLearningPlanDetails(learningPlanName);
      const displayName = api.getLearningPlanName(learningPlanDetails);
      
      let responseMessage = `📋 **Learning Plan Information**: ${displayName}

🆔 **Learning Plan ID**: ${learningPlanDetails.learning_plan_id || learningPlanDetails.id || 'Not available'}
📝 **Name**: ${displayName}
📊 **Status**: ${learningPlanDetails.status || learningPlanDetails.learning_plan_status || learningPlanDetails.lp_status || 'Not specified'}`;

      if (learningPlanDetails.description) {
        responseMessage += `\n📄 **Description**: ${learningPlanDetails.description.length > 200 ? learningPlanDetails.description.substring(0, 200) + '...' : learningPlanDetails.description}`;
      }

      if (learningPlanDetails.code) {
        responseMessage += `\n🔗 **Code**: ${learningPlanDetails.code}`;
      }

      if (learningPlanDetails.enrollment_count || learningPlanDetails.enrolled_users || learningPlanDetails.total_enrollments) {
        responseMessage += `\n👥 **Enrollments**: ${learningPlanDetails.enrollment_count || learningPlanDetails.enrolled_users || learningPlanDetails.total_enrollments}`;
      }

      if (learningPlanDetails.course_count || learningPlanDetails.total_courses) {
        responseMessage += `\n📚 **Courses**: ${learningPlanDetails.course_count || learningPlanDetails.total_courses}`;
      }

      if (learningPlanDetails.mandatory_courses !== undefined) {
        responseMessage += `\n✅ **Mandatory Courses**: ${learningPlanDetails.mandatory_courses}`;
      }

      if (learningPlanDetails.optional_courses !== undefined) {
        responseMessage += `\n📝 **Optional Courses**: ${learningPlanDetails.optional_courses}`;
      }

      if (learningPlanDetails.validity_start || learningPlanDetails.start_date) {
        responseMessage += `\n📅 **Start Date**: ${learningPlanDetails.validity_start || learningPlanDetails.start_date}`;
      }

      if (learningPlanDetails.validity_end || learningPlanDetails.end_date) {
        responseMessage += `\n📅 **End Date**: ${learningPlanDetails.validity_end || learningPlanDetails.end_date}`;
      }

      if (learningPlanDetails.creation_date || learningPlanDetails.created_at) {
        responseMessage += `\n📅 **Created**: ${learningPlanDetails.creation_date || learningPlanDetails.created_at}`;
      }

      responseMessage += `\n\n💡 **Next Steps**: 
• "Enroll [user] in learning plan ${displayName}" to enroll users
• "Find courses" to search for related courses

*Using endpoint: /learningplan/v1/learningplans*`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          learningPlan: learningPlanDetails,
          learningPlanName: displayName,
          learningPlanId: learningPlanDetails.learning_plan_id || learningPlanDetails.id
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan info error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Information Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• Learning plan name is correct
• Learning plan exists in the system
• You have permission to view learning plan information

*Note*: Using endpoint /learningplan/v1/learningplans`,
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
• "Unenroll mike@company.com from course Excel Training"
• "Remove user@company.com from learning plan Leadership"

**🔍 Search Functions**:
• "Find user mike@company.com" - Get user details
• "Find Python courses" - Search for courses
• "Find Python learning plans" - Search learning plans

**📊 Information & Status**:
• "Check if john@company.com is enrolled in course Python"
• "User enrollments mike@company.com" - See all enrollments
• "Course info Python Programming" - Get course details
• "Learning plan info Data Science" - Get learning plan details

**🔧 System Information**:
• All operations use the Docebo API with proper authentication
• Learning plans use endpoint: /learningplan/v1/learningplans
• User data includes status, department, and access information`;

      if (query && query.length > 10) {
        responseMessage += `\n\n**Your Query**: "${query}"

For specific help with "${query}", try asking more specific questions like:
• "How to enroll users in ${query}"
• "Find courses about ${query}"
• "User permissions for ${query}"`;
      }

      responseMessage += `\n\n**🌐 Additional Resources**:
• [Docebo Help Center](https://help.docebo.com)
• [API Documentation](https://help.docebo.com/hc/en-us/sections/360004313314-API)
• [User Management Guide](https://help.docebo.com/hc/en-us/sections/360004274394-User-Management)

**💡 Tips**:
• Use exact email addresses for user operations
• Course and learning plan names are search-friendly
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
