import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { ChatDirectController } from '../controllers/ChatDirectController';

const chatDirectController = new ChatDirectController();

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

    const directResponse = await chatDirectController.processDirectMessage(message);
    return NextResponse.json(directResponse);
  },
  {
    rateLinearit: {
      maxRequests: 20,
      windowMs: 60 * 1000
    },
    validateInput: true,
    rbac: {
      allowedRoles: ['user', 'power_user', 'manager']
    },
    timeout: 25000
  }
);

export const GET = withMiddleware(
  async () => {
    const directChatInfo = await chatDirectController.getDirectChatInfo();
    return NextResponse.json(directChatInfo);
  },
  {
    rateLinearit: {
      maxRequests: 100,
      windowMs: 60 * 1000
    }
  }
);
