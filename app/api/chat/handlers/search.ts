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

      try {
        const users = await api.searchUsers(query, 25);
        console.log(`📊 Search returned ${users.length} users`);
        
        if (users.length === 0) {
          return NextResponse.json({
            response: `❌ **No Users Found**: "${query}"\n\nNo users found matching your search criteria.\n\n💡 **Possible reasons:**\n• User doesn't exist in the system\n• Email address is incorrect\n• User might be in a different domain\n• API permissions might be limited`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }

        // If searching by email, provide detailed user info
        if (email && users.length >= 1) {
          const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) || users[0];
          
          console.log(`👤 Processing user:`, {
            id: user.user_id || user.id,
            email: user.email,
            fullname: user.fullname,
            firstname: user.firstname,
            lastname: user.lastname
          });
          
          try {
            // Try to get enhanced user details with fallback
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

            // Add additional fields if available
            if (enhancedUserDetails.additionalFields) {
              responseMessage += `\n\n📋 **Additional Information**:`;
              if (enhancedUserDetails.additionalFields.jobTitle) {
                responseMessage += `\n💼 **Job Title**: ${enhancedUserDetails.additionalFields.jobTitle}`;
              }
              if (enhancedUserDetails.additionalFields.employeeId) {
                responseMessage += `\n🆔 **Employee ID**: ${enhancedUserDetails.additionalFields.employeeId}`;
              }
              if (enhancedUserDetails.additionalFields.location) {
                responseMessage += `\n📍 **Location**: ${enhancedUserDetails.additionalFields.location}`;
              }
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
            
          } catch (detailsError) {
            console.error('❌ Error getting enhanced user details:', detailsError);
            
            // **IMPROVED FALLBACK**: Create detailed response from basic user data
            const basicUserInfo = {
              id: (user.user_id || user.id || 'Unknown').toString(),
              fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email || 'Unknown User',
              email: user.email || 'Not available',
              username: user.username || user.userid || 'Not available',
              status: user.status === '1' || user.status === 1 ? 'Active' : 
                     user.status === '0' || user.status === 0 ? 'Inactive' : 
                     user.status ? `Status: ${user.status}` : 'Unknown',
              level: user.level === 'godadmin' ? 'Superadmin' : 
                    user.level === 'powUser' ? 'Power User' :
                    user.level || 'User',
              department: user.department || user.orgchart_desc || user.branch || 'Not specified',
              creationDate: user.register_date || user.creation_date || user.created_at || 'Not available',
              lastAccess: user.last_access_date || user.last_access || user.last_login || 'Not available',
              timezone: user.timezone || user.time_zone || 'Not specified',
              language: user.language || user.lang_code || 'Not specified'
            };
            
            let fallbackResponse = `👤 **User Details**: ${basicUserInfo.fullname}

🆔 **User ID**: ${basicUserInfo.id}
📧 **Email**: ${basicUserInfo.email}
🔑 **Username**: ${basicUserInfo.username}
📊 **Status**: ${basicUserInfo.status}
👑 **Level**: ${basicUserInfo.level}
🏢 **Department**: ${basicUserInfo.department}
🌍 **Language**: ${basicUserInfo.language}
🕐 **Timezone**: ${basicUserInfo.timezone}
📅 **Created**: ${basicUserInfo.creationDate}
🔄 **Last Access**: ${basicUserInfo.lastAccess}

👥 **Management Structure**:
📋 **Direct Manager**: Unable to retrieve manager information

⚠️ **Note**: Using basic user information. Enhanced details (manager info, additional fields) are not available due to API limitations or missing permissions.

💡 **Troubleshooting**: 
• Some Docebo instances don't support additional field endpoints
• Manager information may not be configured in additional fields
• API permissions may be limited for enhanced user data`;

            return NextResponse.json({
              response: fallbackResponse,
              success: true,
              data: {
                user: basicUserInfo,
                totalCount: 1,
                isDetailedView: true,
                hasManagerInfo: false,
                fallbackMode: true,
                originalError: detailsError instanceof Error ? detailsError.message : 'Unknown error'
              },
              totalCount: 1,
              timestamp: new Date().toISOString()
            });
          }
        }

        // Multiple users found - show list
        const userList = users.slice(0, 10).map((user: any, index: number) => {
          const name = user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'No name';
          const email = user.email || 'No email';
          const status = user.status === '1' || user.status === 1 ? '🟢 Active' : 
                        user.status === '0' || user.status === 0 ? '🔴 Inactive' : '⚪ Unknown';
          const level = user.level === 'godadmin' ? '👑 Superadmin' : 
                       user.level === 'powUser' ? '👑 Power User' :
                       user.level || 'User';
          
          return `${index + 1}. **${name}** (${email})
   🆔 ID: ${user.user_id || user.id} • ${status} • ${level}`;
        }).join('\n\n');

        return NextResponse.json({
          response: `👥 **User Search Results**: "${query}" (${users.length} found)

${userList}

${users.length > 10 ? `\n... and ${users.length - 10} more users` : ''}

💡 **Tip**: Search with an exact email for detailed user information including manager details.`,
          success: true,
          data: {
            users: users.slice(0, 10),
            totalCount: users.length,
            query: query,
            hasManagerInfo: false
          },
          totalCount: users.length,
          timestamp: new Date().toISOString()
        });

      } catch (searchError) {
        console.error('❌ User search API error:', searchError);
        
        return NextResponse.json({
          response: `❌ **Search Failed**: Unable to search for users.

**Error Details**: ${searchError instanceof Error ? searchError.message : 'Unknown error'}

**Possible Solutions**:
• Check your API credentials and permissions
• Verify the user exists in the system
• Try searching with a different term
• Contact your Docebo administrator

**API Endpoints Tried**:
• /manage/v1/user (primary search endpoint)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('❌ User search handler error:', error);
      
      return NextResponse.json({
        response: `❌ **User Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please try again or contact support if the issue persists.`,
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
