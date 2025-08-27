// app/api/chat/handlers/ilt-session.ts - NEW FILE for ILT Session Management
import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';

export class ILTSessionHandlers {
  
  // Create ILT Session with Events
  static async handleCreateILTSession(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { 
        courseId, 
        courseName, 
        sessionName,
        startDate, 
        endDate, 
        startTime, 
        endTime,
        timezone,
        location,
        maxParticipants,
        instructorEmail,
        description
      } = entities;
      
      if (!courseId && !courseName) {
        return NextResponse.json({
          response: `❌ **Missing Course Information**: I need either a course ID or course name to create an ILT session.

**📚 Examples**:
• "Create ILT session for course 2420 on 2025-02-15 from 9:00 to 17:00"
• "Create session 'Python Workshop' for course 'Python Programming' on March 15th 2025"
• "Schedule ILT session for course Data Science from 2025-03-01 to 2025-03-03"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ILT CREATE: Creating session for course: ${courseId || courseName}`);

      // Find course if name provided
      let course;
      let finalCourseId = courseId;
      
      if (!courseId && courseName) {
        try {
          course = await api.findCourseByIdentifier(courseName);
          finalCourseId = course.id || course.course_id || course.idCourse;
        } catch (courseError) {
          return NextResponse.json({
            response: `❌ **Course Not Found**: ${courseError instanceof Error ? courseError.message : 'Unknown error'}

Please verify the course name or use the course ID instead.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Find instructor if email provided
      let instructor = null;
      if (instructorEmail) {
        try {
          instructor = await api.findUserByEmail(instructorEmail);
          if (!instructor) {
            console.log(`⚠️ Instructor not found: ${instructorEmail}`);
          }
        } catch (error) {
          console.log(`⚠️ Error finding instructor: ${error}`);
        }
      }

      // Prepare session data
      const sessionData = {
        course_id: parseInt(finalCourseId),
        name: sessionName || `ILT Session - ${new Date().toLocaleDateString()}`,
        description: description || `Instructor-led training session for course ${finalCourseId}`,
        timezone: timezone || 'UTC',
        location_type: location ? 'classroom' : 'virtual',
        location: location || 'Virtual Session',
        max_participants: maxParticipants || 50,
        min_participants: 1,
        instructor_id: instructor ? parseInt(instructor.user_id || instructor.id) : null,
        auto_enroll: false,
        attendance_tracking: true,
        session_events: []
      };

      // Add session events if dates/times provided
      if (startDate) {
        const event = {
          start_date: startDate,
          end_date: endDate || startDate,
          start_time: startTime || '09:00:00',
          end_time: endTime || '17:00:00',
          timezone: timezone || 'UTC',
          location: location || 'Virtual Session'
        };
        sessionData.session_events.push(event);
      }

      console.log(`📋 Session data:`, sessionData);

      // Create session via API
      const sessionResult = await api.createILTSession(sessionData);

      let responseMessage = `✅ **ILT Session Created Successfully**

📚 **Course**: ${course ? api.getCourseName(course) : `Course ID ${finalCourseId}`}
🎓 **Session**: ${sessionData.name}
🆔 **Session ID**: ${sessionResult.session_id || sessionResult.id || 'Generated'}
📍 **Location**: ${sessionData.location}
👥 **Max Participants**: ${sessionData.max_participants}`;

      if (instructor) {
        responseMessage += `\n👨‍🏫 **Instructor**: ${instructor.fullname} (${instructor.email})`;
      }

      if (sessionData.session_events.length > 0) {
        responseMessage += `\n\n📅 **Scheduled Events**:`;
        sessionData.session_events.forEach((event, index) => {
          responseMessage += `\n${index + 1}. ${event.start_date} ${event.start_time} - ${event.end_time} (${event.timezone})`;
        });
      }

      responseMessage += `\n\n🎯 **Next Steps**:
• "Enroll user@email.com in ILT session ${sessionResult.session_id || sessionResult.id}"
• "List ILT sessions for course ${finalCourseId}"
• "Update ILT session ${sessionResult.session_id || sessionResult.id}"`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          session: sessionResult,
          course: { id: finalCourseId, name: course ? api.getCourseName(course) : null },
          instructor: instructor,
          sessionData: sessionData
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ ILT session creation error:', error);
      
      return NextResponse.json({
        response: `❌ **ILT Session Creation Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔍 Common Issues**:
• Course ID or name is invalid
• Insufficient permissions to create sessions
• Invalid date/time format (use YYYY-MM-DD and HH:MM:SS)
• Instructor email not found in system

**💡 Try**:
• "Create session for course 2420 on 2025-02-15"
• "Schedule ILT for course 'Python Programming' with instructor john@company.com"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Enroll Single User in ILT Session
  static async handleEnrollUserInILTSession(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, sessionId, sessionName, courseId, courseName } = entities;
      
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing User Email**: I need a user email for ILT session enrollment.

**Examples**:
• "Enroll john@company.com in ILT session 123"
• "Add sarah@company.com to session 'Python Workshop'"
• "Register mike@company.com for session in course 2420"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      if (!sessionId && !sessionName && !courseId && !courseName) {
        return NextResponse.json({
          response: `❌ **Missing Session Information**: I need session ID, session name, or course information.

**Examples**:
• "Enroll user@email.com in ILT session 123" (by session ID)
• "Enroll user@email.com in session 'Python Workshop'" (by session name)
• "Enroll user@email.com in ILT session for course 2420" (by course)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ILT ENROLL: Enrolling ${email} in session`);

      // Find user
      const user = await api.findUserByEmail(email);
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}

Please verify the email address is correct and the user exists in Docebo.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find session
      let session;
      try {
        if (sessionId) {
          session = await api.getILTSession(sessionId);
        } else if (sessionName) {
          session = await api.findILTSessionByName(sessionName);
        } else if (courseId || courseName) {
          const sessions = await api.getILTSessionsForCourse(courseId || courseName);
          if (sessions.length === 1) {
            session = sessions[0];
          } else if (sessions.length > 1) {
            const sessionList = sessions.map((s: any) => `"${s.name}" (ID: ${s.id})`).join(', ');
            return NextResponse.json({
              response: `❌ **Multiple Sessions Found**: Found ${sessions.length} sessions for this course.

Please specify which session: ${sessionList}

**Examples**:
• "Enroll ${email} in ILT session ${sessions[0].id}"
• "Enroll ${email} in session '${sessions[0].name}'"`,
              success: false,
              timestamp: new Date().toISOString()
            });
          } else {
            return NextResponse.json({
              response: `❌ **No Sessions Found**: No ILT sessions found for the specified course.

Try creating a session first:
• "Create ILT session for course ${courseId || courseName}"`,
              success: false,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (sessionError) {
        return NextResponse.json({
          response: `❌ **Session Not Found**: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Enroll user in session
      const enrollmentResult = await api.enrollUserInILTSession(
        user.user_id || user.id,
        session.id || session.session_id
      );

      return NextResponse.json({
        response: `✅ **ILT Session Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
🎓 **Session**: ${session.name || session.session_name}
🆔 **Session ID**: ${session.id || session.session_id}
📚 **Course**: ${session.course_name || `Course ${session.course_id}`}
📅 **Enrolled**: ${new Date().toLocaleDateString()}

🎯 **Next Steps**:
• "Mark ${email} as attended in session ${session.id || session.session_id}"
• "List participants in session ${session.id || session.session_id}"
• "Get session details ${session.id || session.session_id}"`,
        success: true,
        data: {
          user: { id: user.user_id || user.id, fullname: user.fullname, email: user.email },
          session: session,
          enrollmentResult: enrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ ILT session enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **ILT Session Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Bulk Enroll Users in ILT Session
  static async handleBulkEnrollInILTSession(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { emails, sessionId, sessionName } = entities;
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: `❌ **Missing User Emails**: I need a list of user emails for bulk ILT session enrollment.

**Examples**:
• "Enroll john@co.com,sarah@co.com,mike@co.com in ILT session 123"
• "Add team members to session 'Python Workshop': user1@co.com,user2@co.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ILT BULK ENROLL: Processing ${emails.length} users for session`);

      // Find session
      let session;
      try {
        if (sessionId) {
          session = await api.getILTSession(sessionId);
        } else if (sessionName) {
          session = await api.findILTSessionByName(sessionName);
        } else {
          return NextResponse.json({
            response: `❌ **Missing Session Information**: Please provide session ID or session name.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (sessionError) {
        return NextResponse.json({
          response: `❌ **Session Not Found**: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Process bulk enrollment
      const result = await this.processBulkILTEnrollment(emails, session, api);

      return this.formatBulkILTResponse(result, session, 'enroll');

    } catch (error) {
      console.error('❌ Bulk ILT enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk ILT Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Mark Session Attendance
  static async handleMarkSessionAttendance(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, emails, sessionId, sessionName, attendanceStatus, completionStatus } = entities;
      
      const userEmails = emails && emails.length > 0 ? emails : (email ? [email] : []);
      
      if (userEmails.length === 0) {
        return NextResponse.json({
          response: `❌ **Missing User Information**: I need user email(s) to mark attendance.

**Examples**:
• "Mark john@company.com as attended in session 123"
• "Mark sarah@company.com as completed in session 'Python Workshop'"
• "Set attendance for user1@co.com,user2@co.com in session 123"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ILT ATTENDANCE: Marking attendance for ${userEmails.length} users`);

      // Find session
      let session;
      try {
        if (sessionId) {
          session = await api.getILTSession(sessionId);
        } else if (sessionName) {
          session = await api.findILTSessionByName(sessionName);
        } else {
          return NextResponse.json({
            response: `❌ **Missing Session Information**: Please provide session ID or session name.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (sessionError) {
        return NextResponse.json({
          response: `❌ **Session Not Found**: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Process attendance marking
      const result = await this.processAttendanceMarking(userEmails, session, attendanceStatus, completionStatus, api);

      return this.formatAttendanceResponse(result, session, attendanceStatus, completionStatus);

    } catch (error) {
      console.error('❌ Attendance marking error:', error);
      
      return NextResponse.json({
        response: `❌ **Attendance Marking Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Private helper methods
  private static async processBulkILTEnrollment(emails: string[], session: any, api: DoceboAPI): Promise<any> {
    const result = {
      successful: [],
      failed: [],
      summary: { total: emails.length, successful: 0, failed: 0 }
    };

    const batchSize = 3;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (email) => {
        try {
          const user = await api.findUserByEmail(email);
          if (!user) {
            result.failed.push({ email, error: 'User not found' });
            return;
          }

          await api.enrollUserInILTSession(user.user_id || user.id, session.id || session.session_id);
          result.successful.push({ email, userId: user.user_id || user.id });
          
        } catch (error) {
          result.failed.push({ 
            email, 
            error: error instanceof Error ? error.message : 'Enrollment failed' 
          });
        }
      }));

      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    return result;
  }

  private static async processAttendanceMarking(emails: string[], session: any, attendanceStatus: string, completionStatus: string, api: DoceboAPI): Promise<any> {
    const result = {
      successful: [],
      failed: [],
      summary: { total: emails.length, successful: 0, failed: 0 }
    };

    for (const email of emails) {
      try {
        const user = await api.findUserByEmail(email);
        if (!user) {
          result.failed.push({ email, error: 'User not found' });
          continue;
        }

        const attendanceData = {
          user_id: user.user_id || user.id,
          session_id: session.id || session.session_id,
          attendance_status: attendanceStatus || 'attended',
          completion_status: completionStatus || 'completed',
          marked_date: new Date().toISOString()
        };

        await api.markILTSessionAttendance(attendanceData);
        result.successful.push({ email, userId: user.user_id || user.id, status: attendanceStatus });
        
      } catch (error) {
        result.failed.push({ 
          email, 
          error: error instanceof Error ? error.message : 'Attendance marking failed' 
        });
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    return result;
  }

  private static formatBulkILTResponse(result: any, session: any, action: string): NextResponse {
    let responseMessage = `📊 **Bulk ILT Session ${action === 'enroll' ? 'Enrollment' : 'Unenrollment'} Results**

🎓 **Session**: ${session.name || session.session_name}
🆔 **Session ID**: ${session.id || session.session_id}
📈 **Summary**: ${result.summary.successful}/${result.summary.total} users ${action === 'enroll' ? 'enrolled' : 'unenrolled'} successfully

`;

    if (result.successful.length > 0) {
      responseMessage += `✅ **Successful (${result.successful.length})**:\n`;
      result.successful.slice(0, 10).forEach((success: any, index: number) => {
        responseMessage += `${index + 1}. ${success.email}\n`;
      });
      
      if (result.successful.length > 10) {
        responseMessage += `... and ${result.successful.length - 10} more users\n`;
      }
      responseMessage += '\n';
    }

    if (result.failed.length > 0) {
      responseMessage += `❌ **Failed (${result.failed.length})**:\n`;
      result.failed.slice(0, 5).forEach((failure: any, index: number) => {
        responseMessage += `${index + 1}. ${failure.email} - ${failure.error}\n`;
      });
      responseMessage += '\n';
    }

    return NextResponse.json({
      response: responseMessage,
      success: result.summary.successful > 0,
      data: { bulkResult: result, session: session },
      timestamp: new Date().toISOString()
    });
  }

  private static formatAttendanceResponse(result: any, session: any, attendanceStatus: string, completionStatus: string): NextResponse {
    let responseMessage = `📊 **Session Attendance Marking Results**

🎓 **Session**: ${session.name || session.session_name}
📈 **Summary**: ${result.summary.successful}/${result.summary.total} users marked successfully
📋 **Status**: ${attendanceStatus || 'attended'} / ${completionStatus || 'completed'}

`;

    if (result.successful.length > 0) {
      responseMessage += `✅ **Successfully Marked (${result.successful.length})**:\n`;
      result.successful.forEach((success: any, index: number) => {
        responseMessage += `${index + 1}. ${success.email} - ${success.status}\n`;
      });
      responseMessage += '\n';
    }

    if (result.failed.length > 0) {
      responseMessage += `❌ **Failed (${result.failed.length})**:\n`;
      result.failed.forEach((failure: any, index: number) => {
        responseMessage += `${index + 1}. ${failure.email} - ${failure.error}\n`;
      });
    }

    return NextResponse.json({
      response: responseMessage,
      success: result.summary.successful > 0,
      data: { attendanceResult: result, session: session },
      timestamp: new Date().toISOString()
    });
  }
}
