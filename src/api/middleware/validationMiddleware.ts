import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export function validateInput(schema: z.Schema) {
  return async (
    request: NextRequest,
    next: (req: NextRequest) => Promise<NextResponse>
  ) => {
    try {
      const body = await request.json();
      schema.parse(body);
      return next(request);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'The provided input is invalid.',
          details: error.issues,
        },
        { status: 400 }
      );
    }
  };
}
