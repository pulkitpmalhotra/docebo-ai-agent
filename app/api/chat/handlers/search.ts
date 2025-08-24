// app/api/chat/handlers/search.ts - Complete fixed search handlers
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

      // If searching by email, get detailed user info directly
      if (email && email.includes('@')) {
        console.log(`📧 Email search detected: ${email}`);
        
        try {
          // Use getUserDetails which has improved exact email matching
          const userDetails = await api.getUserDetails(email);
          
          console.log(`👤 Found user via getUserDetails:`, {
            id: userDetails.id,
            email: userDetails.email,
            fullname: userDetails.fullname
          });
          
          // Check if userDetails has valid data before trying to get enhanced details
          if (!userDetails.id || userDetails.id === 'Unknown' || !userDetails.email || userDetails.email === 'Not available') {
            console.log(`❌ Invalid user details returned, user not found: ${email}`);
            
            return NextResponse.json({
              response: `❌ **User Not Found**: "${email}"\n\nNo user found with that exact email address.\n\n💡 **Please check:**\n• Email spelling is correct\n• User exists in the system\n• Email domain is correct`,
              success: false,
              timestamp: new Date().toISOString()
            });
          }
          
          // Get enhanced user details including manager info
          console.log(`🔍 Attempting to get enhanced details for user ID: ${userDetails.id}`);
          try {
            const enhancedUserDetails = await api.getEnhancedUserDetails(userDetails.id);
            
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

            // Add manager information if available (WITHOUT EMAIL)
            if (enhancedUserDetails.manager) {
              responseMessage += `\n\n👥 **Management Structure**:
📋 **Direct Manager**: ${enhancedUserDetails.manager.fullname}`;
            } else {
              responseMessage += `\n\n👥 **Management Structure**:
📋 **Direct Manager**: Not assigned or not available`;
            }

            // Add additional fields if available
            if (enhancedUserDetails.additionalFields && Object.keys(enhancedUserDetails.additionalFields).length > 0) {
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
            
          } catch (enhancedError) {
            console.error('❌ Error getting enhanced user details:', enhancedError);
            
            // Fall back to basic user details
            if (userDetails.email === 'Not available' || userDetails.fullname === 'Not available') {
              return NextResponse.json({
                response: `❌ **User Not Found**: "${email}"\n\nNo user found with that exact email address.`,
                success: false,
                timestamp: new Date().toISOString()
              });
            }
            
            let basicResponse = `👤 **User Details**: ${userDetails.fullname}

🆔 **User ID**: ${userDetails.id}
📧 **Email**: ${userDetails.email}
🔑 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
👑 **Level**: ${userDetails.level}
🏢 **Department**: ${userDetails.department}
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}
📅 **Created**: ${userDetails.creationDate}
🔄 **Last Access**: ${userDetails.lastAccess}

👥 **Management Structure**:
📋 **Direct Manager**: Unable to retrieve manager information

⚠️ **Note**: Using basic user information. Enhanced details not available.`;

            return NextResponse.json({
              response: basicResponse,
              success: true,
              data: {
                user: userDetails,
                totalCount: 1,
                isDetailedView: true,
                hasManagerInfo: false,
                fallbackMode: true
              },
              totalCount: 1,
              timestamp: new Date().toISOString()
            });
          }
          
        } catch (userNotFoundError) {
          console.error(`❌ User not found: ${email}`, userNotFoundError);
          
          return NextResponse.json({
            response: `❌ **User Not Found**: "${email}"\n\nNo user found with that exact email address.\n\n💡 **Please check:**\n• Email spelling is correct\n• User exists in the system\n• Email domain is correct`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      // For non-email searches, use the general search method
      try {
        const users = await api.searchUsers(query, 25);
        console.log(`📊 Search returned ${users.length} users`);
        
        if (users.length === 0) {
          return NextResponse.json({
            response: `❌ **No Users Found**: "${query}"\n\nNo users found matching your search criteria.\n\n💡 **Possible reasons:**\n• User doesn't exist in the system\n• Search term is too specific\n• User might be in a different domain`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }

        // Multiple users found - show list
        const userList = users.slice(0, 10).map((user: any, index: number) => {
          const name = user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'No name';
          const email = user.email || 'No email';
          const status = user.status === '1' ? '🟢 Active' : user.status === '0' ? '🔴 Inactive' : '⚪ Unknown';
          const level = user.level === 'godadmin' ? '👑 Admin' : user.level || 'User';
          
          return `${index + 1}. **${name}** (${email})\n   🆔 ID: ${user.user_id || user.id} • ${status} • ${level}`;
        }).join('\n\n');

        return NextResponse.json({
          response: `👥 **User Search Results**: "${query}" (${users.length} found)

${userList}

${users.length > 10 ? `\n... and ${users.length - 10} more users` : ''}

💡 **Tip**: Use an exact email address for detailed user information.`,
          success: true,
          data: {
            users: users.slice(0, 10),
            totalCount: users.length,
            query: query,
            fallbackMode: false
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
• Verify the search term is correct
• Try a different search approach`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('❌ User search handler error:', error);
      
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

      console.log(`🔍 FIXED: Searching courses: "${searchTerm}"`);

      // FIXED: Use correct endpoint with search_text parameter
      const courses = await api.apiRequest('/learn/v1/courses', 'GET', null, {
        search_text: searchTerm,
        page_size: Math.min(25, 200),
        sort_attr: 'name',
        sort_dir: 'asc'
      });
      
      const courseItems = courses.data?.items || [];
      
      if (courseItems.length === 0) {
        return NextResponse.json({
          response: `❌ **No Courses Found**: "${searchTerm}"\n\nNo courses found matching your search criteria.\n\n💡 **Try**: \n• Different keywords\n• Broader search terms\n• Check spelling`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // FIXED: Enhanced course list with correct field mappings
      const courseListPromises = courseItems.slice(0, 20).map(async (course: any, index: number) => {
        const name = course.name || course.title || course.course_name || 'Unknown Course';
        const courseId = course.id || course.course_id || course.idCourse || 'Unknown';
        
        // FIXED: Correct course type mapping
        let type = 'Course';
        if (course.course_type) {
          switch(course.course_type) {
            case 'elearning': type = 'E-Learning'; break;
            case 'classroom': type = 'Classroom'; break;
            case 'webinar': type = 'Webinar'; break;
            case 'learning_object': type = 'Learning Object'; break;
            default: type = course.course_type; break;
          }
        }
        
        // FIXED: Proper status mapping based on Docebo API
        let status = 'Unknown';
        let statusIcon = '📚';
        
        if (course.status === 2 || course.status === 'active' || course.can_subscribe === 1) {
          status = 'Published';
          statusIcon = '🟢';
        } else if (course.status === 0 || course.status === 'inactive' || course.can_subscribe === 0) {
          status = 'Unpublished';
          statusIcon = '🟡';
        } else if (course.status === 1 || course.status === 'suspended') {
          status = 'Suspended';
          statusIcon = '🔴';
        }
        
        // FIXED: Get enrollment count from correct fields
        let enrollments = 'Unknown';
        if (course.enrolled_users_count !== undefined) {
          enrollments = course.enrolled_users_count;
        } else if (course.enrolled_users !== undefined) {
          enrollments = course.enrolled_users;
        } else if (course.subscription_count !== undefined) {
          enrollments = course.subscription_count;
        }
        
        return `${index + 1}. ${statusIcon} **${name}**\n   Type: ${type} • ID: ${courseId} • Status: ${status} • Enrollments: ${enrollments}`;
      });

      // Wait for all course details to be processed
      const courseList = await Promise.all(courseListPromises);

      return NextResponse.json({
        response: `📚 **Course Search Results**: "${searchTerm}" (${courseItems.length} found)

${courseList.join('\n\n')}

${courseItems.length > 20 ? `\n... and ${courseItems.length - 20} more courses` : ''}

💡 **Next Steps**: 
• "Course info [course name]" for details
• "Enroll [user] in course [course name]" to enroll users`,
        success: true,
        data: {
          courses: courseItems,
          totalCount: courseItems.length,
          query: searchTerm,
          endpoint_used: '/learn/v1/courses'
        },
        totalCount: courseItems.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Course search error:', error);
      
      return NextResponse.json({
        response: `❌ **Course Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Using endpoint**: /learn/v1/courses with search_text parameter`,
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

      console.log(`🔍 FIXED: Searching learning plans: "${searchTerm}"`);

      // FIXED: Use correct endpoint with proper parameters
      const learningPlans = await api.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        search_text: searchTerm,
        page_size: Math.min(25, 200),
        sort_attr: 'name',
        sort_dir: 'asc'
      });
      
      const lpItems = learningPlans.data?.items || [];
      
      if (lpItems.length === 0) {
        // FIXED: Try alternate search strategy
        console.log(`🔍 Trying alternate learning plan search method...`);
        
        const allLearningPlans = await api.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
          page_size: Math.min(100, 200),
          sort_attr: 'name',
          sort_dir: 'asc'
        });
        
        const allLpItems = allLearningPlans.data?.items || [];
        const filteredPlans = allLpItems.filter((lp: any) => {
          const name = api.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          return name.includes(searchTerm.toLowerCase()) || 
                 description.includes(searchTerm.toLowerCase());
        });
        
        if (filteredPlans.length === 0) {
          return NextResponse.json({
            response: `❌ **No Learning Plans Found**: "${searchTerm}"\n\nNo learning plans found matching your search criteria.\n\n💡 **Try**: \n• Different keywords\n• Broader search terms\n• Check spelling`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Use filtered results
        lpItems.push(...filteredPlans.slice(0, 25));
      }

      const planList = lpItems.slice(0, 20).map((plan: any, index: number) => {
        const name = api.getLearningPlanName(plan);
        const planId = plan.learning_plan_id || plan.id || 'Unknown';
        
        // FIXED: Proper status mapping for learning plans
        let status = 'Unknown';
        let statusIcon = '📋';
        
        if (plan.is_active === true || plan.is_active === 1 || plan.status === 2) {
          status = 'Published';
          statusIcon = '🟢';
        } else if (plan.is_active === false || plan.is_active === 0 || plan.status === 0) {
          status = 'Draft';
          statusIcon = '🟡';
        } else if (plan.status === 1) {
          status = 'Suspended';
          statusIcon = '🔴';
        }
        
        // FIXED: Get enrollment count from correct fields
        let enrollments = 'Unknown';
        if (plan.enrolled_users_count !== undefined) {
          enrollments = plan.enrolled_users_count;
        } else if (plan.enrolled_users !== undefined) {
          enrollments = plan.enrolled_users;
        } else if (plan.total_users !== undefined) {
          enrollments = plan.total_users;
        } else if (plan.user_count !== undefined) {
          enrollments = plan.user_count;
        }
        
        return `${index + 1}. ${statusIcon} **${name}**\n   ID: ${planId} • Status: ${status} • Enrollments: ${enrollments}`;
      }).join('\n\n');

      return NextResponse.json({
        response: `📋 **Learning Plan Search Results**: "${searchTerm}" (${lpItems.length} found)

${planList}

${lpItems.length > 20 ? `\n... and ${lpItems.length - 20} more learning plans` : ''}

💡 **Next Steps**: 
• "Learning plan info [plan name]" for details
• "Enroll [user] in learning plan [plan name]" to enroll users

*Using endpoint: /learningplan/v1/learningplans*`,
        success: true,
        data: {
          learningPlans: lpItems,
          totalCount: lpItems.length,
          query: searchTerm,
          endpoint_used: '/learningplan/v1/learningplans'
        },
        totalCount: lpItems.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan search error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Using endpoint**: /learningplan/v1/learningplans with search_text parameter`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
}
