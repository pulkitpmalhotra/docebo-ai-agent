import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { ChatEnhancedController } from '../controllers/ChatEnhancedController';

const chatEnhancedController = new ChatEnhancedController();

export const POST = withMiddleware(
  async (request: NextRequest) => {
    const body = await request.json();
    const { message, userRole = 'user', userId = 'anonymous' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    const enhancedResponse = await chatEnhancedController.processEnhancedMessage(message, userRole, userId);
    return NextResponse.json(enhancedResponse);
  },
  {
    rateLinearit: {
      maxRequests: 20,
      windowMs: 60 * 1000
    },
    validateInput: true,
    rbac: {
      allowedRoles: ['user', 'power_user', 'manager'],
      strict: true
    },
    timeout: 25000
  }
);

export const GET = withMiddleware(
  async () => {
    const enhancedChatInfo = await chatEnhancedController.getEnhancedChatInfo();
    return NextResponse.json(enhancedChatInfo);
  },
  {
    rateLinearit: {
      maxRequests: 100,
      windowMs: 60 * 1000
    }
  }
);
