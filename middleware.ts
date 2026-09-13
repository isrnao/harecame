import { NextRequest, NextResponse } from 'next/server';

// Authorization belongs to server services, including Server Actions.
// Middleware only supplies browser policy and rejects cross-origin mutations.
export function middleware(request: NextRequest) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const expected = process.env.APP_URL || request.nextUrl.origin;
    if (origin && origin !== new URL(expected).origin) {
      return NextResponse.json({ success: false, error: 'Cross-origin request denied' }, { status: 403 });
    }
  }
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  if (request.nextUrl.pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
