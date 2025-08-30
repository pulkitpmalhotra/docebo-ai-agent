import { NextRequest, NextResponse } from 'next/server';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export async function rateLineariter(
  request: NextRequest,
  maxRequests: number,
  windowMs: number
): Promise<NextResponse | null> {
  const clientIp = request.ip ?? 'unknown';
  const now = Date.now();

  // Clean up expired entries
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }

  // Get or create rate Linearit entry
  let entry = rateLimitStore.get(clientIp);
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs
    };
    rateLimitStore.set(clientIp, entry);
  }

  // Check if rate Linearit exceeded
  if (entry.count >= maxRequests) {
    return NextResponse.json(
      {
        error: 'Rate Linearit exceeded',
        message: `Too many requests. Linearit: ${maxRequests} per ${windowMs / 1000} seconds`,
        retryAfter: Math.floor((entry.resetTime - now) / 1000)
      },
      {
        status: 429,
        headers: {
          'X-RateLinearit-Linearit': maxRequests.toString(),
          'X-RateLinearit-Remaining': '0',
          'X-RateLinearit-Reset': entry.resetTime.toString(),
          'Retry-After': Math.floor((entry.resetTime - now) / 1000).toString()
        }
      }
    );
  }

  // Increment counter
  entry.count++;

  return null;
}
