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
      
      let responseMessage = `📚 **Course Information**: ${courseDisplayName}

🆔 **Course ID**: ${actualCourseId}
📝 **Name**: ${courseDisplayName}
📂 **Type**: ${courseDetails.type || courseDetails.course_type || 'Not specified'}
📊 **Status**: ${courseDetails.status || courseDetails.course_status || 'Not specified'}`;

      // 1. CODE FIELD - ✅ Available as "code"
      if (courseDetails.code) {
        responseMessage += `\n🏷️ **Code**: ${courseDetails.code}`;
      }

      // 2. LANGUAGE FIELD - ✅ Available as "language.name"
      if (courseDetails.language && courseDetails.language.name) {
        responseMessage += `\n🌍 **Language**: ${courseDetails.language.name}`;
      }

      // 3. DESCRIPTION - ✅ Available as "description" (HTML content)
      if (courseDetails.description && courseDetails.description.trim()) {
        // Remove HTML tags and limit length
        const cleanDescription = courseDetails.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        responseMessage += `\n📄 **Description**: ${cleanDescription.length > 300 ? cleanDescription.substring(0, 300) + '...' : cleanDescription}`;
      }

      // 4. CREATION DATE - ✅ Available as "created_on"
      if (courseDetails.created_on) {
        responseMessage += `\n📅 **Created**: ${courseDetails.created_on}`;
      }

      // 5. LAST UPDATE DATE - ✅ Available as "updated_on"
      if (courseDetails.updated_on) {
        responseMessage += `\n🔄 **Last Updated**: ${courseDetails.updated_on}`;
      }

      // 6. DURATION - ✅ Available as "average_completion_time"
      if (courseDetails.average_completion_time !== undefined && courseDetails.average_completion_time !== null) {
        if (courseDetails.average_completion_time > 0) {
          const duration = courseDetails.average_completion_time;
          const hours = Math.floor(duration / 60);
          const minutes = duration % 60;
          responseMessage += `\n⏱️ **Average Duration**: ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
        } else {
          responseMessage += `\n⏱️ **Average Duration**: Not set (0 minutes)`;
        }
      }

      // 7. CREATED BY - ✅ Available as "created_by.fullname"
      if (courseDetails.created_by && courseDetails.created_by.fullname) {
        responseMessage += `\n👤 **Created By**: ${courseDetails.created_by.fullname}`;
      }

      // 8. UPDATED BY - ✅ Available in "update_data.updated_by" (but may be null)
      if (courseDetails.update_data && courseDetails.update_data.updated_by) {
        responseMessage += `\n✏️ **Updated By**: ${courseDetails.update_data.updated_by}`;
      } else {
        responseMessage += `\n✏️ **Updated By**: System/Automated`;
      }

      // 9. SKILLS - ✅ Available as "skills[].name"
      if (courseDetails.skills && Array.isArray(courseDetails.skills) && courseDetails.skills.length > 0) {
        const skillNames = courseDetails.skills.map((skill: any) => skill.name).join(', ');
        responseMessage += `\n🎯 **Skills**: ${skillNames}`;
      }

      // 10. CATEGORY - ✅ Available as "category.name" and "category.path"
      if (courseDetails.category) {
        responseMessage += `\n📁 **Category**: ${courseDetails.category.name}`;
        if (courseDetails.category.path && Array.isArray(courseDetails.category.path)) {
          responseMessage += ` (${courseDetails.category.path.join(' > ')})`;
        }
      }

      // 11. CREDITS - ✅ Available as "credits"
      if (courseDetails.credits !== undefined) {
        responseMessage += `\n🎓 **Credits**: ${courseDetails.credits}`;
      }

      // 12. UID - ✅ Available as "uid"
      if (courseDetails.uid) {
        responseMessage += `\n🔗 **Course UID**: ${courseDetails.uid}`;
      }

      // 13. ENROLLMENT LINK - ✅ Available as "enrollment_options.deeplink"
      if (courseDetails.enrollment_options && 
          courseDetails.enrollment_options.deeplink && 
          courseDetails.enrollment_options.deeplink.enabled && 
          courseDetails.enrollment_options.deeplink.hash) {
        const enrollmentLink = `https://googlesandbox.docebosaas.com/learn/course/${actualCourseId}/${courseDetails.slug_name || 'course'}?generatedby=user_id&hash=${courseDetails.enrollment_options.deeplink.hash}`;
        responseMessage += `\n🔗 **Enrollment Link**: [Direct Enrollment](${enrollmentLink})`;
      }

      // 14. COURSE ADMIN URL
      const courseEditUrl = `https://googlesandbox.docebosaas.com/course/edit/${actualCourseId}`;
      responseMessage += `\n⚙️ **Course Admin URL**: [Edit Course](${courseEditUrl})`;

      // 15. SELF ENROLLMENT - ✅ Available in "catalog_options.self_enrollment"
      if (courseDetails.catalog_options && courseDetails.catalog_options.self_enrollment) {
        const selfEnroll = courseDetails.catalog_options.self_enrollment;
        responseMessage += `\n📝 **Self Enrollment**: ${selfEnroll.mode} (${selfEnroll.policy})`;
      }

      // 16. DURATION SETTINGS - ✅ Available in "time_options.duration"
      if (courseDetails.time_options && courseDetails.time_options.duration) {
        const duration = courseDetails.time_options.duration;
        if (duration.days > 0) {
          responseMessage += `\n📅 **Course Duration**: ${duration.days} days (from ${duration.trigger})`;
        }
      }

      // 17. RATING - ✅ Available in "rating"
      if (courseDetails.rating) {
        responseMessage += `\n⭐ **Rating**: ${courseDetails.rating.enabled ? 'Enabled' : 'Disabled'}`;
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
          courseId: actualCourseId,
          enrollmentLink: courseDetails.enrollment_options?.deeplink?.enabled ? 
            `https://googlesandbox.docebosaas.com/learn/course/${actualCourseId}/${courseDetails.slug_name || 'course'}?generatedby=user_id&hash=${courseDetails.enrollment_options.deeplink.hash}` : null,
          editUrl: `https://googlesandbox.docebosaas.com/course/edit/${actualCourseId}`
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
      const actualLearningPlanId = learningPlanDetails.learning_plan_id || learningPlanDetails.id || 'Not available';
      
      let responseMessage = `📋 **Learning Plan Information**: ${displayName}

🆔 **Learning Plan ID**: ${actualLearningPlanId}
📝 **Name**: ${displayName}`;

      // 1. STATUS FIELD - Enhanced mapping based on API structure
      let status = 'Not specified';
      if (learningPlanDetails.is_published === true || learningPlanDetails.is_published === 1) {
        status = 'Published';
      } else if (learningPlanDetails.is_published === false || learningPlanDetails.is_published === 0) {
        status = 'Draft';
      } else if (learningPlanDetails.status === 'active' || learningPlanDetails.status === '2') {
        status = 'Published';
      } else if (learningPlanDetails.status === 'inactive' || learningPlanDetails.status === '0') {
        status = 'Draft';
      } else if (learningPlanDetails.status) {
        status = learningPlanDetails.status;
      }
      responseMessage += `\n📊 **Status**: ${status}`;

      // 2. DESCRIPTION FIELD - Clean HTML content
      if (learningPlanDetails.description && learningPlanDetails.description.trim()) {
        const cleanDescription = learningPlanDetails.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        responseMessage += `\n📄 **Description**: ${cleanDescription.length > 300 ? cleanDescription.substring(0, 300) + '...' : cleanDescription}`;
      }

      // 3. CODE FIELD
      if (learningPlanDetails.code) {
        responseMessage += `\n🏷️ **Code**: ${learningPlanDetails.code}`;
      }

      // 4. UUID FIELD
      if (learningPlanDetails.uuid) {
        responseMessage += `\n🔗 **UUID**: ${learningPlanDetails.uuid}`;
      }

      // 5. LANGUAGE FIELD - Enhanced mapping
      if (learningPlanDetails.language && learningPlanDetails.language.name) {
        responseMessage += `\n🌍 **Language**: ${learningPlanDetails.language.name}`;
      } else if (learningPlanDetails.lang_code) {
        const languageMap: Record<string, string> = {
          'english': 'English',
          'spanish': 'Spanish',
          'french': 'French',
          'german': 'German',
          'italian': 'Italian',
          'portuguese': 'Portuguese'
        };
        responseMessage += `\n🌍 **Language**: ${languageMap[learningPlanDetails.lang_code] || learningPlanDetails.lang_code}`;
      } else if (learningPlanDetails.language) {
        responseMessage += `\n🌍 **Language**: ${learningPlanDetails.language}`;
      }

      // 6. CREATION DATE - Multiple possible field names
      const creationDate = learningPlanDetails.created_on ||
                          learningPlanDetails.creation_date || 
                          learningPlanDetails.created_at ||
                          learningPlanDetails.date_created ||
                          learningPlanDetails.create_date;
      if (creationDate) {
        responseMessage += `\n📅 **Created**: ${creationDate}`;
      }

      // 7. LAST UPDATE DATE
      const updateDate = learningPlanDetails.updated_on ||
                        learningPlanDetails.last_update ||
                        learningPlanDetails.updated_at ||
                        learningPlanDetails.date_modified ||
                        learningPlanDetails.last_edit_date;
      if (updateDate) {
        responseMessage += `\n🔄 **Last Updated**: ${updateDate}`;
      }

      // 8. AVERAGE DURATION - Time options
      if (learningPlanDetails.time_options && learningPlanDetails.time_options.days) {
        responseMessage += `\n⏱️ **Duration**: ${learningPlanDetails.time_options.days} days`;
      } else if (learningPlanDetails.duration) {
        responseMessage += `\n⏱️ **Duration**: ${learningPlanDetails.duration}`;
      } else if (learningPlanDetails.average_completion_time) {
        const duration = learningPlanDetails.average_completion_time;
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        responseMessage += `\n⏱️ **Average Duration**: ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
      }

      // 9. CREATED BY - Author information
      if (learningPlanDetails.created_by && learningPlanDetails.created_by.fullname) {
        responseMessage += `\n👤 **Created By**: ${learningPlanDetails.created_by.fullname}`;
      } else if (learningPlanDetails.author && learningPlanDetails.author.fullname) {
        responseMessage += `\n👤 **Created By**: ${learningPlanDetails.author.fullname}`;
      } else if (learningPlanDetails.author) {
        responseMessage += `\n👤 **Created By**: ${learningPlanDetails.author}`;
      }

      // 10. UPDATED BY
      if (learningPlanDetails.updated_by && learningPlanDetails.updated_by.fullname) {
        responseMessage += `\n✏️ **Updated By**: ${learningPlanDetails.updated_by.fullname}`;
      } else if (learningPlanDetails.last_edit_by) {
        responseMessage += `\n✏️ **Updated By**: ${learningPlanDetails.last_edit_by}`;
      }

      // 11. ENROLLMENT STATISTICS - Get from separate API call
      try {
        console.log(`📊 Getting enrollment statistics for learning plan ${actualLearningPlanId}`);
        const enrollmentStats = await api.apiRequest(`/learningplan/v1/learningplans/${actualLearningPlanId}/enrollments`, 'GET', null, {
          page_size: 1 // Just get count, not full data
        });
        
        if (enrollmentStats.data && enrollmentStats.data.count !== undefined) {
          responseMessage += `\n👥 **Current Enrollments**: ${enrollmentStats.data.count}`;
        } else if (enrollmentStats.data && enrollmentStats.data.items) {
          responseMessage += `\n👥 **Current Enrollments**: ${enrollmentStats.data.items.length}`;
        }
      } catch (enrollmentError) {
        console.log(`⚠️ Could not get enrollment statistics:`, enrollmentError);
        
        // Fallback to static fields if available
        const enrollmentCount = learningPlanDetails.assigned_enrollments_count !== undefined ? 
                               learningPlanDetails.assigned_enrollments_count :
                               learningPlanDetails.enrollment_count || 
                               learningPlanDetails.enrolled_users || 
                               learningPlanDetails.total_enrollments ||
                               learningPlanDetails.user_count;
        if (enrollmentCount !== undefined) {
          responseMessage += `\n👥 **Enrollments**: ${enrollmentCount}`;
        }
      }

      // 12. COURSE INFORMATION - Get courses in the learning plan
      try {
        console.log(`📚 Getting courses for learning plan ${actualLearningPlanId}`);
        const coursesResult = await api.apiRequest(`/learningplan/v1/learningplans/${actualLearningPlanId}/courses`, 'GET');
        
        if (coursesResult.data && coursesResult.data.items && coursesResult.data.items.length > 0) {
          const courses = coursesResult.data.items;
          const mandatoryCourses = courses.filter((course: any) => course.is_mandatory === true || course.mandatory === true);
          const optionalCourses = courses.filter((course: any) => course.is_mandatory === false || course.mandatory === false);
          
          responseMessage += `\n📚 **Total Courses**: ${courses.length}`;
          
          if (mandatoryCourses.length > 0) {
            responseMessage += `\n✅ **Mandatory Courses** (${mandatoryCourses.length}):`;
            mandatoryCourses.slice(0, 5).forEach((course: any, index: number) => {
              const courseName = course.course_name || course.name || course.title || 'Unknown Course';
              responseMessage += `\n   ${index + 1}. ${courseName}`;
            });
            if (mandatoryCourses.length > 5) {
              responseMessage += `\n   ... and ${mandatoryCourses.length - 5} more mandatory courses`;
            }
          }
          
          if (optionalCourses.length > 0) {
            responseMessage += `\n📝 **Optional Courses** (${optionalCourses.length}):`;
            optionalCourses.slice(0, 3).forEach((course: any, index: number) => {
              const courseName = course.course_name || course.name || course.title || 'Unknown Course';
              responseMessage += `\n   ${index + 1}. ${courseName}`;
            });
            if (optionalCourses.length > 3) {
              responseMessage += `\n   ... and ${optionalCourses.length - 3} more optional courses`;
            }
          }
        }
      } catch (coursesError) {
        console.log(`⚠️ Could not get course information:`, coursesError);
        
        // Fallback to static fields if available
        if (learningPlanDetails.course_count !== undefined || learningPlanDetails.total_courses !== undefined) {
          const courseCount = learningPlanDetails.course_count || learningPlanDetails.total_courses;
          responseMessage += `\n📚 **Total Courses**: ${courseCount}`;
        }
        
        if (learningPlanDetails.mandatory_courses !== undefined) {
          responseMessage += `\n✅ **Mandatory Courses**: ${learningPlanDetails.mandatory_courses}`;
        }

        if (learningPlanDetails.optional_courses !== undefined) {
          responseMessage += `\n📝 **Optional Courses**: ${learningPlanDetails.optional_courses}`;
        }
      }

      // 13. VALIDITY DATES - Learning plan specific fields
      const validityStart = learningPlanDetails.validity_start || 
                           learningPlanDetails.start_date ||
                           learningPlanDetails.date_begin;
      if (validityStart) {
        responseMessage += `\n📅 **Start Date**: ${validityStart}`;
      }

      const validityEnd = learningPlanDetails.validity_end || 
                         learningPlanDetails.end_date ||
                         learningPlanDetails.date_end;
      if (validityEnd) {
        responseMessage += `\n📅 **End Date**: ${validityEnd}`;
      }

      // 14. SHOW IN CATALOG
      if (learningPlanDetails.show_in_catalog !== undefined) {
        responseMessage += `\n📂 **Show in Catalog**: ${learningPlanDetails.show_in_catalog ? 'Yes' : 'No'}`;
      }

      // 15. CREDITS
      if (learningPlanDetails.credits) {
        responseMessage += `\n🎓 **Credits**: ${learningPlanDetails.credits}`;
      }

      // 16. ENROLLMENT LINK - Direct enrollment link
      if (learningPlanDetails.deeplink && learningPlanDetails.deeplink.enabled && learningPlanDetails.deeplink.hash) {
        const enrollmentLink = `https://googlesandbox.docebosaas.com/learningplan/${actualLearningPlanId}/${learningPlanDetails.slug_name || 'learning-plan'}?hash=${learningPlanDetails.deeplink.hash}`;
        responseMessage += `\n🔗 **Direct Enrollment Link**: [Enroll Now](${enrollmentLink})`;
      }

      // 17. LEARNING PLAN ADMIN URL
      const lpEditUrl = `https://googlesandbox.docebosaas.com/learningplan/edit/${actualLearningPlanId}`;
      responseMessage += `\n⚙️ **Learning Plan Admin URL**: [Edit Learning Plan](${lpEditUrl})`;

      responseMessage += `\n\n💡 **Next Steps**: 
• "Enroll [user] in learning plan ${displayName}" to enroll users
• "Find courses" to search for related courses
• "Find learning plans about [topic]" to search for related learning plans

*Using endpoint: /learningplan/v1/learningplans*`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          learningPlan: learningPlanDetails,
          learningPlanName: displayName,
          learningPlanId: actualLearningPlanId,
          editUrl: lpEditUrl,
          enrollmentLink: learningPlanDetails.deeplink?.enabled ? 
            `https://googlesandbox.docebosaas.com/learningplan/${actualLearningPlanId}/${learningPlanDetails.slug_name || 'learning-plan'}?hash=${learningPlanDetails.deeplink.hash}` : null
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
