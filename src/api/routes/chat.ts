import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { ChatController } from '../controllers/ChatController';

const chatController = new ChatController();

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

    const chatResponse = await chatController.processMessage(message);
    return NextResponse.json(chatResponse);
  },
  {
    ratelimit: {
      maxRequests: 30,
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
    const chatInfo = await chatController.getChatInfo();
    return NextResponse.json(chatInfo);
  },
  {
    rateLinearit: {
      maxRequests: 100,
      windowMs: 60 * 1000
    }
  }  
);
