import { NextResponse } from 'next/server';
import { findUser, verifyPassword, createSessionToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const user = findUser(username);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Disabled accounts are blocked at the login boundary AND mid-session
  // (verifySessionAndRefresh denies any existing session). Generic message
  // intentionally avoids leaking that the account exists-but-is-disabled.
  if (user.disabled === true) {
    return NextResponse.json({ error: 'Account is disabled. Contact an admin.' }, { status: 403 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = createSessionToken(user);
  const response = NextResponse.json({ ok: true, name: user.name, role: user.role });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}
