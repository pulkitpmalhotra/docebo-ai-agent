// app/api/chat/handlers/search.ts - Enhanced search handlers with manager info
import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';
import { APIResponse } from '../types';

export class SearchHandlers {
  
  static async handleUserSearch(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, searchTerm } = entities;
      const query = email || searchTerm;
      
      if (!query) {
        return NextResponse.json({
          response: '❌ **Missing Search Term**: Please provide an email or search term.\n\n**Examples**: \n• "Find user mike@company.com"\n• "Find user john smith"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔍 Searching users: "${query}"`);

      const users = await api.searchUsers(query, 25);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `❌ **No Users Found**: "${query}"\n\nNo users found matching your search criteria.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // If exact email match, provide detailed user info with manager
      if (email && users.length === 1 && users[0].email?.toLowerCase() === email.toLowerCase()) {
        const user = users[0];
        
        // Get enhanced user details including manager info
        const enhancedUserDetails = await api.getEnhancedUserDetails(user.user_id || user.id);
        
        let responseMessage = `👤 **User Details**: ${enhancedUserDetails.fullname}

🆔 **User ID**: ${enhancedUserDetails.id}
📧 **Email**: ${enhancedUserDetails.email}
🔑 **Username**: ${enhancedUserDetails.username}
📊 **Status**: ${enhancedUserDetails.status}
👑 **Level**: ${enhancedUserDetails.level}
🏢 **Department**: ${enhancedUserDetails.department}
🌍 **Language**: ${enhancedUserDetails.language}
🕐 **Timezone**: ${enhancedUserDetails.timezone}
📅 **Created**: ${enhancedUserDetails.creationDate}
🔄 **Last Access**: ${enhancedUserDetails.lastAccess}`;

        // Add manager information if available
        if (enhancedUserDetails.manager) {
          responseMessage += `\n\n👥 **Management Structure**:
📋 **Direct Manager**: ${enhancedUserDetails.manager.fullname}
📧 **Manager Email**: ${enhancedUserDetails.manager.email}`;
        } else {
          responseMessage += `\n\n👥 **Management Structure**:
📋 **Direct Manager**: Not assigned or not available`;
        }

        return NextResponse.json({
          response: responseMessage,
          success: true,
          data: {
            user: enhancedUserDetails,
            totalCount: 1,
            isDetailedView: true,
            hasManagerInfo: !!enhancedUserDetails.manager
          },
          totalCount: 1,
          timestamp: new Date().toISOString()
        });
      }

      // Multiple users found - show list with basic manager info
      const enhancedUsers = await Promise.all(
        users.slice(0, 10).map(async (user: any) => {
          try {
            const enhancedDetails = await api.getEnhancedUserDetails(user.user_id || user.id);
            return enhancedDetails;
          } catch (error) {
            // If enhanced details fail, return basic user info
            console.warn(`Failed to get enhanced details for user ${user.user_id}:`, error);
            return {
              ...user,
              manager: null,
              fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'No name'
            };
          }
        })
      );

      const userList = enhancedUsers.map((user: any, index: number) => {
        const name = user.fullname || 'No name';
        const email = user.email || 'No email';
        const status = user.status === '1' ? '🟢 Active' : user.status === '0' ? '🔴 Inactive' : '⚪ Unknown';
        const level = user.level === 'godadmin' ? '👑 Admin' : user.level || 'User';
        const manager = user.manager ? `👥 Manager: ${user.manager.fullname}` : '👥 No manager assigned';
        
        return `${index + 1}. **${name}** (${email})
   🆔 ID: ${user.id} • ${status} • ${level}
   ${manager}`;
      }).join('\n\n');

      return NextResponse.json({
        response: `👥 **User Search Results**: "${query}" (${users.length} found)

${userList}

${users.length > 10 ? `\n... and ${users.length - 10} more users` : ''}

💡 **Tip**: Search with an exact email for detailed user information including manager details.`,
        success: true,
        data: {
          users: enhancedUsers,
          totalCount: users.length,
          query: query,
          hasManagerInfo: true
        },
        totalCount: users.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ User search error:', error);
      
      return NextResponse.json({
        response: `❌ **User Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleCourseSearch(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { searchTerm } = entities;
      
      if (!searchTerm) {
        return NextResponse.json({
          response: '❌ **Missing Search Term**: Please provide a course name or keyword.\n\n**Examples**: \n• "Find Python courses"\n• "Search Excel training"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔍 Searching courses: "${searchTerm}"`);

      const courses = await api.searchCourses(searchTerm, 25);
      
      if (courses.length === 0) {
        return NextResponse.json({
          response: `❌ **No Courses Found**: "${searchTerm}"\n\nNo courses found matching your search criteria.\n\n💡 **Try**: \n• Different keywords\n• Broader search terms\n• Check spelling`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseList = courses.slice(0, 20).map((course: any, index: number) => {
        const name = api.getCourseName(course);
        const courseId = course.id || course.course_id || course.idCourse || 'Unknown';
        const type = course.course_type || course.type || 'Course';
        const status = course.status || course.course_status || 'Unknown';
        
        let statusIcon = '📚';
        if (status === 'active' || status === '2') statusIcon = '🟢';
        else if (status === 'inactive' || status === '0') statusIcon = '🔴';
        else if (status === 'suspended' || status === '1') statusIcon = '🟡';
        
        return `${index + 1}. ${statusIcon} **${name}**\n   Type: ${type} • ID: ${courseId} • Status: ${status}`;
      }).join('\n\n');

      return NextResponse.json({
        response: `📚 **Course Search Results**: "${searchTerm}" (${courses.length} found)

${courseList}

${courses.length > 20 ? `\n... and ${courses.length - 20} more courses` : ''}

💡 **Next Steps**: 
• "Course info [course name]" for details
• "Who is enrolled in [course name]" for enrollments`,
        success: true,
        data: {
          courses: courses,
          totalCount: courses.length,
          query: searchTerm
        },
        totalCount: courses.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course search error:', error);
      
      return NextResponse.json({
        response: `❌ **Course Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleLearningPlanSearch(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { searchTerm } = entities;
      
      if (!searchTerm) {
        return NextResponse.json({
          response: '❌ **Missing Search Term**: Please provide a learning plan name or keyword.\n\n**Examples**: \n• "Find Python learning plans"\n• "Search leadership programs"',
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔍 Searching learning plans: "${searchTerm}"`);

      const learningPlans = await api.searchLearningPlans(searchTerm, 25);
      
      if (learningPlans.length === 0) {
        return NextResponse.json({
          response: `❌ **No Learning Plans Found**: "${searchTerm}"\n\nNo learning plans found matching your search criteria.\n\n💡 **Try**: \n• Different keywords\n• Broader search terms\n• Check spelling`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const planList = learningPlans.slice(0, 20).map((plan: any, index: number) => {
        const name = api.getLearningPlanName(plan);
        const planId = plan.learning_plan_id || plan.id || 'Unknown';
        const status = plan.status || plan.learning_plan_status || plan.lp_status || 'Unknown';
        const enrollments = plan.enrollment_count || plan.enrolled_users || plan.total_enrollments || plan.user_count || 'Unknown';
        
        let statusIcon = '📋';
        if (status === 'active' || status === '2' || status === 2) statusIcon = '🟢';
        else if (status === 'inactive' || status === '0' || status === 0) statusIcon = '🔴';
        else if (status === 'suspended' || status === '1' || status === 1) statusIcon = '🟡';
        
        return `${index + 1}. ${statusIcon} **${name}**\n   ID: ${planId} • Status: ${status} • Enrollments: ${enrollments}`;
      }).join('\n\n');

      return NextResponse.json({
        response: `📋 **Learning Plan Search Results**: "${searchTerm}" (${learningPlans.length} found)

${planList}

${learningPlans.length > 20 ? `\n... and ${learningPlans.length - 20} more learning plans` : ''}

💡 **Next Steps**: 
• "Learning plan info [plan name]" for details
• "Enroll [user] in learning plan [plan name]" to enroll users

*Using endpoint: /learningplan/v1/learningplans*`,
        success: true,
        data: {
          learningPlans: learningPlans,
          totalCount: learningPlans.length,
          query: searchTerm
        },
        totalCount: learningPlans.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan search error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Note**: Learning plan search uses endpoint: /learningplan/v1/learningplans`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
}
