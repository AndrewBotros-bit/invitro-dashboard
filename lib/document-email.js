/**
 * "New document available" notification.
 *
 * Mirrors the send-invite mailer's contract:
 *   - Uses Resend (via RESEND_API_KEY)
 *   - INVITE_FROM_EMAIL for the "From" header
 *   - NEXT_PUBLIC_DASHBOARD_URL for the login link
 *
 * Unlike send-invite, this is best-effort: a missing RESEND_API_KEY
 * returns { skipped: true } rather than throwing. Uploads succeed even
 * if the notification can't be sent.
 */

const FROM = process.env.INVITE_FROM_EMAIL || 'InVitro Dashboard <onboarding@resend.dev>';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://invitro-dashboard-1.vercel.app';

function buildHTML({ recipientName, filename, senderName }) {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
  <svg width="48" height="48" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 24px; display: block;">
    <path d="M 18 32 L 38 50 L 18 68" stroke="#8AB8E8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <path d="M 50 22 L 78 50 L 50 78" stroke="#0A2540" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </svg>
  <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">A new document is available for you</h1>
  <p style="color: #475569; margin: 0 0 24px;">${senderName || 'An admin'} uploaded a new document to your InVitro Capital Dashboard.</p>

  <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600;">New document</p>
    <p style="margin: 0; font-size: 15px; font-weight: 600; word-break: break-all;">${filename}</p>
  </div>

  <a href="${DASHBOARD_URL}/login" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 8px 0;">Open Dashboard →</a>

  <p style="color: #64748b; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">Sign in with your existing credentials and open the "Documents" section from the sidebar to download.</p>
</div>`.trim();
}

/**
 * Best-effort send. Returns { ok: true, messageId } on success,
 * { skipped: true, reason } when the mailer isn't configured, or
 * { error } on Resend failure.
 */
export async function sendDocumentUploadedEmail({ toEmail, toName, filename, senderName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true, reason: 'RESEND_API_KEY not set' };
  if (!toEmail) return { skipped: true, reason: 'LP has no email on file' };

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `New document in your InVitro Capital Dashboard: ${filename}`,
      html: buildHTML({ recipientName: toName, filename, senderName }),
    });
    if (error) return { error: error.message || 'Email send failed' };
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return { error: err.message || 'Send failed' };
  }
}
