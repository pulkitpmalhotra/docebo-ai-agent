// app/api/chat/handlers/csv-enrollment.ts - CSV-based bulk enrollment handler
import { NextResponse } from 'next/server';
import { DoceboAPI } from '../docebo-api';

interface CSVRow {
  email: string;
  resource: string;
  assignmentType?: string;
  resourceType?: string;
}

interface CSVProcessingResult {
  successful: Array<{
    email: string;
    userId: string;
    resourceName: string;
    resourceId: string;
    operation: string;
  }>;
  failed: Array<{
    email: string;
    resourceName: string;
    error: string;
    operation: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    operation: string;
    processingTime: number;
  };
}

export class CSVEnrollmentHandlers {
  
  static async handleCSVCourseEnrollment(csvData: any, api: DoceboAPI): Promise<NextResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Processing CSV course enrollment: ${csvData.validRows.length} rows`);

      const result = await this.processCSVEnrollment(
        csvData.validRows,
        csvData.headers,
        'course',
        api,
        async (userId: string, resourceId: string, options: any) => 
          await api.enrollUserInCourse(userId, resourceId, options)
      );

      result.summary.processingTime = Date.now() - startTime;
      return this.formatCSVResponse(result, 'Course Enrollment');

    } catch (error) {
      console.error('❌ CSV course enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **CSV Course Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• CSV format is correct
• All course names exist in Docebo
• All email addresses are valid
• You have permission to enroll users`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleCSVLearningPlanEnrollment(csvData: any, api: DoceboAPI): Promise<NextResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Processing CSV learning plan enrollment: ${csvData.validRows.length} rows`);

      const result = await this.processCSVEnrollment(
        csvData.validRows,
        csvData.headers,
        'learning_plan',
        api,
        async (userId: string, resourceId: string, options: any) => 
          await api.enrollUserInLearningPlan(userId, resourceId, options)
      );

      result.summary.processingTime = Date.now() - startTime;
      return this.formatCSVResponse(result, 'Learning Plan Enrollment');

    } catch (error) {
      console.error('❌ CSV learning plan enrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **CSV Learning Plan Enrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• CSV format is correct
• All learning plan names exist in Docebo
• All email addresses are valid
• You have permission to enroll users`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  static async handleCSVUnenrollment(csvData: any, api: DoceboAPI): Promise<NextResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Processing CSV unenrollment: ${csvData.validRows.length} rows`);

      const result = await this.processCSVUnenrollment(csvData.validRows, csvData.headers, api);
      result.summary.processingTime = Date.now() - startTime;
      
      return this.formatCSVResponse(result, 'Unenrollment');

    } catch (error) {
      console.error('❌ CSV unenrollment error:', error);
      
      return NextResponse.json({
        response: `❌ **CSV Unenrollment Failed**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• CSV format is correct
• All resource names exist in Docebo
• All email addresses are valid
• You have permission to unenroll users`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  private static async processCSVEnrollment(
    rows: string[][],
    headers: string[],
    resourceType: 'course' | 'learning_plan',
    api: DoceboAPI,
    enrollFunction: (userId: string, resourceId: string, options: any) => Promise<any>
  ): Promise<CSVProcessingResult> {
    
    const result: CSVProcessingResult = {
      successful: [],
      failed: [],
      summary: {
        total: rows.length,
        successful: 0,
        failed: 0,
        operation: `${resourceType}_enrollment`,
        processingTime: 0
      }
    };

    // Get column indices
    const headerLower = headers.map(h => h.toLowerCase().trim());
    const emailIndex = headerLower.indexOf('email');
    const resourceIndex = headerLower.indexOf(resourceType === 'course' ? 'course' : 'learning_plan');
    const assignmentTypeIndex = headerLower.indexOf('assignment_type');

    // Group by resource to minimize API calls
    const resourceGroups = new Map<string, Array<{ email: string; assignmentType: string; rowIndex: number }>>();
    
    rows.forEach((row, index) => {
      const resourceName = row[resourceIndex]?.trim();
      const email = row[emailIndex]?.trim();
      const assignmentType = assignmentTypeIndex >= 0 ? (row[assignmentTypeIndex]?.trim() || 'required') : 'required';
      
      if (!resourceGroups.has(resourceName)) {
        resourceGroups.set(resourceName, []);
      }
      resourceGroups.get(resourceName)!.push({ email, assignmentType, rowIndex: index });
    });

    // Process each resource group
    for (const [resourceName, users] of resourceGroups.entries()) {
      try {
        console.log(`📚 Processing ${resourceType}: ${resourceName} (${users.length} users)`);
        
        // Find the resource
        let resource;
        let resourceId: string;
        
        if (resourceType === 'course') {
          resource = await api.findCourseByIdentifier(resourceName);
          resourceId = resource.id || resource.course_id || resource.idCourse;
        } else {
          resource = await api.findLearningPlanByIdentifier(resourceName);
          resourceId = resource.learning_plan_id || resource.id;
        }

        // Process users for this resource in batches
        const batchSize = 3;
        for (let i = 0; i < users.length; i += batchSize) {
          const batch = users.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (userInfo) => {
            try {
              // Find user
              const userSearchResults = await api.searchUsers(userInfo.email, 5);
              const user = userSearchResults.find((u: any) => 
                u.email?.toLowerCase() === userInfo.email.toLowerCase()
              );
              
              if (!user) {
                result.failed.push({
                  email: userInfo.email,
                  resourceName: resourceName,
                  error: 'User not found',
                  operation: result.summary.operation
                });
                return;
              }

              // Enroll user
              await enrollFunction(user.user_id || user.id, resourceId, {
                level: 'student',
                assignmentType: userInfo.assignmentType
              });
              
              result.successful.push({
                email: userInfo.email,
                userId: user.user_id || user.id,
                resourceName: resourceName,
                resourceId: resourceId,
                operation: result.summary.operation
              });

              console.log(`✅ Enrolled: ${userInfo.email} in ${resourceName}`);

            } catch (error) {
              console.error(`❌ Failed to enroll ${userInfo.email} in ${resourceName}:`, error);
              result.failed.push({
                email: userInfo.email,
                resourceName: resourceName,
                error: error instanceof Error ? error.message : 'Enrollment failed',
                operation: result.summary.operation
              });
            }
          }));

          // Small delay between batches
          if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

      } catch (resourceError) {
        console.error(`❌ Error finding ${resourceType} ${resourceName}:`, resourceError);
        
        // Mark all users for this resource as failed
        users.forEach(userInfo => {
          result.failed.push({
            email: userInfo.email,
            resourceName: resourceName,
            error: `${resourceType === 'course' ? 'Course' : 'Learning plan'} not found: ${resourceName}`,
            operation: result.summary.operation
          });
        });
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    return result;
  }

  private static async processCSVUnenrollment(
    rows: string[][],
    headers: string[],
    api: DoceboAPI
  ): Promise<CSVProcessingResult> {
    
    const result: CSVProcessingResult = {
      successful: [],
      failed: [],
      summary: {
        total: rows.length,
        successful: 0,
        failed: 0,
        operation: 'unenrollment',
        processingTime: 0
      }
    };

    // Get column indices
    const headerLower = headers.map(h => h.toLowerCase().trim());
    const emailIndex = headerLower.indexOf('email');
    const resourceIndex = headerLower.indexOf('resource');
    const resourceTypeIndex = headerLower.indexOf('resource_type');

    // Process in batches
    const batchSize = 3;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (row) => {
        const email = row[emailIndex]?.trim();
        const resourceName = row[resourceIndex]?.trim();
        const resourceType = resourceTypeIndex >= 0 ? 
          (row[resourceTypeIndex]?.trim() || 'course') : 'course';

        try {
          // Find user
          const userSearchResults = await api.searchUsers(email, 5);
          const user = userSearchResults.find((u: any) => 
            u.email?.toLowerCase() === email.toLowerCase()
          );
          
          if (!user) {
            result.failed.push({
              email: email,
              resourceName: resourceName,
              error: 'User not found',
              operation: 'unenrollment'
            });
            return;
          }

          // Find and unenroll from resource
          let resourceId: string;
          
          if (resourceType === 'course') {
            const course = await api.findCourseByIdentifier(resourceName);
            resourceId = course.id || course.course_id || course.idCourse;
            await api.unenrollUserFromCourse(user.user_id || user.id, resourceId);
          } else {
            const learningPlan = await api.findLearningPlanByIdentifier(resourceName);
            resourceId = learningPlan.learning_plan_id || learningPlan.id;
            await api.unenrollUserFromLearningPlan(user.user_id || user.id, resourceId);
          }
          
          result.successful.push({
            email: email,
            userId: user.user_id || user.id,
            resourceName: resourceName,
            resourceId: resourceId,
            operation: 'unenrollment'
          });

          console.log(`✅ Unenrolled: ${email} from ${resourceName}`);

        } catch (error) {
          console.error(`❌ Failed to unenroll ${email} from ${resourceName}:`, error);
          result.failed.push({
            email: email,
            resourceName: resourceName,
            error: error instanceof Error ? error.message : 'Unenrollment failed',
            operation: 'unenrollment'
          });
        }
      }));

      // Small delay between batches
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    return result;
  }

  private static formatCSVResponse(
    result: CSVProcessingResult, 
    operationName: string
  ): NextResponse {
    const processingTimeSeconds = Math.round(result.summary.processingTime / 1000);
    
    let responseMessage = `📊 **CSV ${operationName} Results**

📈 **Summary**: ${result.summary.successful}/${result.summary.total} operations completed successfully
⏱️ **Processing Time**: ${processingTimeSeconds} seconds
📅 **Completed**: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}

