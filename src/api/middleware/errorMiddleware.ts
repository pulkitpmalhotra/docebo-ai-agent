import { NextRequest, NextResponse } from 'next/server';

export async function errorMiddleware(
  request: NextRequest,
  next: (req: NextRequest) => Promise<NextResponse>
) {
  try {
    return await next(request);
  } catch (error) {
    console.error('An error occurred:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
