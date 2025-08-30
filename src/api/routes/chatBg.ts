import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { ChatBackgroundController } from '../controllers/ChatBackgroundController';

const chatBackgroundController = new ChatBackgroundController();

export const POST = withMiddleware(
  async (request: NextRequest) => {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    const backgroundResponse = await chatBackgroundController.processBackground(message);
    return NextResponse.json(backgroundResponse);
  },
  {
    rateLinearit: {
      maxRequests: 10,
      windowMs: 60 * 1000
    },
    validateInput: true,
    rbac: {
      allowedRoles: ['user', 'power_user', 'manager']
    }
  }
);

export const GET = withMiddleware(
  async (request: NextRequest) => {
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const jobStatus = await chatBackgroundController.getJobStatus(jobId);
    return NextResponse.json(jobStatus);
  },
  {
    rateLinearit: {
      maxRequests: 50,
      windowMs: 60 * 1000
    },
    rbac: {
      allowedRoles: ['user', 'power_user', 'manager']
    }
  }
);
