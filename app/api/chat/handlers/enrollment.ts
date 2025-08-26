// ENHANCED: Enrollment Handlers with Full Learning Plan Support
// File: app/api/chat/handlers/enrollment.ts

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

  // ENHANCED: Bulk Learning Plan Enrollment Handler
  static async handleBulkLearningPlanEnrollment(entities: any, api: DoceboAPI): Promise<NextResponse> {
    try {
      const { emails, learningPlanName, assignmentType, startValidity, endValidity } = entities;
      
      console.log(`🎯 ENHANCED BULK LP: Processing entities:`, { 
        emails: emails?.length || 0, 
        learningPlanName, 
        assignmentType: assignmentType || 'default', 
        startValidity, 
        endValidity 
      });
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({
          response: `❌ **Missing Information**: I need a list of user emails for bulk learning plan enrollment.

**📋 Enhanced Bulk Examples:**
• "Enroll alice@co.com,bob@co.com,charlie@co.com in learning plan 190"
• "Enroll marketing team in learning plan Data Science Program" 
• "Bulk enroll sales@co.com,support@co.com in learning plan LEAD-2024 as mandatory"
• "Enroll team@co.com,mgr@co.com in learning plan 274 from 2025-01-15 to 2025-12-31"

**✅ Supported Assignment Types:**
• **mandatory** / **required** - Required for completion
• **recommended** - Suggested but not required  
• **optional** - Completely optional
• **none specified** - Uses default (no assignment type)`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      if (!learningPlanName) {
        return NextResponse.json({
          response: `❌ **Missing Learning Plan**: Please specify which learning plan to enroll users in.

**📋 Learning Plan Identification:**
• **By ID**: "190", "274" (most reliable)
• **By Name**: "Data Science Program" (exact match)
• **By Code**: "DS-2024", "LEAD-101" (if available)

**Example**: "Enroll alice@co.com,bob@co.com in learning plan 190 as mandatory"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🎯 ENHANCED BULK LP: Processing bulk learning plan enrollment: ${emails.length} users -> ${learningPlanName}`);

      // Enhanced learning plan search with name/ID/code support
      let learningPlan;
      try {
        learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
      } catch (lpError) {
        return NextResponse.json({
          response: `❌ **Learning Plan Not Found for Bulk Enrollment**: ${lpError instanceof Error ? lpError.message : 'Unknown error'}

**💡 For bulk operations, exact learning plan matching is critical:**
• **Use ID when possible**: "190", "274" (most reliable for bulk operations)
• **Use exact name**: Complete learning plan name with correct spelling
• **Use code**: Learning plan code if available (e.g., "DS-2024")
• **Check capitalization**: Names are case-sensitive

**⚠️ Important**: Bulk enrollment requires exact matching to prevent enrolling users in the wrong learning plan.

**🔧 Recommendation**: Use learning plan ID for bulk operations to ensure accuracy.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }

      const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();
      const displayLearningPlanName = api.getLearningPlanName(learningPlan);

      console.log(`📋 ENHANCED BULK LP: Found learning plan "${displayLearningPlanName}" (ID: ${learningPlanId}) for ${emails.length} users`);

      // Process bulk enrollment with enhanced support
      const result = await this.processBulkLearningPlanEnrollment(
        emails, 
        learningPlanId, 
        displayLearningPlanName, 
        api,
        assignmentType,
        startValidity,
        endValidity
      );

      return this.formatBulkResponse(result, displayLearningPlanName, 'learning_plan');

    } catch (error) {
      console.error('❌ Enhanced bulk learning plan enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **Bulk Learning Plan Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

**🔍 Common Issues & Solutions:**
• **User Emails**: Check all email addresses are correct and users exist
• **Learning Plan**: Verify name/ID/code is exact and matches exactly one learning plan  
• **Assignment Types**: Use "mandatory", "required", "recommended", or "optional"
• **Bulk Size**: Consider smaller batches for very large enrollments
• **Permissions**: Ensure you have permission to perform bulk enrollments

**💡 Pro Tips:**
• **Use learning plan IDs** for bulk operations (most reliable)
• **Test with 2-3 users first** before running large bulk operations
• **Check for existing enrollments** - some users might already be enrolled

**📝 Valid Bulk Command Format:**
"Enroll user1@co.com,user2@co.com,user3@co.com in learning plan 190 as mandatory"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper method to format bulk responses (shared with other bulk operations)
  private static formatBulkResponse(
    result: any, 
    resourceName: string, 
    resourceType: string,
    action: string = 'enroll'
  ): NextResponse {
    const actionText = action === 'enroll' ? 'Enrollment' : 'Unenrollment';
    const actionPastTense = action === 'enroll' ? 'enrolled' : 'unenrolled';
    const resourceIcon = resourceType === 'course' ? '📚' : '📋';
    const resourceTypeText = resourceType === 'course' ? 'Course' : 'Learning Plan';

    let responseMessage = `📊 **Bulk ${resourceTypeText} ${actionText} Results**

${resourceIcon} **${resourceTypeText}**: ${resourceName}
🎯 **Enhanced Matching**: Used exact identifier matching (name/ID/code)
📈 **Summary**: ${result.summary.successful}/${result.summary.total} users ${actionPastTense} successfully

`;

    // Show successful enrollments
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

    // Show failed enrollments
    if (result.failed.length > 0) {
      responseMessage += `❌ **Failed (${result.failed.length})**:\n`;
      result.failed.slice(0, 5).forEach((failure: any, index: number) => {
        responseMessage += `${index + 1}. ${failure.email} - ${failure.error}\n`;
      });
      
      if (result.failed.length > 5) {
        responseMessage += `... and ${result.failed.length - 5} more failures\n`;
      }
      responseMessage += '\n';
    }

    // Add recommendations based on results
    if (result.failed.length > 0) {
      responseMessage += `💡 **Next Steps for Failed Enrollments**:
• **User Not Found**: Check email spelling and verify users exist in system
• **Already Enrolled**: Users may already be enrolled (this is not an error)
• **Permission Issues**: Verify you have rights to enroll users in this ${resourceTypeText.toLowerCase()}
• **Learning Plan Issues**: Ensure learning plan is published and accessible
• **Try Individual**: Process failed users individually for detailed error messages`;
    } else {
      responseMessage += `🎉 **Perfect Results - All users successfully ${actionPastTense}!**

✅ **Enhanced Features Used:**
• **Exact ${resourceTypeText} Matching**: Identified resource by name/ID/code
• **Assignment Type Support**: Applied appropriate assignment requirements  
• **Validity Dates**: Set enrollment validity periods as specified
• **Bulk API Optimization**: Used efficient bulk enrollment endpoint
• **Error Handling**: Comprehensive validation and error reporting`;
    }

    responseMessage += `\n\n📅 **Completed**: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;

    return NextResponse.json({
      response: responseMessage,
      success: result.summary.successful > 0,
      data: {
        bulkResult: result,
        resourceName: resourceName,
        resourceType: resourceType,
        action: action,
        enhancedMatching: true,
        assignmentTypeSupport: true
      },
      totalCount: result.summary.total,
      successCount: result.summary.successful,
      failureCount: result.summary.failed,
      timestamp: new Date().toISOString()
    });
  }

  // ENHANCED: CSV Learning Plan Enrollment Support
  static async processCSVLearningPlanEnrollment(
    csvData: any, 
    api: DoceboAPI
  ): Promise<any> {
    const result: any = {
      successful: [],
      failed: [],
      summary: {
        total: csvData.validRows.length,
        successful: 0,
        failed: 0,
        operation: 'csv_lp_enrollment'
      }
    };

    console.log(`📊 ENHANCED CSV LP: Processing ${csvData.validRows.length} CSV learning plan enrollments`);

    // Process each row
    for (let i = 0; i < csvData.validRows.length; i++) {
      const row = csvData.validRows[i];
      const email = row[csvData.headers.indexOf('email')];
      const learningPlanIdentifier = row[csvData.headers.indexOf('learning_plan')];
      const assignmentType = row[csvData.headers.indexOf('assignment_type')] || null;

      console.log(`📋 ENHANCED CSV LP [${i + 1}/${csvData.validRows.length}]: Processing ${email} -> ${learningPlanIdentifier}`);

      try {
        // Find user
        const users = await api.searchUsers(email, 5);
        const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!user) {
          result.failed.push({
            email: email,
            error: 'User not found',
            resourceName: learningPlanIdentifier,
            operation: 'csv_lp_enrollment'
          });
          continue;
        }

        // Enhanced learning plan search
        const learningPlan = await api.findLearningPlanByIdentifier(learningPlanIdentifier);
        const learningPlanId = (learningPlan.learning_plan_id || learningPlan.id).toString();

        // Enroll with enhanced support
        const enrollmentOptions: any = {};
        if (assignmentType && assignmentType.toLowerCase() !== 'none') {
          enrollmentOptions.assignmentType = assignmentType;
        }

        await api.enrollUserInLearningPlan(user.user_id || user.id, learningPlanId, enrollmentOptions);
        
        result.successful.push({
          email: email,
          userId: user.user_id || user.id,
          resourceName: api.getLearningPlanName(learningPlan),
          resourceId: learningPlanId,
          operation: 'csv_lp_enrollment'
        });

        console.log(`✅ ENHANCED CSV LP [${i + 1}]: Success - ${email}`);

      } catch (error) {
        console.error(`❌ ENHANCED CSV LP [${i + 1}]: Failed - ${email}:`, error);
        result.failed.push({
          email: email,
          error: error instanceof Error ? error.message : 'Enrollment failed',
          resourceName: learningPlanIdentifier,
          operation: 'csv_lp_enrollment'
        });
      }

      // Small delay to be API-friendly
      if (i < csvData.validRows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    console.log(`📊 ENHANCED CSV LP: Completed - ${result.summary.successful}/${result.summary.total} successful`);
    return result;
  }
}
