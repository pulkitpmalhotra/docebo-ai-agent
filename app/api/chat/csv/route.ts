// app/api/chat/csv/route.ts - UPDATED CSV processing endpoint with validity dates

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

// UPDATED: GET endpoint for CSV templates and info with validity date support
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

  // UPDATED: Return API information with validity date support
  return NextResponse.json({
    status: 'CSV Processing API for Docebo Bulk Operations with Validity Date Support',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    operations: {
      'course_enrollment': {
        description: 'Bulk enroll users in courses with optional validity dates',
        required_columns: ['email', 'course'],
        optional_columns: ['assignment_type', 'start_validity', 'end_validity'],
        example: 'john@company.com,Python Programming,required,2025-01-01,2025-12-31',
        validity_date_formats: 'YYYY-MM-DD (e.g., 2025-12-31)',
        validity_columns: {
          start_validity: 'When the enrollment becomes active',
          end_validity: 'When the enrollment expires',
          alternative_names: {
            start: ['start_validity', 'validity_start', 'start_date', 'valid_from'],
            end: ['end_validity', 'validity_end', 'end_date', 'valid_until', 'expires']
          }
        }
      },
      'lp_enrollment': {
        description: 'Bulk enroll users in learning plans with optional validity dates',
        required_columns: ['email', 'learning_plan'],
        optional_columns: ['assignment_type', 'start_validity', 'end_validity'],
        example: 'sarah@company.com,Leadership Development,required,2025-02-01,2025-11-30',
        validity_date_formats: 'YYYY-MM-DD (e.g., 2025-12-31)',
        validity_columns: {
          start_validity: 'When the enrollment becomes active',
          end_validity: 'When the enrollment expires',
          alternative_names: {
            start: ['start_validity', 'validity_start', 'start_date', 'valid_from'],
            end: ['end_validity', 'validity_end', 'end_date', 'valid_until', 'expires']
          }
        }
      },
      'unenrollment': {
        description: 'Bulk remove users from courses/learning plans',
        required_columns: ['email', 'resource'],
        optional_columns: ['resource_type'],
        example: 'mike@company.com,Old Training Course,course',
        note: 'Unenrollment does not use validity dates'
      }
    },
    limits: {
      max_rows_per_csv: 1000,
      max_file_size: '5MB',
      supported_formats: ['CSV'],
      rate_limit: '10 uploads per minute'
    },
    features: [
      'NEW: Validity date support (start_validity, end_validity)',
      'NEW: Multiple column name alternatives for validity dates',
      'NEW: Automatic date format validation (YYYY-MM-DD)',
      'Drag and drop file upload',
      'CSV validation and preview',
      'Batch processing with error handling',
      'Detailed success/failure reporting',
      'Template generation for each operation',
      'Progress tracking and performance metrics'
    ],
    validity_date_features: {
      supported_formats: ['YYYY-MM-DD'],
      examples: ['2025-01-01', '2025-12-31', '2026-06-15'],
      behavior: {
        empty_dates: 'Optional - can be left blank',
        invalid_format: 'Will cause validation error',
        future_dates: 'Supported and recommended',
        past_dates: 'Supported but may cause immediate expiration'
      },
      column_alternatives: {
        start_validity: ['start_validity', 'validity_start', 'start_date', 'valid_from'],
        end_validity: ['end_validity', 'validity_end', 'end_date', 'valid_until', 'expires']
      }
    },
    template_endpoints: {
      course_enrollment: '/api/chat/csv?action=template&operation=course_enrollment',
      lp_enrollment: '/api/chat/csv?action=template&operation=lp_enrollment',
      unenrollment: '/api/chat/csv?action=template&operation=unenrollment'
    },
    csv_examples: {
      course_enrollment_with_dates: {
        headers: 'email,course,assignment_type,start_validity,end_validity',
        sample_rows: [
          'john@company.com,"Python Programming",required,2025-01-01,2025-12-31',
          'sarah@company.com,"Data Science",optional,2025-02-01,2025-11-30',
          'mike@company.com,"Excel Advanced",mandatory,,'
        ]
      },
      lp_enrollment_with_dates: {
        headers: 'email,learning_plan,assignment_type,start_validity,end_validity',
        sample_rows: [
          'john@company.com,"Leadership Development",required,2025-01-01,2025-12-31',
          'sarah@company.com,"Technical Skills",recommended,2025-03-01,2025-10-31',
          'mike@company.com,"Management Training",optional,,'
        ]
      },
      alternative_column_names: {
        description: 'You can use any of these column name variations',
        start_date_columns: ['start_validity', 'validity_start', 'start_date', 'valid_from'],
        end_date_columns: ['end_validity', 'validity_end', 'end_date', 'valid_until', 'expires'],
        example: 'email,course,assignment_type,valid_from,expires'
      }
    }
  });
}, {
  rateLimit: {
    maxRequests: 100, // More lenient for GET requests
    windowMs: 60 * 1000
  },
  validateInput: false // No input validation needed for GET
});
