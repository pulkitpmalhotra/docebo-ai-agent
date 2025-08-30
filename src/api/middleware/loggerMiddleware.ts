import { NextRequest, NextResponse } from 'next/server';

export async function loggerMiddleware(
  request: NextRequest,
  next: (req: NextRequest) => Promise<NextResponse>
) {
  const startTime = Date.now();
  const response = await next(request);
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`[${request.method}] ${request.url} - ${duration}ms`);

  return response;
}
