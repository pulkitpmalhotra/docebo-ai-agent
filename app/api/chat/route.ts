import { NextRequest, NextResponse } from 'next/server';
import { DoceboClient } from '@/lib/docebo';
import { processUserQueryWithGemini, generateHelpResponseWithGemini, GeminiCostTracker } from '@/lib/gemini';
import { createApprovalRequest, logAuditEvent } from '@/lib/approval';

const docebo = new DoceboClient();
const costTracker = GeminiCostTracker.getInstance();

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    // Track input length for cost calculation
    const inputLength = message.length;
    
    // Process the user's message with Gemini
    const action = await processUserQueryWithGemini(message);
    
    // Log the user query
    await logAuditEvent({
      user_id: 'demo-user', // In real app, get from auth
      action: 'chat_query',
      details: { query: message, parsed_intent: action.intent },
    });

    let response: string;
    let outputLength = 0;

    switch (action.intent) {
      case 'search_users':
        const users = await docebo.getUsers({
          search: action.entities.query,
          limit: action.entities.limit || 10,
        });
        response = formatUsersResponse(users);
        break;

      case 'search_courses':
        const courses = await docebo.getCourses({
          search: action.entities.query,
          limit: action.entities.limit || 10,
        });
        response = formatCoursesResponse(courses);
        break;

      case 'get_user_enrollments':
        // First find the user
        const userSearch = await docebo.getUsers({
          search: action.entities.user_email,
        });
        
        if (userSearch.data.length === 0) {
          response = `User with email ${action.entities.user_email} not found.`;
        } else {
          const enrollments = await docebo.getEnrollments(userSearch.data[0].id);
          response = formatEnrollmentsResponse(action.entities.user_email, enrollments);
        }
        break;

      case 'enroll_user':
        // This requires approval
        const approvalRequest = await createApprovalRequest({
          user_id: 'demo-user',
          action_type: 'enroll_user',
          description: `Enroll ${action.entities.user_email} in ${action.entities.course_name}`,
          payload: action.entities,
        });
        
        response = `🔐 **Approval Required**

I've created an approval request for enrolling ${action.entities.user_email} in ${action.entities.course_name}.

**What happens next:**
1. ✅ Request logged in approval queue
2. 👨‍💼 Admin notification sent
3. ⏱️ Typical approval time: 2-4 hours
4. 📧 You'll be notified when completed

**Request ID:** #${approvalRequest.id}

Check the "Pending Approvals" panel for status updates!`;
        break;

      case 'get_help':
        response = await generateHelpResponseWithGemini(action.entities.topic);
        break;

      default:
        response = "I'm not sure how to help with that. Can you try rephrasing your request?";
    }

    outputLength = response.length;

    // Track costs
    const costInfo = costTracker.trackUsage(inputLength, outputLength);
    
    // Include cost info in response headers for monitoring
    const headers = new Headers();
    headers.set('X-Request-Cost', costInfo.request_cost.toString());
    headers.set('X-Monthly-Total', costInfo.monthly_total.toString());

    return NextResponse.json({ response }, { headers });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Sorry, I encountered an error processing your request.' },
      { status: 500 }
    );
  }
}

// Helper functions remain the same as before
function formatUsersResponse(users: any): string {
  if (!users.data || users.data.length === 0) {
    return "No users found matching your search.";
  }

  const userList = users.data
    .slice(0, 5)
    .map((user: any) => `• **${user.firstname} ${user.lastname}** (${user.email}) - ${user.department || 'No department'}`)
    .join('\n');

  return `Found ${users.data.length} users:\n\n${userList}${
    users.data.length > 5 ? '\n\n... and more. Try a more specific search to narrow results.' : ''
  }`;
}

function formatCoursesResponse(courses: any): string {
  if (!courses.data || courses.data.length === 0) {
    return "No courses found matching your search.";
  }

  const courseList = courses.data
    .slice(0, 5)
    .map((course: any) => `• **${course.name}** (ID: ${course.id}) - ${course.enrolled_users || 0} enrolled`)
    .join('\n');

  return `Found ${courses.data.length} courses:\n\n${courseList}${
    courses.data.length > 5 ? '\n\n... and more. Try a more specific search to narrow results.' : ''
  }`;
}

function formatEnrollmentsResponse(email: string, enrollments: any): string {
  if (!enrollments.data || enrollments.data.length === 0) {
    return `${email} has no active enrollments.`;
  }

  const enrollmentList = enrollments.data
    .slice(0, 10)
    .map((enrollment: any) => 
      `• **${enrollment.course_name}** - Status: ${enrollment.status} (${enrollment.completion_percentage || 0}% complete)`
    )
    .join('\n');

  return `**${email}** is enrolled in ${enrollments.data.length} courses:\n\n${enrollmentList}`;
}
