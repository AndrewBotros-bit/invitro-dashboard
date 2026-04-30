import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifySessionToken,
  createDisplayToken,
  isAdmin,
  COOKIE_NAME,
} from '@/lib/auth';
import { readUsersFromGitHub } from '@/lib/auth/github';

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return { error: 'Not authenticated', status: 401 };
  const user = verifySessionToken(session.value);
  if (!user) return { error: 'Invalid session', status: 401 };
  if (!isAdmin(user)) return { error: 'Admin access required', status: 403 };
  return { user };
}

export async function POST(request) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { username, expiresIn } = await request.json();
  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 });
  }

  // Read users from GitHub (always fresh) so we capture latest permissions
  let users;
  try {
    users = await readUsersFromGitHub();
  } catch (err) {
    return NextResponse.json({ error: `Failed to read users: ${err.message}` }, { status: 500 });
  }
  const target = users.find(u => u.username === username);
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Generate the display token (default: 365 days)
  const token = createDisplayToken(target, expiresIn || '365d');

  // Build the public URL — uses request origin so it works on preview/prod
  const origin = request.headers.get('origin') || new URL(request.url).origin;
  const url = `${origin}/?display=${encodeURIComponent(token)}`;

  return NextResponse.json({ ok: true, url, token, username: target.username });
}
