import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { CSVEnrollmentService } from '../services/enrollment/CSVEnrollmentService';

const csvEnrollmentService = new CSVEnrollmentService();

export const POST = withMiddleware(
  async (request: NextRequest) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const csvData = await file.text();
    const enrollmentResult = await csvEnrollmentService.enrollFromCSV(csvData);

    return NextResponse.json(enrollmentResult, { status: 201 });
  },
  {
    rateLimit: {
      maxRequests: 20,
      windowMs: 60 * 1000,
    },
    rbac: {
      allowedRoles: ['admin', 'manager'],
    },
  }
);
