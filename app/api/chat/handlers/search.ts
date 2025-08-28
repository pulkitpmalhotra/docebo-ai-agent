// app/api/chat/handlers/search.ts - FIXED search handlers with proper data mapping
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

      console.log(`🔍 FIXED: Searching users: "${query}"`);

      // If searching by email, get detailed user info directly
      if (email && email.includes('@')) {
        console.log(`📧 Email search detected: ${email}`);

        try {
          // Use direct API call with proper field mapping
          const users = await api.searchUsers(email, 5);
          console.log(`📊 Direct search returned:`, users);
          
          // Find exact email match
          const user = users.find((u: any) => 
            u.email && u.email.toLowerCase() === email.toLowerCase()
          );
          
          if (!user) {
            return NextResponse.json({
              response: `❌ **User Not Found**: "${email}"\n\nNo user found with that exact email address.\n\n💡 **Please check:**\n• Email spelling is correct\n• User exists in the system\n• Email domain is correct`,
              success: false,
              timestamp: new Date().toISOString()
            });
          }

          // FIXED: Properly extract user data from API response
          const userDetails = {
            id: (user.user_id || user.id || 'Unknown').toString(),
            fullname: user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Not available',
            email: user.email || 'Not available',
            username: user.username || user.encoded_username || 'Not available',
            status: this.mapUserStatus(user.status),
            level: this.mapUserLevel(user.level),
            creationDate: user.creation_date ? new Date(user.creation_date).toLocaleDateString() : 'Not available',
            lastAccess: user.last_access_date ? new Date(user.last_access_date).toLocaleDateString() : 'Not available',
            timezone: user.timezone || 'Not set',
            language: user.language || user.lang_code || 'en',
            department: user.field_1 || user.field_5 || 'Not assigned',
            uuid: user.uuid,
            isManager: user.is_manager || false
          };

          // Get manager information if available
          let managerInfo = null;
          if (user.managers && user.managers.length > 0) {
            const directManager = user.managers.find((m: any) => m.manager_title === 'Direct Manager');
            if (directManager) {
              managerInfo = {
                fullname: directManager.manager_name,
                username: directManager.manager_username,
                id: directManager.manager_id
              };
            }
          }

          let responseMessage = `👤 **User Details**: ${userDetails.fullname}

🆔 **User ID**: ${userDetails.id}
📧 **Email**: ${userDetails.email}
🔑 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
👑 **Level**: ${userDetails.level}
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}
📅 **Created**: ${userDetails.creationDate}
🔄 **Last Access**: ${userDetails.lastAccess}
🏢 **Department**: ${userDetails.department}
🆔 **UUID**: ${userDetails.uuid}`;

          // Add manager information
          responseMessage += `\n\n👥 **Management Structure**:`;
          if (managerInfo) {
            responseMessage += `\n📋 **Direct Manager**: ${managerInfo.fullname} (${managerInfo.username})`;
          } else {
            responseMessage += `\n📋 **Direct Manager**: Not assigned or not available`;
          }

          // Add additional fields from user data
          if (user.field_2) {
            responseMessage += `\n\n📋 **Additional Information**:`;
            responseMessage += `\n👤 **Googler Type**: ${user.field_2}`;
          }
          if (user.field_3) {
            responseMessage += `\n👑 **Is Manager**: ${user.field_3}`;
          }
          if (user.field_4) {
            responseMessage += `\n🏢 **Organization**: ${user.field_4}`;
          }
          if (user.field_6) {
            responseMessage += `\n🆔 **Person ID**: ${user.field_6}`;
          }

          return NextResponse.json({
            response: responseMessage,
            success: true,
            data: {
              user: userDetails,
              manager: managerInfo,
              totalCount: 1,
              isDetailedView: true,
              hasManagerInfo: !!managerInfo
            },
            totalCount: 1,
            timestamp: new Date().toISOString()
          });

        } catch (userError) {
          console.error(`❌ User search failed:`, userError);

          return NextResponse.json({
            response: `❌ **User Search Failed**: ${userError instanceof Error ? userError.message : 'Unknown error'}`,
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

        // Multiple users found - show list with FIXED field mapping
        const userList = users.slice(0, 100).map((user: any, index: number) => {
          const name = user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name';
          const email = user.email || 'No email';
          const status = this.mapUserStatus(user.status);
          const level = this.mapUserLevel(user.level);
          const userId = (user.user_id || user.id || 'Unknown').toString();

          return `${index + 1}. **${name}** (${email})\n   🆔 ID: ${userId} • ${status} • ${level}`;
        }).join('\n\n');

        return NextResponse.json({
          response: `👥 **User Search Results**: "${query}" (${users.length} found)

${userList}

${users.length > 10 ? `\n... and ${users.length - 10} more users` : ''}

💡 **Tip**: Use an exact email address for detailed user information.`,
          success: true,
          data: {
            users: users.slice(0, 100),
            totalCount: users.length,
            query: query
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

    if (!searchTerm || searchTerm.trim().length === 0) {
      return NextResponse.json({
        response: '❌ **Missing Search Term**: Please provide a course name or keyword.\n\n**Examples**: \n• "Find Python courses"\n• "Courses about data science"\n• "Search Excel training"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    const cleanSearchTerm = searchTerm.trim();
    console.log(`🔍 FIXED COURSE SEARCH: Searching courses with full term: "${cleanSearchTerm}"`);

    // FIXED: Use correct endpoint and properly map response fields
    const result = await api.apiRequest('/course/v1/courses', 'GET', null, {
      search_text: cleanSearchTerm, // Use the FULL search term
      page_size: 100,
      sort_attr: 'name',
      sort_dir: 'asc'
    });

    const courseItems = result.data?.items || [];
    console.log(`📊 FIXED: Found ${courseItems.length} courses from API for search term: "${cleanSearchTerm}"`);

    if (courseItems.length === 0) {
      return NextResponse.json({
        response: `❌ **No Courses Found**: "${cleanSearchTerm}"\n\nNo courses found matching your search criteria.\n\n💡 **Try**: \n• Different keywords\n• Broader search terms\n• Check spelling\n\n**Examples**:\n• "Find Python courses" instead of "courses about Python programming language"\n• "Data science courses" instead of "advanced data science with machine learning"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    // FIXED: Enhanced course list with proper field mappings from your API response
    const displayLimit = 50; // Show first 50 courses
    const coursesToDisplay = courseItems.slice(0, displayLimit);
    
    const courseList = coursesToDisplay.map((course: any, index: number) => {
      const name = course.title || course.name || 'Unknown Course';
      const courseId = course.id?.toString() || 'Unknown';

      // FIXED: Correct course type mapping based on actual API response
      let type = 'Course';
      if (course.type) {
        switch(course.type.toLowerCase()) {
          case 'elearning': type = 'E-Learning'; break;
          case 'classroom': type = 'Classroom'; break;
          case 'webinar': type = 'Webinar'; break;
          default: type = course.type; break;
        }
      }

      // FIXED: Proper status mapping based on actual API fields
      let status = 'Unknown';
      let statusIcon = '📚';

      if (course.published === true || course.course_status === 'published') {
        status = 'Published';
        statusIcon = '🟢';
      } else if (course.published === false || course.course_status === 'unpublished') {
        status = 'Unpublished';
        statusIcon = '🟡';
      }

      // FIXED: Get enrollment count from actual API fields
      const enrollments = course.enrolled_count || course.enrolled_users_count || course.waiting_list || 0;

      return `${index + 1}. ${statusIcon} **${name}**\n   Type: ${type} • ID: ${courseId} • Status: ${status} • Enrollments: ${enrollments}`;
    }).join('\n\n');

    // FIXED: Proper calculation for remaining courses display
    const remainingCourses = Math.max(0, courseItems.length - displayLimit);
    const remainingText = remainingCourses > 0 ? `\n\n... and ${remainingCourses} more courses` : '';

    let responseMessage = `📚 **Course Search Results**: "${cleanSearchTerm}" (${courseItems.length} found)\n\n${courseList}${remainingText}\n\n💡 **Next Steps**: \n• "Course info [course name]" for details\n• "Enroll [user] in course [course name]" to enroll users`;

    // ENHANCED: Add search optimization tips if many results
    if (courseItems.length > 20) {
      responseMessage += `\n\n🎯 **Too Many Results?** Try more specific terms:\n• "${cleanSearchTerm} beginner" for beginner courses\n• "${cleanSearchTerm} advanced" for advanced courses\n• Add specific topics like "${cleanSearchTerm} fundamentals"`;
    }

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        courses: courseItems,
        totalCount: courseItems.length,
        displayedCount: coursesToDisplay.length,
        remainingCount: remainingCourses,
        query: cleanSearchTerm,
        endpoint_used: '/course/v1/courses',
        searchTermUsed: cleanSearchTerm
      },
      totalCount: courseItems.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ FIXED Course search error:', error);

    return NextResponse.json({
      response: `❌ **Course Search Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**Using endpoint**: /course/v1/courses with search_text parameter\n**Search term used**: "${entities.searchTerm || 'undefined'}"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

// Fixed version of handleLearningPlanSearch in app/api/chat/handlers/search.ts

static async handleLearningPlanSearch(entities: any, api: DoceboAPI): Promise<NextResponse> {
  try {
    const { searchTerm } = entities;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return NextResponse.json({
        response: 'Missing Search Term: Please provide a learning plan name or keyword.\n\nExamples: \n• "Find Python learning plans"\n• "Learning plans about leadership"\n• "Search data science programs"',
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    const cleanSearchTerm = searchTerm.trim();
    console.log(`🔍 FIXED LP SEARCH: Searching learning plans with full term: "${cleanSearchTerm}"`);

    // FIXED: Remove problematic sort_attr parameter
    let result;
    try {
      result = await api.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        search_text: cleanSearchTerm, // Use the FULL search term
        page_size: 100
        // REMOVED: sort_attr and sort_dir parameters that cause 400 error
      });
    } catch (searchError) {
      console.log('Direct search failed, trying fallback method...');
      
      // Fallback: Get all and filter manually
      result = await api.apiRequest('/learningplan/v1/learningplans', 'GET', null, {
        page_size: 100
      });
      
      // Manual filtering with the FULL search term
      const allItems = result.data?.items || [];
      const filteredItems = allItems.filter((lp: any) => {
        const name = (lp.title || lp.name || '').toLowerCase();
        const description = (lp.description || '').toLowerCase();
        const cleanSearchTermLower = cleanSearchTerm.toLowerCase();
        return name.includes(cleanSearchTermLower) || 
               description.includes(cleanSearchTermLower);
      });
      
      // Replace result with filtered data
      result = {
        data: {
          items: filteredItems,
          total_count: filteredItems.length
        }
      };
    }

    const lpItems = result.data?.items || [];
    console.log(`📊 FIXED LP SEARCH: Found ${lpItems.length} learning plans from API for search term: "${cleanSearchTerm}"`);

    if (lpItems.length === 0) {
      return NextResponse.json({
        response: `No Learning Plans Found: "${cleanSearchTerm}"\n\nNo learning plans found matching your search criteria.\n\nTry: \n• Different keywords\n• Broader search terms\n• Check spelling\n\n**Examples**:\n• "Find leadership learning plans" instead of "learning plans about advanced leadership skills"\n• "Data science programs" instead of "comprehensive data science learning paths"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    // FIXED: Enhanced learning plan list with proper field mappings and correct math
    const displayLimit = 50; // Show first 50 learning plans
    const plansToDisplay = lpItems.slice(0, displayLimit);
    
    const planList = plansToDisplay.map((plan: any, index: number) => {
      const name = plan.title || plan.name || 'Unknown Learning Plan';
      const planId = (plan.learning_plan_id || plan.id || 'Unknown').toString();

      // Proper status mapping for learning plans
      let status = 'Unknown';
      let statusIcon = '📋';

      if (plan.is_published === true || plan.is_publishable === true) {
        status = 'Published';
        statusIcon = '🟢';
      } else if (plan.is_published === false) {
        status = 'Draft';
        statusIcon = '🟡';
      }

      // Get enrollment count from actual API fields
      const enrollments = plan.assigned_enrollments_count || plan.enrolled_users_count || 0;

      return `${index + 1}. ${statusIcon} **${name}**\n   ID: ${planId} • Status: ${status} • Enrollments: ${enrollments}`;
    }).join('\n\n');

    // FIXED: Proper calculation for remaining learning plans display
    const remainingPlans = Math.max(0, lpItems.length - displayLimit);
    const remainingText = remainingPlans > 0 ? `\n\n... and ${remainingPlans} more learning plans` : '';

    let responseMessage = `Learning Plan Search Results: "${cleanSearchTerm}" (${lpItems.length} found)\n\n${planList}${remainingText}\n\nNext Steps: \n• "Learning plan info [plan name]" for details\n• "Enroll [user] in learning plan [plan name]" to enroll users`;

    // ENHANCED: Add search optimization tips if many results
    if (lpItems.length > 20) {
      responseMessage += `\n\n🎯 **Too Many Results?** Try more specific terms:\n• "${cleanSearchTerm} beginner" for beginner programs\n• "${cleanSearchTerm} advanced" for advanced programs\n• Add specific areas like "${cleanSearchTerm} fundamentals"`;
    }

    responseMessage += `\n\n*Using endpoint: /learningplan/v1/learningplans (search optimized for full phrases)*`;

    return NextResponse.json({
      response: responseMessage,
      success: true,
      data: {
        learningPlans: lpItems,
        totalCount: lpItems.length,
        displayedCount: plansToDisplay.length,
        remainingCount: remainingPlans,
        query: cleanSearchTerm,
        endpoint_used: '/learningplan/v1/learningplans',
        searchTermUsed: cleanSearchTerm
      },
      totalCount: lpItems.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Learning plan search error:', error);

    return NextResponse.json({
      response: `Learning Plan Search Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nUsing endpoint: /learningplan/v1/learningplans (removed sort_attr parameter that was causing 400 error)\n**Search term used**: "${entities.searchTerm || 'undefined'}"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

  // FIXED: Helper methods for mapping API response values
  private static mapUserStatus(status: any): string {
    if (status === '1' || status === 1) return '🟢 Active';
    if (status === '0' || status === 0) return '🔴 Inactive';
    if (status === '2' || status === 2) return '🟡 Suspended';
    return '⚪ Unknown';
  }

  private static mapUserLevel(level: any): string {
    if (level === 'godadmin') return '👑 Super Admin';
    if (level === 'power_user') return '🔧 Power User';
    if (level === 'course_creator') return '📚 Course Creator';
    if (level === '3' || level === 3) return '👤 Student';
    return level?.toString() || 'User';
  }
}
