// app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { HealthChecker } from '@/lib/health/health-checker';
import { rateLimiter, getClientIdentifier, getRateLimitHeaders } from '@/lib/middleware/rate-limit';
import { ErrorHandler } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for health checks (more generous limits)
    const clientId = getClientIdentifier(request);
    const rateLimit = rateLimiter.checkRateLimit(clientId, 'anonymous');
    
    if (!rateLimit.allowed) {
