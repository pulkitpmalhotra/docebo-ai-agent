import { NextRequest, NextResponse } from 'next/server';

export async function authorize(
  request: NextRequest, 
  allowedRoles: string[],
  strict = false
): Promise<NextResponse | null> {
  const userRole = request.headers.get('X-User-Role') || 'user';

  if (strict) {
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'User role not authorized' },
        { status: 403 }  
      );
    }
  } else {
    if (userRole === 'user' && !allowedRoles.includes('user')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'User role not authorized' },
        { status: 403 }
      );
    }
  }

  return null;
}
