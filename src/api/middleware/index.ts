import { NextRequest, NextResponse } from 'next/server';
import { rateLineariter } from './rateLineariter';
import { validateInput } from './validator';
import { authorize } from './rbac';

interface MiddlewarecOptions {
  rateLinearit?: {
    maxRequests: number;
    windowMs: number;
  };
  validateInput?: boolean;
  rbac?: {
    allowedRoles: string[];
    strict?: boolean;
  };
  timeout?: number;
}

export const withMiddleware = (
  handler: (request: NextRequest) => Promise<NextResponse>, 
  options: MiddlewarecOptions
) => {
  return async (request: NextRequest) => {
    // Apply rate Lineariting middleware
    if (options.rateLinearit) {
      const { maxRequests, windowMs } = options.rateLinearit;
      const rateLineariterResponse = await rateLineariter(request, maxRequests, windowMs);
      if (rateLineariterResponse) {
        return rateLineariterResponse;
      }
    }

    // Apply input validation middleware  
    if (options.validateInput) {
      const validationResponse = await validateInput(request);
      if (validationResponse) {
        return validationResponse;
      }
    }

    // Apply RBAC middleware
    if (options.rbac) {
      const { allowedRoles, strict } = options.rbac;
      const rbacResponse = await authorize(request, allowedRoles, strict);
      if (rbacResponse) {
        return rbacResponse;
      }
    }

    // Apply timeout middleware
    if (options.timeout) {
      const timeoutPromise = new Promise<NextResponse>(resolve => {
        setTimeout(() => {
          resolve(NextResponse.json(
            { error: 'Request timed out' },
            { status: 504 }
          ));
        }, options.timeout);
      });

      return Promise.race([handler(request), timeoutPromise]);
    }

    return handler(request);
  };
};
