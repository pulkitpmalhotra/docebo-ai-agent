import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { CourseService } from '../services/course/CourseService';

const courseService = new CourseService();

export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('id');

    if (courseId) {
      const course = await courseService.getCourse(Number(courseId));
      return NextResponse.json(course);
    } else {
      const courses = await courseService.getCourses();
      return NextResponse.json(courses);
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
    const course = await courseService.createCourse(body);
    return NextResponse.json(course, { status: 201 });
  },
  {
    rateLimit: {
      maxRequests: 50,
      windowMs: 60 * 1000,
    },
    validateInput: true,
    rbac: {
      allowedRoles: ['admin'],
    },
  }
);

// Add more route handlers as needed (PUT, DELETE, etc.)