`;

    // Show successful operations grouped by resource
    if (result.successful.length > 0) {
      responseMessage += `✅ **Successful (${result.successful.length})**:\n`;
      
      // Group by resource for better readability
      const groupedSuccessful = new Map<string, string[]>();
      result.successful.forEach(success => {
        if (!groupedSuccessful.has(success.resourceName)) {
          groupedSuccessful.set(success.resourceName, []);
        }
        groupedSuccessful.get(success.resourceName)!.push(success.email);
      });

      let successCount = 0;
      for (const [resourceName, emails] of groupedSuccessful.entries()) {
        if (successCount >= 10) break; // Limit display to avoid overwhelming
        
        responseMessage += `📚 **${resourceName}**: ${emails.slice(0, 5).join(', ')}`;
        if (emails.length > 5) {
          responseMessage += ` and ${emails.length - 5} more`;
        }
        responseMessage += '\n';
        successCount++;
      }
      
      if (groupedSuccessful.size > 10) {
        responseMessage += `... and ${groupedSuccessful.size - 10} more resources\n`;
      }
      responseMessage += '\n';
    }

    // Show failed operations
    if (result.failed.length > 0) {
      responseMessage += `❌ **Failed (${result.failed.length})**:\n`;
      
      // Group failures by error type
      const errorGroups = new Map<string, Array<{ email: string; resourceName: string }>>();
      result.failed.forEach(failure => {
        if (!errorGroups.has(failure.error)) {
          errorGroups.set(failure.error, []);
        }
        errorGroups.get(failure.error)!.push({
          email: failure.email,
          resourceName: failure.resourceName
        });
      });

      let errorCount = 0;
      for (const [error, failures] of errorGroups.entries()) {
        if (errorCount >= 5) break; // Limit error display
        
        responseMessage += `🔸 **${error}**: ${failures.slice(0, 3).map(f => f.email).join(', ')}`;
        if (failures.length > 3) {
          responseMessage += ` and ${failures.length - 3} more`;
        }
        responseMessage += '\n';
        errorCount++;
      }
      
      if (errorGroups.size > 5) {
        responseMessage += `... and ${errorGroups.size - 5} more error types\n`;
      }
      responseMessage += '\n';
    }

    // Add recommendations
    if (result.failed.length > 0) {
      responseMessage += `💡 **Next Steps**:
