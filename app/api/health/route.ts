// app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { HealthStatus } from '@/lib/health/health-checker';
import { rateLimiter, getClientIdentifier, getRateLimitHeaders } from '@/lib/middleware/rate-limit';
import { ErrorHandler } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for health checks (more generous limits)
    const clientId = getClientIdentifier(request);
    const rateLimit = rateLimiter.checkRateLimit(clientId, 'anonymous');
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimit)
        }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const useCache = searchParams.get('cache') !== 'false';

    if (detailed) {
      // Full health check with all details
      const healthStatus = await HealthChecker.checkHealth(useCache);
      
      return NextResponse.json(healthStatus, {
        status: healthStatus.status === 'healthy' ? 200 : 
               healthStatus.status === 'degraded' ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...getRateLimitHeaders(rateLimit)
        }
      });
    } else {
      // Quick health check
      const quickStatus = await HealthChecker.quickHealthCheck();
      
      return NextResponse.json({
        status: quickStatus.status,
        timestamp: new Date(quickStatus.timestamp).toISOString(),
        uptime: Date.now() - quickStatus.timestamp
      }, {
        status: quickStatus.status === 'healthy' ? 200 : 503,
        headers: {
          'Cache-Control': 'public, max-age=30',
          ...getRateLimitHeaders(rateLimit)
        }
      });
    }

  } catch (error) {
    const { statusCode, response } = ErrorHandler.handle(error, {
      endpoint: '/api/health',
      method: 'GET',
      ip: getClientIdentifier(request)
    });

    return NextResponse.json(response, { status: statusCode });
  }
}

// Optional: POST endpoint for health check actions (admin only)
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = rateLimiter.checkRateLimit(clientId, 'superadmin');
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimit)
        }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'reset_cache':
        HealthChecker.resetCache();
        return NextResponse.json({ 
          message: 'Health check cache reset successfully',
          timestamp: new Date().toISOString()
        });

      case 'force_check':
        const healthStatus = await HealthChecker.checkHealth(false);
        return NextResponse.json(healthStatus);

      case 'error_stats':
        const errorStats = HealthChecker.getErrorStats();
        return NextResponse.json({
          error_statistics: errorStats,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: reset_cache, force_check, error_stats' },
          { status: 400 }
        );
    }

  } catch (error) {
    const { statusCode, response } = ErrorHandler.handle(error, {
      endpoint: '/api/health',
      method: 'POST',
      ip: getClientIdentifier(request)
    });

    return NextResponse.json(response, { status: statusCode });
  }
}
