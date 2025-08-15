// app/api/chat/csv/route.ts - CSV processing endpoint
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '../../middleware/security';
import { DoceboAPI } from '../docebo-api';
import { getConfig } from '../utils/config';
import { CSVEnrollmentHandlers } from '../handlers/csv-enrollment';

let api: DoceboAPI;

// Main CSV processing handler
async function csvHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Initialize API client if needed
    if (!api) {
      const config = getConfig();
      api = new DoceboAPI(config);
    }

    // Parse request
    const body = await request.json();
    const { operation, csvData } = body;
    
    if (!operation || !csvData) {
      return NextResponse.json({
        response: '❌ Missing operation or CSV data',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🔄 Processing CSV operation: ${operation} with ${csvData.validRows?.length || 0} rows`);
    
    // Validate CSV structure
    const validation = CSVEnrollmentHandlers.validateCSVStructure(csvData, operation);
    if (!validation.isValid) {
      return NextResponse.json({
        response: `❌ **CSV Validation Failed**:

${validation.errors.map(error => `• ${error}`).join('\n')}

Please check your CSV format and try again.`,
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Route to appropriate CSV handler
    try {
      switch (operation) {
        case 'course_enrollment':
          return await CSVEnrollmentHandlers.handleCSVCourseEnrollment(csvData, api);
          
        case 'lp_enrollment':
          return await CSVEnrollmentHandlers.handleCSVLearningPlanEnrollment(csvData, api);
          
        case 'unenrollment':
          return await CSVEnrollmentHandlers.handleCSVUnenrollment(csvData, api);
          
        default:
          return NextResponse.json({
            response: `❌ **Unknown Operation**: ${operation}

Supported operations:
• **course_enrollment** - Enroll users in courses
• **lp_enrollment** - Enroll users in learning plans  
• **unenrollment** - Remove users from courses/learning plans`,
            success: false,
            timestamp: new Date().toISOString()
          }, { status: 400 });
      }
    } catch (error) {
      console.error('❌ CSV processing error:', error);
      return NextResponse.json({
        response: `❌ **CSV Processing Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ CSV endpoint error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Apply security middleware to POST requests
export const POST = withSecurity(csvHandler, {
  rateLimit: {
    maxRequests: 10, // More restrictive for CSV operations
    windowMs: 60 * 1000
  },
  validateInput: true,
  sanitizeOutput: true
});

// GET endpoint for CSV templates and info
export const GET = withSecurity(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get('operation');
  const action = searchParams.get('action');

  if (action === 'template' && operation) {
    // Generate and return CSV template
    const template = CSVEnrollmentHandlers.generateCSVTemplate(operation);
    
    if (!template) {
      return NextResponse.json({
        error: 'Invalid operation for template generation'
      }, { status: 400 });
    }

    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${operation}_template.csv"`
      }
    });
  }

  // Return API information
  return NextResponse.json({
    status: 'CSV Processing API for Docebo Bulk Operations',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    operations: {
      'course_enrollment': {
        description: 'Bulk enroll users in courses',
        required_columns: ['email', 'course'],
        optional_columns: ['assignment_type'],
        example: 'john@company.com,Python Programming,required'
      },
      'lp_enrollment': {
        description: 'Bulk enroll users in learning plans',
        required_columns: ['email', 'learning_plan'],
        optional_columns: ['assignment_type'],
        example: 'sarah@company.com,Leadership Development,required'
      },
      'unenrollment': {
        description: 'Bulk remove users from courses/learning plans',
        required_columns: ['email', 'resource'],
        optional_columns: ['resource_type'],
        example: 'mike@company.com,Old Training Course,course'
      }
    },
    limits: {
      max_rows_per_csv: 1000,
      max_file_size: '5MB',
      supported_formats: ['CSV'],
      rate_limit: '10 uploads per minute'
    },
    features: [
      'Drag and drop file upload',
      'CSV validation and preview',
      'Batch processing with error handling',
      'Detailed success/failure reporting',
      'Template generation for each operation',
      'Progress tracking and performance metrics'
    ],
    template_endpoints: {
      course_enrollment: '/api/chat/csv?action=template&operation=course_enrollment',
      lp_enrollment: '/api/chat/csv?action=template&operation=lp_enrollment',
      unenrollment: '/api/chat/csv?action=template&operation=unenrollment'
    }
  });
}, {
  rateLimit: {
    maxRequests: 100, // More lenient for GET requests
    windowMs: 60 * 1000
  },
  validateInput: false // No input validation needed for GET
});
