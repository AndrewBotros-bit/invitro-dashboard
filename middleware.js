import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];
const STATIC_PREFIXES = ['/_next', '/favicon.ico', '/api/deploy'];
// Sensitive paths require a real session cookie (interactive login).
// Display tokens (long-lived URL params) are NOT accepted here — they could
// be leaked from a kiosk URL bar or shared screenshot.
const SENSITIVE_PATH_PREFIXES = ['/admin', '/audit', '/api/admin', '/api/auth/logout'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (PUBLIC_PATHS.includes(pathname) || STATIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('invitro-session');
  const displayToken = request.nextUrl.searchParams.get('display');
  const isSensitive = SENSITIVE_PATH_PREFIXES.some(p => pathname.startsWith(p));

  // Sensitive paths: only cookie (no display token fallback)
  if (isSensitive) {
    if (!session?.value) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Non-sensitive: cookie OR display token (kiosk/digital-signage support)
  if (!session?.value && !displayToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // JWT verification happens server-side in page components
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
