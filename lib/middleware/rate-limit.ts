// lib/middleware/rate-limit.ts
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  requests: number;
  window: number; // in milliseconds
}

export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  private limits: Record<string, RateLimitConfig> = {
    superadmin: { requests: 200, window: 60000 }, // 200 requests per minute
    power_user: { requests: 100, window: 60000 }, // 100 requests per minute
    user_manager: { requests: 50, window: 60000 }, // 50 requests per minute
    user: { requests: 30, window: 60000 },         // 30 requests per minute
    anonymous: { requests: 10, window: 60000 }     // 10 requests per minute
  };

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  checkRateLimit(identifier: string, userRole: string = 'anonymous'): RateLimitResult {
    const now = Date.now();
    const limit = this.limits[userRole] || this.limits.anonymous;
    
    const userRequests = this.requests.get(identifier);
    
    if (!userRequests || now > userRequests.resetTime) {
      // Reset or initialize
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + limit.window
      });
      
      return {
        allowed: true,
        remaining: limit.requests - 1,
        resetTime: now + limit.window
      };
    }
    
    if (userRequests.count >= limit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: userRequests.resetTime,
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      };
    }
    
    // Increment count
    userRequests.count++;
    this.requests.set(identifier, userRequests);
    
    return {
      allowed: true,
      remaining: limit.requests - userRequests.count,
      resetTime: userRequests.resetTime
    };
  }

  // Get current usage for a user
  getCurrentUsage(identifier: string): { count: number; limit: number; resetTime: number } | null {
    const userRequests = this.requests.get(identifier);
    if (!userRequests) return null;

    return {
      count: userRequests.count,
      limit: this.limits.anonymous.requests, // Default limit
      resetTime: userRequests.resetTime
    };
  }

  // Admin function to reset a user's rate limit
  resetUserLimit(identifier: string): boolean {
    return this.requests.delete(identifier);
  }

  // Update rate limits dynamically
  updateLimits(newLimits: Record<string, RateLimitConfig>): void {
    // Filter out undefined values and merge with existing limits
    const validLimits = Object.fromEntries(
      Object.entries(newLimits).filter(([_, config]) => config !== undefined)
    ) as Record<string, RateLimitConfig>;
    
    this.limits = { ...this.limits, ...validLimits };
  }

  // Cleanup old entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Rate limiter cleaned up ${cleaned} expired entries`);
    }
  }

  // Get statistics
  getStats(): {
    totalUsers: number;
    activeUsers: number;
    oldestEntry: number;
    newestEntry: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    const entries = Array.from(this.requests.values());
    const activeEntries = entries.filter(e => now <= e.resetTime);
    const createdTimes = entries.map(e => e.resetTime - this.limits.anonymous.window);
    
    return {
      totalUsers: this.requests.size,
      activeUsers: activeEntries.length,
      oldestEntry: Math.min(...createdTimes) || 0,
      newestEntry: Math.max(...createdTimes) || 0,
      memoryUsage: this.requests.size * 64 // Rough estimate in bytes
    };
  }

  // Graceful shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Helper function for Next.js API routes
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

// IP address extractor for Next.js
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (for production behind proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Use the first available IP
  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0] || 'unknown';
  
  return ip.trim();
}
