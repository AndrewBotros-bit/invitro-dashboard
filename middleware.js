import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];
const STATIC_PREFIXES = ['/_next', '/favicon.ico', '/api/deploy'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (PUBLIC_PATHS.includes(pathname) || STATIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('invitro-session');
  if (!session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // JWT verification happens server-side in page components
  // Middleware just checks cookie exists (lightweight, edge-compatible)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
