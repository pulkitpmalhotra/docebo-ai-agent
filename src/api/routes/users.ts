import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { UserService } from '../services/user/UserService';

const userService = new UserService();

export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (userId) {
      const user = await userService.getUser(Number(userId));
      return NextResponse.json(user);
    } else {
      const users = await userService.getUsers();
      return NextResponse.json(users);
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
    const user = await userService.createUser(body);
    return NextResponse.json(user, { status: 201 });
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
