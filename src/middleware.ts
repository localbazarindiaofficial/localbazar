import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'lb_admin_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Edge Security Guard: Protect all administrative API routes
  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth')) {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Server-signed admin session required' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
