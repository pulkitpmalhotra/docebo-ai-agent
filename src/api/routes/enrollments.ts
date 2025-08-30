import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { EnrollmentService } from '../services/enrollment/EnrollmentService';

const enrollmentService = new EnrollmentService();

export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const courseId = searchParams.get('courseId');

    if (userId && courseId) {
      const enrollment = await enrollmentService.getEnrollmentStatus(
        Number(userId),
        Number(courseId)
      );
      return NextResponse.json(enrollment);
    } else {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
  },
  {
    rateLimit: {
      maxRequests: 100,
      windowMs: 60 * 1000,
    },
  }
);

export const POST = withMiddleware(
  async (request: NextRequest) => {
    const body = await request.json();
    const { userId, courseId } = body;
    const enrollment = await enrollmentService.enrollUser(userId, courseId);
    return NextResponse.json(enrollment, { status: 201 });
  },
  {
    rateLimit: {
      maxRequests: 50,
      windowMs: 60 * 1000,
    },
    validateInput: true,
    rbac: {
      allowedRoles: ['admin', 'manager'],
    },
  }
);

// Add more route handlers as needed (DELETE, etc.)
