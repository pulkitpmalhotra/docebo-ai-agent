// app/api/chat/handlers/search.ts - Search handlers
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

      // If exact email match, provide detailed user info
      if (email && users.length === 1 && users[0].email?.toLowerCase() === email.toLowerCase()) {
        const user = users[0];
        
        return NextResponse.json({
          response: `👤 **User Details**: ${user.fullname || `${user.firstname} ${user.lastname}`}

📧 **Email**: ${user.email}
🔑 **Username**: ${user.username || 'Not available'}
🆔 **User ID**: ${user.user_id || user.id}
📊 **Status**: ${user.status === '1' ? 'Active' : user.status === '0' ? 'Inactive' : user.status}
👑 **Level**: ${user.level === 'godadmin' ? 'Superadmin' : user.level || 'User'}
🏢 **Department**: ${user.department || 'Not specified'}
🌍 **Language**: ${user.language || user.lang_code || 'Not specified'}
🕐 **Timezone**: ${user.timezone || 'Not specified'}
📅 **Created**: ${user.register_date || user.creation_date || 'Not available'}
🔄 **Last Access**: ${user.last_access_date || user.last_access || 'Not available'}`,
          success: true,
          data: {
            user: user,
            totalCount: 1,
            isDetailedView: true
          },
          totalCount: 1,
          timestamp: new Date().toISOString()
        });
      }

      // Multiple users found - show list
      const userList = users.slice(0, 20).map((user: any, index: number) => {
        const name = user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'No name';
        const email = user.email || 'No email';
        const status = user.status === '1' ? '🟢 Active' : user.status === '0' ? '🔴 Inactive' : '⚪ Unknown';
        const level = user.level === 'godadmin' ? '👑 Admin' : user.level || 'User';
        
        return `${index + 1}. **${name}** (${email})\n   ${status} • ${level} • ID: ${user.user_id || user.id}`;
      }).join('\n\n');

      return NextResponse.json({
        response: `👥 **User Search Results**: "${query}" (${users.length} found)

${userList}

${users.length > 20 ? `\n... and ${users.length - 20} more users` : ''}

💡 **Tip**: Search with an exact email for detailed user information.`,
        success: true,
        data: {
          users: users,
          totalCount: users.length,
          query: query
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
