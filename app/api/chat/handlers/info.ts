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
      const actualCourseId = courseDetails.id || courseDetails.course_id || courseDetails.idCourse || 'Not available';
      
      // DEBUG: Log the full API response to see available fields
      console.log(`📋 FULL COURSE API RESPONSE:`, JSON.stringify(courseDetails, null, 2));
      
      // DEBUG: Show all available fields in the response
      let debugFields = '**🔍 DEBUG - Available API Fields:**\n';
      Object.keys(courseDetails).forEach(key => {
        const value = courseDetails[key];
        const valueType = typeof value;
        const valuePreview = valueType === 'object' && value !== null ? 
          `{${Object.keys(value).slice(0, 3).join(', ')}${Object.keys(value).length > 3 ? '...' : ''}}` :
          valueType === 'string' && value.length > 50 ? 
          `"${value.substring(0, 50)}..."` :
          JSON.stringify(value);
        debugFields += `• **${key}**: ${valueType} = ${valuePreview}\n`;
      });
      
      let responseMessage = `📚 **Course Information**: ${courseDisplayName}

🆔 **Course ID**: ${actualCourseId}
📝 **Name**: ${courseDisplayName}
📂 **Type**: ${courseDetails.course_type || courseDetails.type || 'Not specified'}
📊 **Status**: ${courseDetails.status || courseDetails.course_status || 'Not specified'}`;

      // 1. CODE FIELD
      if (courseDetails.code) {
        responseMessage += `\n🏷️ **Code**: ${courseDetails.code}`;
      } else {
        responseMessage += `\n🏷️ **Code**: Not available (checked: code)`;
      }

      // 2. LANGUAGE FIELD - Enhanced handling
      let languageText = 'Not available';
      if (courseDetails.language) {
        if (typeof courseDetails.language === 'string') {
          languageText = courseDetails.language;
        } else if (typeof courseDetails.language === 'object') {
          languageText = courseDetails.language.name || 
                        courseDetails.language.title || 
                        courseDetails.language.code ||
                        JSON.stringify(courseDetails.language);
        }
        responseMessage += `\n🌍 **Language**: ${languageText}`;
      } else if (courseDetails.lang_code) {
        responseMessage += `\n🌍 **Language**: ${courseDetails.lang_code}`;
      } else {
        responseMessage += `\n🌍 **Language**: Not available (checked: language, lang_code)`;
      }

      // 3. DESCRIPTION
      if (courseDetails.description && courseDetails.description.trim()) {
        responseMessage += `\n📄 **Description**: ${courseDetails.description.length > 200 ? courseDetails.description.substring(0, 200) + '...' : courseDetails.description}`;
      } else {
        responseMessage += `\n📄 **Description**: Not available (checked: description)`;
      }

      // 4. CREATION DATE
      const createdDate = courseDetails.creation_date || 
                         courseDetails.created_at || 
                         courseDetails.date_created ||
                         courseDetails.created ||
                         courseDetails.create_date;
      if (createdDate) {
        responseMessage += `\n📅 **Created**: ${createdDate}`;
      } else {
        responseMessage += `\n📅 **Created**: Not available (checked: creation_date, created_at, date_created, created, create_date)`;
      }

      // 5. LAST UPDATE DATE
      const updatedDate = courseDetails.last_update || 
                         courseDetails.updated_at || 
                         courseDetails.date_updated ||
                         courseDetails.last_modified ||
                         courseDetails.modified_date;
      if (updatedDate) {
        responseMessage += `\n🔄 **Last Updated**: ${updatedDate}`;
      } else {
        responseMessage += `\n🔄 **Last Updated**: Not available (checked: last_update, updated_at, date_updated, last_modified, modified_date)`;
      }

      // 6. DURATION - Enhanced checking
      if (courseDetails.average_completion_time !== undefined && courseDetails.average_completion_time !== null) {
        const duration = courseDetails.average_completion_time;
        if (duration > 0) {
          const hours = Math.floor(duration / 60);
          const minutes = duration % 60;
          responseMessage += `\n⏱️ **Average Duration**: ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
        } else {
          responseMessage += `\n⏱️ **Average Duration**: 0 minutes`;
        }
      } else if (courseDetails.duration) {
        responseMessage += `\n⏱️ **Duration**: ${courseDetails.duration}`;
      } else if (courseDetails.estimated_duration) {
        responseMessage += `\n⏱️ **Duration**: ${courseDetails.estimated_duration}`;
      } else {
        responseMessage += `\n⏱️ **Duration**: Not available (checked: average_completion_time, duration, estimated_duration)`;
      }

      // 7. CREATED BY
      if (courseDetails.created_by) {
        if (typeof courseDetails.created_by === 'object' && courseDetails.created_by.fullname) {
          responseMessage += `\n👤 **Created By**: ${courseDetails.created_by.fullname}`;
        } else if (typeof courseDetails.created_by === 'string') {
          responseMessage += `\n👤 **Created By**: ${courseDetails.created_by}`;
        } else {
          responseMessage += `\n👤 **Created By**: ${JSON.stringify(courseDetails.created_by)}`;
        }
      } else if (courseDetails.creator_name) {
        responseMessage += `\n👤 **Created By**: ${courseDetails.creator_name}`;
      } else {
        responseMessage += `\n👤 **Created By**: Not available (checked: created_by.fullname, created_by, creator_name)`;
      }

      // 8. UPDATED BY
      if (courseDetails.updated_by) {
        if (typeof courseDetails.updated_by === 'object' && courseDetails.updated_by.fullname) {
          responseMessage += `\n✏️ **Updated By**: ${courseDetails.updated_by.fullname}`;
        } else if (typeof courseDetails.updated_by === 'string') {
          responseMessage += `\n✏️ **Updated By**: ${courseDetails.updated_by}`;
        } else {
          responseMessage += `\n✏️ **Updated By**: ${JSON.stringify(courseDetails.updated_by)}`;
        }
      } else if (courseDetails.last_updated_by) {
        responseMessage += `\n✏️ **Updated By**: ${courseDetails.last_updated_by}`;
      } else {
        responseMessage += `\n✏️ **Updated By**: Not available (checked: updated_by.fullname, updated_by, last_updated_by)`;
      }

      // 9. SKILLS
      if (courseDetails.skills && Array.isArray(courseDetails.skills) && courseDetails.skills.length > 0) {
        const skillNames = courseDetails.skills.map((skill: any) => {
          if (typeof skill === 'string') return skill;
          return skill.name || skill.skill_name || skill.title || JSON.stringify(skill);
        }).join(', ');
        responseMessage += `\n🎯 **Skills**: ${skillNames}`;
      } else if (courseDetails.skill_names && Array.isArray(courseDetails.skill_names)) {
        responseMessage += `\n🎯 **Skills**: ${courseDetails.skill_names.join(', ')}`;
      } else {
        responseMessage += `\n🎯 **Skills**: Not available (checked: skills[], skill_names[])`;
      }

      // 10. ENROLLMENTS
      const enrollmentCount = courseDetails.enrolled_count || 
                             courseDetails.enrollment_count || 
                             courseDetails.enrollments || 
                             courseDetails.total_enrollments ||
                             courseDetails.users_enrolled ||
                             courseDetails.user_count;
      if (enrollmentCount !== undefined) {
        responseMessage += `\n👥 **Enrollments**: ${enrollmentCount}`;
      } else {
        responseMessage += `\n👥 **Enrollments**: Not available (checked: enrolled_count, enrollment_count, enrollments, total_enrollments, users_enrolled, user_count)`;
      }

      // 11. ENROLLMENT LINK
      if (courseDetails.deeplink && courseDetails.deeplink.enabled && courseDetails.deeplink.hash) {
        const enrollmentLink = `https://googlesandbox.docebosaas.com/learn/course/${actualCourseId}/${courseDetails.slug || 'course'}?generatedby=user_id&hash=${courseDetails.deeplink.hash}`;
        responseMessage += `\n🔗 **Enrollment Link**: [Direct Enrollment](${enrollmentLink})`;
      } else {
        responseMessage += `\n🔗 **Enrollment Link**: Not available (checked: deeplink.enabled, deeplink.hash)`;
      }

      // 12. COURSE MANAGEMENT URL
      const courseEditUrl = `https://googlesandbox.docebosaas.com/course/edit/${actualCourseId}`;
      responseMessage += `\n⚙️ **Course Management**: [Edit Course](${courseEditUrl})`;

      // Add the debug information
      responseMessage += `\n\n${debugFields}`;

      responseMessage += `\n💡 **Next Steps**: 
• "Who is enrolled in ${courseDisplayName}" to see enrollments
• "Enroll [user] in course ${courseDisplayName}" to enroll users`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          course: courseDetails,
          courseName: courseDisplayName,
          courseId: actualCourseId,
          debug: true
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
