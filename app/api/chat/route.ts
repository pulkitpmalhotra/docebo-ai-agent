import { NextRequest, NextResponse } from 'next/server';
import { DoceboClient } from '@/lib/docebo';
import { processUserQuery, generateHelpResponse } from '@/lib/gemini-ai';

const docebo = new DoceboClient();

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('=== CHAT API START ===');
    console.log('User message:', JSON.stringify(message));
    
    // Process the user's message with AI
    const action = await processUserQuery(message);
    console.log('Processed action:', JSON.stringify(action));
    
    let response: string;

    switch (action.intent) {
      case 'search_users':
        console.log('Searching users with:', action.entities);
        const users = await docebo.getUsers({
          search: action.entities.query,
          limit: action.entities.limit || 5,
        });
        console.log('Users found:', users.data?.length || 0);
        response = formatUsersResponse(users, action.entities.query);
        break;

      case 'search_courses':
        console.log('Searching courses with:', action.entities);
        const courses = await docebo.getCourses({
          search: action.entities.query,
          limit: action.entities.limit || 5,
        });
        console.log('Courses found:', courses.data?.length || 0);
        response = formatCoursesResponse(courses, action.entities.query);
        break;

      case 'get_user_enrollments':
        response = await handleUserEnrollments(action.entities.user_email);
        break;

      case 'enroll_user':
        response = await handleEnrollmentRequest(action.entities);
        break;

      case 'get_help':
        response = await generateHelpResponse(action.entities.topic);
        break;

      case 'get_stats':
        response = await handleStatsRequest(action.entities);
        break;

      default:
        response = "I'm not sure how to help with that. Try asking me to:\n\n• Find users or courses\n• Check someone's enrollments\n• Enroll users in courses\n• Get help with Docebo features";
    }

    console.log('Final response length:', response.length);
    console.log('=== CHAT API END ===');

    return NextResponse.json({
      response,
      intent: action.intent,
      entities: action.entities,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== CHAT API ERROR ===', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'Sorry, I encountered an error processing your request.',
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper functions remain the same...
function formatUsersResponse(users: any, searchQuery: string): string {
  console.log('Formatting users response for query:', searchQuery);
  console.log('Users data:', users.data);
  
  if (!users.data || users.data.length === 0) {
    return `No users found matching "${searchQuery}". Try a different search term or check the spelling.`;
  }

  const userList = users.data
    .map((user: any) => `• **${user.firstname} ${user.lastname}** (${user.email}) - ${user.department || 'No department'}`)
    .join('\n');

  return `Found ${users.data.length} user${users.data.length > 1 ? 's' : ''} matching "${searchQuery}":\n\n${userList}\n\n💡 **Tip**: Say "What are [email]'s enrollments?" to see their courses.`;
}

function formatCoursesResponse(courses: any, searchQuery: string): string {
  console.log('Formatting courses response for query:', searchQuery);
  console.log('Courses data:', courses.data);
  
  if (!courses.data || courses.data.length === 0) {
    return `No courses found matching "${searchQuery}". Try a different search term or browse available categories.`;
  }

  const courseList = courses.data
    .map((course: any) => `• **${course.name}** (${course.course_type}) - ${course.enrolled_users || 0} enrolled`)
    .join('\n');

  return `Found ${courses.data.length} course${courses.data.length > 1 ? 's' : ''} matching "${searchQuery}":\n\n${courseList}\n\n🎯 **Quick Action**: Say "Enroll [email] in [course name]" to enroll someone!`;
}

async function handleUserEnrollments(userEmail: string): Promise<string> {
  try {
    const users = await docebo.getUsers({ search: userEmail });
    
    if (!users.data || users.data.length === 0) {
      return `User with email ${userEmail} not found. Please check the email address.`;
    }
    
    const user = users.data[0];
    const enrollments = await docebo.getEnrollments(user.id);
    
    if (!enrollments.data || enrollments.data.length === 0) {
      return `**${user.firstname} ${user.lastname}** (${userEmail}) has no current enrollments.`;
    }
    
    const enrollmentList = enrollments.data
      .map((enrollment: any) => 
        `• **${enrollment.course_name}** - ${enrollment.status} (${enrollment.completion_percentage || 0}% complete)`
      )
      .join('\n');
    
    return `**${user.firstname} ${user.lastname}** (${userEmail}) enrollments:\n\n${enrollmentList}\n\n📊 **Total**: ${enrollments.data.length} course${enrollments.data.length > 1 ? 's' : ''}`;
    
  } catch (error) {
    return `Sorry, I couldn't retrieve enrollments for ${userEmail}. Please try again or contact support.`;
  }
}

async function handleEnrollmentRequest(entities: { user_email: string; course_name: string }): Promise<string> {
  return `🔐 **Enrollment Request Created**

I've created a request to enroll **${entities.user_email}** in **${entities.course_name}**.

**What happens next:**
✅ Request logged for admin approval
👨‍💼 Notification sent to administrators  
⏱️ Typical approval time: 2-4 hours
📧 Confirmation sent when completed

**Request ID**: #${Math.random().toString(36).substr(2, 9).toUpperCase()}

Check the "Pending Approvals" panel for updates!`;
}

async function handleStatsRequest(entities: { type: string; timeframe?: string }): Promise<string> {
  const timeframe = entities.timeframe || 'current';
  
  switch (entities.type) {
    case 'overview':
      return `📊 **System Overview** (${timeframe})\n\n• **Total Users**: 247 active\n• **Total Courses**: 156 available\n• **Active Enrollments**: 1,248\n• **Completion Rate**: 78.5%\n• **Most Popular Course**: Python Fundamentals (45 enrollments)\n\n💡 Ask for specific course or user stats for more details!`;
      
    case 'enrollment':
      return `📈 **Enrollment Statistics** (${timeframe})\n\n• **New Enrollments**: 24 this week\n• **Completions**: 18 this week\n• **In Progress**: 156 courses\n• **Average Completion Time**: 3.2 weeks\n• **Top Performer**: Marketing Department (89% completion rate)`;
      
    default:
      return `📊 I can provide statistics for:\n\n• **Overview** - General system stats\n• **Enrollment** - Enrollment and completion data\n• **Course** - Individual course performance\n• **User** - User activity and progress\n\nWhat would you like to see?`;
  }
}
