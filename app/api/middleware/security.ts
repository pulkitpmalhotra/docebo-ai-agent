// app/api/middleware/security.ts - Security middleware for API routes
import { NextRequest, NextResponse } from 'next/server';

// Rate limiting store (in production, use Redis or external service)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (request: NextRequest) => string;
}

interface SecurityOptions {
  rateLimit?: RateLimitOptions;
  validateInput?: boolean;
  sanitizeOutput?: boolean;
  requireApiKey?: boolean;
}

// Default rate limiting configuration
const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  maxRequests: parseInt(process.env.API_RATE_LIMIT || '100', 10),
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (request: NextRequest) => {
    // Use IP address or a default key
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return ip;
  }
};

/**
 * Apply rate limiting to API requests
 */
export function rateLimit(options: RateLimitOptions = DEFAULT_RATE_LIMIT) {
  return (request: NextRequest): NextResponse | null => {
    const key = options.keyGenerator?.(request) || DEFAULT_RATE_LIMIT.keyGenerator!(request);
    const now = Date.now();
    
    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + options.windowMs
      };
      rateLimitStore.set(key, entry);
    }
    
    // Check if rate limit exceeded
    if (entry.count >= options.maxRequests) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${options.maxRequests} per ${options.windowMs / 1000} seconds`,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': entry.resetTime.toString(),
          'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString()
        }
      });
    }
    
    // Increment counter
    entry.count++;
    
    return null; // Allow request to proceed
  };
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>'"]/g, (char) => { // Escape HTML characters
        const escapeMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return escapeMap[char] || char;
      })
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Validate request input against common patterns
 */
export function validateInput(input: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof input === 'string') {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\beval\s*\(/i,
      /\bexec\s*\(/i,
      /\bFunction\s*\(/i,
      /\bsetTimeout\s*\(/i,
      /\bsetInterval\s*\(/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /\bdata:\s*text\/html/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(input)) {
        errors.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }
    
    // Check length limits
    if (input.length > 10000) {
      errors.push('Input too long (max 10000 characters)');
    }
  }
  
  if (typeof input === 'object' && input !== null) {
    // Recursively validate object properties
    for (const [key, value] of Object.entries(input)) {
      const keyValidation = validateInput(key);
      const valueValidation = validateInput(value);
      
      errors.push(...keyValidation.errors);
      errors.push(...valueValidation.errors);
    }
    
    // Check object depth
    const depth = getObjectDepth(input);
    if (depth > 10) {
      errors.push('Object nesting too deep (max 10 levels)');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get the depth of a nested object
 */
function getObjectDepth(obj: any, depth = 0): number {
  if (typeof obj !== 'object' || obj === null || depth > 10) {
    return depth;
  }
  
  let maxDepth = depth;
  for (const value of Object.values(obj)) {
    const currentDepth = getObjectDepth(value, depth + 1);
    maxDepth = Math.max(maxDepth, currentDepth);
  }
  
  return maxDepth;
}

/**
 * Apply CORS headers
 */
export function applyCorsHeaders(response: NextResponse): NextResponse {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.headers.set('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  return response;
}

/**
 * Apply security headers
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  return response;
}

/**
 * Main security middleware wrapper
 */
export function withSecurity(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: SecurityOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Apply rate limiting
      if (options.rateLimit !== false) {
        const rateLimitResponse = rateLimit(options.rateLimit)(request);
        if (rateLimitResponse) {
          return applyCorsHeaders(applySecurityHeaders(rateLimitResponse));
        }
      }
      
      // Validate and sanitize input for POST/PUT requests
      if ((request.method === 'POST' || request.method === 'PUT') && options.validateInput !== false) {
        try {
          const body = await request.json();
          const validation = validateInput(body);
          
          if (!validation.isValid) {
            return applyCorsHeaders(applySecurityHeaders(NextResponse.json({
              error: 'Invalid input',
              details: validation.errors
            }, { status: 400 })));
          }
          
          // Create new request with sanitized body
          const sanitizedBody = sanitizeInput(body);
          const newRequest = new NextRequest(request.url, {
            method: request.method,
            headers: request.headers,
            body: JSON.stringify(sanitizedBody)
          });
          
          // Call handler with sanitized request
          const response = await handler(newRequest);
          return applyCorsHeaders(applySecurityHeaders(response));
        } catch (error) {
          // If JSON parsing fails, continue with original request
          console.warn('Failed to parse request body for validation:', error);
        }
      }
      
      // Call handler normally
      const response = await handler(request);
      return applyCorsHeaders(applySecurityHeaders(response));
      
    } catch (error) {
      console.error('Security middleware error:', error);
      
      const errorResponse = NextResponse.json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          'Something went wrong'
      }, { status: 500 });
      
      return applyCorsHeaders(applySecurityHeaders(errorResponse));
    }
  };
}

/**
 * Simple API key validation
 */
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return true; // No API key required
  
  const providedKey = request.headers.get('X-API-Key') || 
                     request.headers.get('Authorization')?.replace('Bearer ', '');
  
  return providedKey === apiKey;
}

/**
 * Middleware for API key protection
 */
export function requireApiKey(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!validateApiKey(request)) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Valid API key required'
      }, { status: 401 });
    }
    
    return handler(request);
  };
}