• Review failed entries for data issues
• Check that all resources exist in Docebo
• Verify user permissions for failed operations
• Re-upload corrected CSV for failed entries`;
    } else {
      responseMessage += `🎉 **All CSV operations completed successfully!**

Perfect execution - all users have been processed without errors.`;
    }

    // Add performance stats
    responseMessage += `\n\n📊 **Performance Stats**:
• **Processing Rate**: ${Math.round(result.summary.total / (result.summary.processingTime / 1000))} operations/second
• **Success Rate**: ${Math.round((result.summary.successful / result.summary.total) * 100)}%
• **Batch Processing**: Optimized for API rate limits`;

    return NextResponse.json({
      response: responseMessage,
      success: result.summary.successful > 0,
      data: {
        csvResult: result,
        operationName: operationName
      },
      totalCount: result.summary.total,
      successCount: result.summary.successful,
      failureCount: result.summary.failed,
      processingTime: result.summary.processingTime,
      isBulkOperation: true,
      isCSVOperation: true,
      timestamp: new Date().toISOString()
    });
  }

  // Utility method to validate CSV structure before processing
  static validateCSVStructure(csvData: any, operation: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!csvData.headers || !Array.isArray(csvData.headers)) {
      errors.push('Invalid CSV headers');
      return { isValid: false, errors };
    }

    if (!csvData.validRows || !Array.isArray(csvData.validRows)) {
      errors.push('No valid data rows found');
      return { isValid: false, errors };
    }

    if (csvData.validRows.length === 0) {
      errors.push('No valid rows to process');
      return { isValid: false, errors };
    }

    if (csvData.validRows.length > 1000) {
      errors.push('Too many rows (maximum 1000 rows per CSV)');
      return { isValid: false, errors };
    }

    // Check required columns based on operation
    const headerLower = csvData.headers.map((h: string) => h.toLowerCase().trim());
    const requiredColumns = {
      course_enrollment: ['email', 'course'],
      lp_enrollment: ['email', 'learning_plan'],
      unenrollment: ['email', 'resource']
    };

    const required = requiredColumns[operation as keyof typeof requiredColumns];
    if (!required) {
      errors.push(`Unknown operation: ${operation}`);
      return { isValid: false, errors };
    }

    const missingColumns = required.filter(col => !headerLower.includes(col));
    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Validate data types in sample rows
    const sampleRows = csvData.validRows.slice(0, 5);
    const emailIndex = headerLower.indexOf('email');
    
    if (emailIndex >= 0) {
      const invalidEmails = sampleRows.filter((row: string[]) => {
        const email = row[emailIndex]?.trim();
        return !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      });
      
      if (invalidEmails.length > 0) {
        errors.push(`Invalid email format detected in sample rows`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate download template for different operations
  static generateCSVTemplate(operation: string): string {
    const templates = {
      course_enrollment: `email,course,assignment_type
john@company.com,"Python Programming",required
sarah@company.com,"Data Science Basics",optional
mike@company.com,"Excel Advanced",required`,

      lp_enrollment: `email,learning_plan,assignment_type
john@company.com,"Leadership Development",required
sarah@company.com,"Technical Skills Path",optional
mike@company.com,"Management Training",required`,

      unenrollment: `email,resource,resource_type
john@company.com,"Old Training Course",course
sarah@company.com,"Outdated Learning Path",learning_plan
mike@company.com,"Deprecated Program",course`
    };

    return templates[operation as keyof typeof templates] || '';
  }
}
