import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { ILTService } from '../services/ilt/ILTService';

const iltService = new ILTService();

export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (sessionId) {
      const iltSession = await iltService.getILTSession(Number(sessionId));
      return NextResponse.json(iltSession);
    } else {
      const iltSessions = await iltService.getILTSessions();
      return NextResponse.json(iltSessions);
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
    const iltSession = await iltService.createILTSession(body);
    return NextResponse.json(iltSession, { status: 201 });
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

// Add more route handlers as needed (PUT, DELETE, etc.)
