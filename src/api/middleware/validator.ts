import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function validateInput(request: NextRequest): Promise<NextResponse | null> {
  const bodySchema = z.object({
    message: z.string().min(1).max(1000),
    userRole: z.enum(['user', 'power_user', 'manager']).optional(),
    userId: z.string().optional()
  });

  try {
    const body = await request.json();
    bodySchema.parse(body);
    return null;
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body', details: error.issues },
      { status: 400 }
    );
  }
}
