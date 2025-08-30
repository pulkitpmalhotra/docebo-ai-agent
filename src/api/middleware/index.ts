export const withMiddleware = (
  handler: (request: NextRequest) => Promise<NextResponse>, 
  options: MiddlewarecOptions
) => {
  return async (request: NextRequest) => {
    // Apply middleware based on options
    // ...

    // Call the actual route handler
    return handler(request);
  };
};
