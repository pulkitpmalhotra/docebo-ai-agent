// app/api/chat/handlers/enrollment.ts - FIXED with proper imports
import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';

export class EnrollmentHandlers {
  
  // ENHANCED: Individual Learning Plan Enrollment Handler
  static async handleEnrollUserInLearningPlan(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, learningPlanName, assignmentType, startValidity, endValidity } = entities;
      
      if (!email || !learningPlanName) {
        return NextResponse.json({
          response: `❌ **Missing Information**: I need both a user email and learning plan identifier.

**📋 Enhanced Examples:**
• "Enroll sarah@company.com in learning plan Data Science" (by name)
• "Enroll sarah@company.com in learning plan 190" (by ID)  
• "Enroll sarah@company.com in learning plan DS-2024" (by code)
• "Enroll sarah@company.com in learning plan Data Science with assignment type mandatory"
• "Enroll user@co.com in learning plan 190 as optional from 2025-01-15 to 2025-12-31"

**✅ Supported Assignment Types:**
• **mandatory** - Required for completion
• **required** - Same as mandatory  
• **recommended** - Suggested but not required
• **optional** - Completely optional
• **none specified** - Uses default (no assignment type)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ENHANCED LP: Processing individual learning plan enrollment:`);
      console.log(`👤 User: ${email}`);
      console.log(`📋 Learning Plan: ${learningPlanName}`);
      console.log(`🔧 Assignment Type: ${assignmentType || 'default (empty)'}`);
      console.log(`📅 Validity: ${startValidity || 'none'} to ${endValidity || 'none'}`);

      // Find user first
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}

No user found with that email address. Please verify the email is correct and the user exists in Docebo.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Enhanced learning plan search with name/ID/code support
      let learningPlan;
      try {
        learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      } catch (lpError) {
        return NextResponse.json({
          response: `❌ **Learning Plan Search Error**: ${lpError instanceof Error ? lpError.message : 'Unknown error'}

**💡 Learning Plan Identification Tips:**
• **By Name**: Use the exact, complete learning plan name
• **By ID**: Use the numeric ID (e.g., "190", "274")  
• **By Code**: Use the learning plan code (e.g., "DS-2024", "LEAD-101")
• **Check spelling and capitalization** for name-based searches
• **Use ID for guaranteed exact matching** when dealing with similar names

**📋 Example Commands:**
• "Enroll user@co.com in learning plan 190" (by ID - most reliable)
• "Enroll user@co.com in learning plan Data Science Program" (exact name)
• "Enroll user@co.com in learning plan DS-2024" (by code)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);
      const lpCode = learningPlan.code || 'N/A';

      // Enhanced enrollment options
      const enrollmentOptions: any = {};

      if (assignmentType && assignmentType !== 'none') {
        enrollmentOptions.assignmentType = assignmentType;
      }
      if (startValidity) {
        enrollmentOptions.startValidity = startValidity;
      }
      if (endValidity) {
        enrollmentOptions.endValidity = endValidity;
      }

      console.log(`🔧 ENHANCED LP: Final enrollment options:`, enrollmentOptions);

      // Enroll user using the enhanced method
      const enrollmentResult = await api.enrollUserInLearningPlan(user.user_id || user.id, learningPlanId, enrollmentOptions);

      let responseMessage = `✅ **Learning Plan Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
📋 **Learning Plan**: ${displayLearningPlanName}
🔗 **Learning Plan ID**: ${learningPlanId}
🏷️ **Learning Plan Code**: ${lpCode}`;

      // Show assignment type if specified
      if (assignmentType && assignmentType !== 'none') {
        responseMessage += `\n📋 **Assignment Type**: ${assignmentType.toUpperCase()}`;
      } else {
        responseMessage += `\n📋 **Assignment Type**: Default (no specific assignment type)`;
      }

      responseMessage += `\n📅 **Enrolled**: ${new Date().toLocaleDateString()}`;

      // Add validity information if provided
      if (startValidity) {
        responseMessage += `\n📅 **Start Validity**: ${startValidity}`;
      }
      if (endValidity) {
        responseMessage += `\n📅 **End Validity**: ${endValidity}`;
      }

      responseMessage += `\n\n🎯 **Enrollment Details:**
• User has been successfully enrolled in the learning plan
• Assignment type: ${assignmentType ? assignmentType.toUpperCase() : 'Default (no assignment type)'}
• Learning plan courses will be automatically assigned based on plan settings
• User will receive notifications according to platform settings`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          learningPlan: {
            id: learningPlanId,
            name: displayLearningPlanName,
            code: lpCode
          },
          enrollmentOptions: enrollmentOptions,
          enrollmentResult: enrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Enhanced learning plan enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔍 Troubleshooting Checklist:**
• **User Email**: Verify the user exists and email is spelled correctly
• **Learning Plan**: Check name/ID/code is exact and learning plan exists
• **Assignment Types**: Use "mandatory", "required", "recommended", or "optional"
• **Date Format**: Use YYYY-MM-DD format for validity dates
• **Permissions**: Ensure you have permission to enroll users in learning plans
• **Learning Plan Status**: Verify the learning plan is published and available

**✅ Supported Identifiers:**
• **By ID**: Most reliable - "190", "274", etc.
• **By Name**: Exact match - "Data Science Program"  
• **By Code**: If available - "DS-2024", "LEAD-101"

**📝 Valid Command Formats:**
• "Enroll user@email.com in learning plan 190"
• "Enroll user@email.com in learning plan Data Science as mandatory"
• "Enroll user@email.com in learning plan DS-2024 from 2025-01-15 to 2025-12-31"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Individual Course Enrollment Handler
  static async handleEnrollUserInCourse(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, courseName, assignmentType, startValidity, endValidity } = entities;
      
      if (!email || !courseName) {
        return NextResponse.json({
          response: `❌ **Missing Information**: I need both a user email and course identifier.

**📚 Course Enrollment Examples**:
• "Enroll john@company.com in course Python Programming"
• "Enroll sarah@company.com in course 123" (by ID)
• "Enroll user@company.com in course 'Data Science' with assignment type mandatory"
• "Enroll mike@company.com in course 'Excel Training' from 2025-01-15 to 2025-12-31"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ENHANCED ENROLL: Processing course enrollment: ${email} -> "${courseName}"`);

      // Find user first
      const user = await api.findUserByEmail(email);
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}

No user found with that email address. Please verify the email is correct and the user exists in Docebo.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find course with enhanced error handling
      let course;
      try {
        course = await api.findCourseByIdentifier(courseName);
      } catch (courseError) {
        return NextResponse.json({
          response: `❌ **Course Search Error**: ${courseError instanceof Error ? courseError.message : 'Unknown error'}

**💡 Course Identification Tips:**
• **By Name**: Use the exact, complete course name
• **By ID**: Use the numeric course ID for guaranteed exact matching
• **Check spelling and capitalization** for name-based searches

**📚 Example Commands:**
• "Enroll user@company.com in course 123" (by ID - most reliable)
• "Enroll user@company.com in course 'Python Programming'" (exact name)

**🔍 Find the Course First:**
• "find courses python" (to search for courses)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseId = (course.id || course.course_id || course.idCourse).toString();
      const displayCourseName = api.getCourseName(course);

      // Prepare enrollment options
      const enrollmentOptions: any = { level: 'student' };

      if (assignmentType && assignmentType !== 'none') {
        enrollmentOptions.assignmentType = assignmentType;
      }
      if (startValidity) {
        enrollmentOptions.startValidity = startValidity;
      }
      if (endValidity) {
        enrollmentOptions.endValidity = endValidity;
      }

      console.log(`🔧 ENHANCED ENROLL: Final enrollment options:`, enrollmentOptions);

      // Enroll user in course
      const enrollmentResult = await api.enrollUserInCourse(user.user_id || user.id, courseId, enrollmentOptions);

      let responseMessage = `✅ **Course Enrollment Successful**

👤 **User**: ${user.fullname} (${email})
📚 **Course**: ${displayCourseName}
🔗 **Course ID**: ${courseId}`;

      if (assignmentType && assignmentType !== 'none') {
        responseMessage += `\n📋 **Assignment Type**: ${assignmentType.toUpperCase()}`;
      } else {
        responseMessage += `\n📋 **Assignment Type**: Default`;
      }

      responseMessage += `\n📅 **Enrolled**: ${new Date().toLocaleDateString()}`;

      if (startValidity) {
        responseMessage += `\n📅 **Start Validity**: ${startValidity}`;
      }
      if (endValidity) {
        responseMessage += `\n📅 **End Validity**: ${endValidity}`;
      }

      responseMessage += `\n\n🎯 **Enrollment Details:**
• User has been successfully enrolled in the course
• Assignment type: ${assignmentType ? assignmentType.toUpperCase() : 'Default'}
• User will receive notifications according to platform settings
• Course access begins immediately unless validity dates specify otherwise`;

      return NextResponse.json({
        response: responseMessage,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          course: {
            id: courseId,
            name: displayCourseName
          },
          enrollmentOptions: enrollmentOptions,
          enrollmentResult: enrollmentResult
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Enhanced course enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Course Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔍 Troubleshooting Checklist:**
• **User Email**: Verify the user exists and email is spelled correctly
• **Course Name**: Check name/ID is exact and course exists
• **Assignment Types**: Use "mandatory", "required", "recommended", or "optional"
• **Date Format**: Use YYYY-MM-DD format for validity dates
• **Permissions**: Ensure you have permission to enroll users in courses
• **Course Status**: Verify the course is published and available for enrollment`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Unenroll user from course
  static async handleUnenrollUserFromCourse(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, courseName } = entities;
      
      if (!email || !courseName) {
        return NextResponse.json({
          response: `❌ **Missing Information**: I need both a user email and course name/ID to unenroll.

**Examples**: 
• "Unenroll john@company.com from course Python Programming"
• "Unenroll sarah@company.com from course 2420" (using course ID)
• "Remove mike@company.com from course Excel Training"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔄 ENHANCED UNENROLL: Processing unenrollment: ${email} from course "${courseName}"`);

      // Step 1: Find user with enhanced error handling
      let user;
      try {
        user = await api.findUserByEmail(email);
        
        if (!user) {
          return NextResponse.json({
            response: `❌ **User Not Found**: ${email}

No user found with that email address. Please verify:
• Email spelling is correct
• User exists in the system
• Email domain is correct`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (userError) {
        console.error(`❌ User search failed:`, userError);
        return NextResponse.json({
          response: `❌ **User Search Failed**: ${userError instanceof Error ? userError.message : 'Unknown error'}

Please verify the email address is correct.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Step 2: Find course with enhanced error handling
      let course;
      try {
        course = await api.findCourseByIdentifier(courseName);
      } catch (courseError) {
        console.error(`❌ Course search failed:`, courseError);
        return NextResponse.json({
          response: `❌ **Course Search Failed**: ${courseError instanceof Error ? courseError.message : 'Unknown error'}

**💡 Troubleshooting Tips:**
• **Use Course ID**: If you know the course ID, use "unenroll ${email} from course [ID]"
• **Check Course Name**: Verify the exact course name from the course search results
• **Try Searching**: Use "find courses [keyword]" to find the exact course name
• **Use Quotes**: Try "unenroll ${email} from course 'Exact Course Name'"

**Examples**:
• "unenroll ${email} from course 2420" (using ID - most reliable)
• "find courses customer objectives" (to search first)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const courseId = (course.id || course.course_id || course.idCourse).toString();
      const displayCourseName = api.getCourseName(course);
      const userId = (user.user_id || user.id).toString();

      console.log(`👤 User found: ${user.fullname} (ID: ${userId})`);
      console.log(`📚 Course found: ${displayCourseName} (ID: ${courseId})`);

      // Step 3: Attempt unenrollment with enhanced error handling
      try {
        await api.unenrollUserFromCourse(userId, courseId);
        
        return NextResponse.json({
          response: `✅ **Course Unenrollment Successful**

👤 **User**: ${user.fullname} (${user.email})
📚 **Course**: ${displayCourseName}
🔗 **Course ID**: ${courseId}
📅 **Unenrolled**: ${new Date().toLocaleDateString()}

**✅ Confirmation**: The user has been successfully removed from the course.

**💡 Next Steps**:
• User will no longer have access to course materials
• Course progress will be preserved but inaccessible
• User can be re-enrolled later if needed`,
          success: true,
          data: {
            user: {
              id: userId,
              fullname: user.fullname,
              email: user.email
            },
            course: {
              id: courseId,
              name: displayCourseName
            },
            operation: 'unenroll',
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });

      } catch (unenrollError) {
        console.error(`❌ Unenrollment failed:`, unenrollError);
        
        // Provide specific error guidance based on common issues
        let errorGuidance = '';
        const errorMessage = unenrollError instanceof Error ? unenrollError.message : 'Unknown error';
        
        if (errorMessage.includes('not enrolled') || errorMessage.includes('enrollment not found')) {
          errorGuidance = `**💡 Possible Reason**: The user may not be currently enrolled in this course.

**🔍 Check Enrollment Status**:
• "Check if ${email} is enrolled in course ${displayCourseName}"
• "User enrollments ${email}" (to see all enrollments)`;
        } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
          errorGuidance = `**💡 Possible Reason**: Insufficient permissions to unenroll users.

**🔧 Solutions**:
• Contact your Docebo administrator
• Verify your API user has enrollment management permissions`;
        } else {
          errorGuidance = `**💡 Alternative Approaches**:
• Try using the course ID instead: "unenroll ${email} from course ${courseId}"
• Check if user is actually enrolled: "Check if ${email} is enrolled in course ${displayCourseName}"
• Contact support if the issue persists`;
        }
        
        return NextResponse.json({
          response: `❌ **Unenrollment Failed**: ${errorMessage}

👤 **User**: ${user.fullname} (${user.email})
📚 **Course**: ${displayCourseName} (ID: ${courseId})

${errorGuidance}`,
          success: false,
          data: {
            user: { id: userId, fullname: user.fullname, email: user.email },
            course: { id: courseId, name: displayCourseName },
            error: errorMessage,
            operation: 'unenroll_failed'
          },
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('❌ Enhanced unenrollment handler error:', error);
      
      return NextResponse.json({
        response: `❌ **Unenrollment System Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔧 Troubleshooting Steps**:
1. **Verify Input**: Check that both email and course name/ID are correct
2. **Try Course ID**: Use the numeric course ID for more reliable matching
3. **Check Enrollment**: Verify the user is actually enrolled in the course
4. **Simplify Request**: Try with a simpler course name or ID

**💡 Examples of Working Commands**:
• "unenroll user@email.com from course 2420"
• "unenroll user@email.com from course 'Exact Course Name'"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Unenroll user from learning plan
  static async handleUnenrollUserFromLearningPlan(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { email, learningPlanName } = entities;
      
      if (!email || !learningPlanName) {
        return NextResponse.json({
          response: `❌ **Missing Information**: I need both a user email and learning plan name to unenroll.

**Example**: "Unenroll john@company.com from learning plan Data Science"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find user
      const users = await api.searchUsers(email, 5);
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return NextResponse.json({
          response: `❌ **User Not Found**: ${email}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      // Find learning plan
      const learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      // Unenroll user
      await api.unenrollUserFromLearningPlan(user.user_id || user.id, learningPlanId);

      return NextResponse.json({
        response: `✅ **Learning Plan Unenrollment Successful**

👤 **User**: ${user.fullname} (${email})
📋 **Learning Plan**: ${displayLearningPlanName}
🔗 **Learning Plan ID**: ${learningPlanId}
📅 **Unenrolled**: ${new Date().toLocaleDateString()}

The user has been successfully removed from the learning plan.`,
        success: true,
        data: {
          user: {
            id: user.user_id || user.id,
            fullname: user.fullname,
            email: user.email
          },
          learningPlan: {
            id: learningPlanId,
            name: displayLearningPlanName
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Learning plan unenrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Learning Plan Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
}
