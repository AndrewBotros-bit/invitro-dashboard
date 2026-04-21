import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  readUsers,
  verifySessionToken,
  hashPassword,
  findUser,
  isAdmin,
  COOKIE_NAME,
} from '@/lib/auth';
import { commitUsersToGitHub, readUsersFromGitHub } from '@/lib/auth/github';

const ALL_COMPANIES = ['AllRx', 'AllCare', 'Osta', 'Needles', 'InVitro Studio'];
const ALL_TABS = ['overview', 'revenue', 'expenses', 'profitability', 'cashflow', 'insights'];
const BREAKDOWN_KEYS = ['revenueDrilldown', 'expenseDrilldown', 'auditConsole', 'hcDetails'];

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return { error: 'Not authenticated', status: 401 };
  const user = verifySessionToken(session.value);
  if (!user) return { error: 'Invalid session', status: 401 };
  if (!isAdmin(user)) return { error: 'Admin access required', status: 403 };
  return { user };
}

function stripHash(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

function validatePermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return 'permissions must be an object';
  const { companies, tabs, breakdowns } = permissions;
  if (companies !== '*' && !(Array.isArray(companies) && companies.every(c => ALL_COMPANIES.includes(c)))) {
    return 'companies must be "*" or array of valid company names';
  }
  if (tabs !== '*' && !(Array.isArray(tabs) && tabs.every(t => ALL_TABS.includes(t)))) {
    return 'tabs must be "*" or array of valid tab ids';
  }
  if (breakdowns !== '*') {
    if (!breakdowns || typeof breakdowns !== 'object') return 'breakdowns must be "*" or object';
    for (const key of Object.keys(breakdowns)) {
      if (!BREAKDOWN_KEYS.includes(key)) return `unknown breakdown key: ${key}`;
      const v = breakdowns[key];
      if (typeof v !== 'boolean' && !(Array.isArray(v) && v.every(c => ALL_COMPANIES.includes(c)))) {
        return `breakdowns.${key} must be boolean or array of valid companies`;
      }
    }
  }
  return null;
}

export async function GET() {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  // Read from GitHub for always-fresh data (bypasses Vercel build cache)
  try {
    const users = (await readUsersFromGitHub()).map(stripHash);
    return NextResponse.json({ users, source: 'github' });
  } catch (err) {
    // Fallback to local fs if GitHub fails (e.g., token missing)
    console.warn('[ADMIN] GitHub read failed, falling back to fs:', err.message);
    const users = readUsers().map(stripHash);
    return NextResponse.json({ users, source: 'fs' });
  }
}

export async function POST(request) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await request.json();
  const { username, name, email, password, role, permissions } = body;

  if (!username || !name || !password || !role) {
    return NextResponse.json({ error: 'username, name, password, role required' }, { status: 400 });
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }
  if (!['admin', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin or viewer' }, { status: 400 });
  }
  const permErr = validatePermissions(permissions);
  if (permErr) return NextResponse.json({ error: permErr }, { status: 400 });

  const users = await readUsersFromGitHub();
  if (users.some(u => u.username === username)) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const newUser = { username, name, passwordHash, role, permissions };
  if (email) newUser.email = email;
  users.push(newUser);

  await commitUsersToGitHub(users, guard.user.username, `create user ${username}`);
  return NextResponse.json({ ok: true, redeploying: true });
}

export async function PUT(request) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const body = await request.json();
  const { name, email, password, role, permissions } = body;

  const users = await readUsersFromGitHub();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (role && !['admin', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin or viewer' }, { status: 400 });
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }
  if (permissions) {
    const permErr = validatePermissions(permissions);
    if (permErr) return NextResponse.json({ error: permErr }, { status: 400 });
  }

  // Refuse to demote last admin
  if (role === 'viewer' && users[idx].role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot demote last admin' }, { status: 400 });
    }
  }

  const updated = { ...users[idx] };
  if (name) updated.name = name;
  if (email !== undefined) { if (email) updated.email = email; else delete updated.email; }
  if (role) updated.role = role;
  if (permissions) updated.permissions = permissions;
  if (password) updated.passwordHash = await hashPassword(password);
  users[idx] = updated;

  await commitUsersToGitHub(users, guard.user.username, `update user ${username}`);
  return NextResponse.json({ ok: true, redeploying: true });
}

export async function DELETE(request) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const users = await readUsersFromGitHub();
  const target = users.find(u => u.username === username);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (target.role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete last admin' }, { status: 400 });
    }
  }

  const filtered = users.filter(u => u.username !== username);
  await commitUsersToGitHub(filtered, guard.user.username, `delete user ${username}`);
  return NextResponse.json({ ok: true, redeploying: true });
}
