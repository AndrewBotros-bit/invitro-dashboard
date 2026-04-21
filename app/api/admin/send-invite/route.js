import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, isAdmin, COOKIE_NAME } from '@/lib/auth';

const FROM = process.env.INVITE_FROM_EMAIL || 'InVitro Dashboard <onboarding@resend.dev>';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://invitro-dashboard-1.vercel.app';

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return { error: 'Not authenticated', status: 401 };
  const user = verifySessionToken(session.value);
  if (!user) return { error: 'Invalid session', status: 401 };
  if (!isAdmin(user)) return { error: 'Admin access required', status: 403 };
  return { user };
}

function buildEmailHTML({ name, username, password, senderName }) {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
  <div style="background: #2563eb; color: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; margin-bottom: 24px;">IV</div>
  <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">You've been invited to the InVitro Capital Dashboard</h1>
  <p style="color: #475569; margin: 0 0 24px;">${senderName || 'An admin'} has given you access to the InVitro Capital shareholder dashboard.</p>

  <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600;">Your credentials</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 4px 0; color: #475569; width: 100px;">Name:</td><td style="padding: 4px 0; font-weight: 600;">${name || username}</td></tr>
      <tr><td style="padding: 4px 0; color: #475569;">Username:</td><td style="padding: 4px 0; font-weight: 600; font-family: 'SF Mono', Menlo, monospace;">${username}</td></tr>
      <tr><td style="padding: 4px 0; color: #475569;">Password:</td><td style="padding: 4px 0; font-weight: 600; font-family: 'SF Mono', Menlo, monospace;">${password}</td></tr>
    </table>
  </div>

  <a href="${DASHBOARD_URL}/login" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 8px 0;">Open Dashboard →</a>

  <p style="color: #64748b; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">For security, change your password after your first login. If you didn't expect this invitation, please ignore this email.</p>
</div>`.trim();
}

export async function POST(request) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured. Add it to Vercel env vars.' },
      { status: 503 }
    );
  }

  const { username, name, email, password } = await request.json();
  if (!email || !username || !password) {
    return NextResponse.json({ error: 'username, email, password required' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Welcome to InVitro Capital Dashboard, ${name || username}`,
      html: buildEmailHTML({ name, username, password, senderName: guard.user.name }),
    });
    if (error) {
      return NextResponse.json({ error: error.message || 'Email send failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, messageId: data?.id });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 });
  }
}
