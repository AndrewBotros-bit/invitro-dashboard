import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The admin panel renders `notify.error` when nothing was sent. These tests
 * pin the shape that makes that possible.
 *
 * Regression guard: the mailer used to return per-recipient errors only
 * inside `results`, which no caller read, so a real Resend rejection
 * ("domain is not verified") surfaced to the CFO as "failed — no
 * deliveries". The cause was captured and then discarded.
 */
const send = vi.fn();
vi.mock('resend', () => ({ Resend: class { constructor() { this.emails = { send }; } } }));

let sendDocumentUploadedEmail;
const RECIPIENTS = [{ email: 'a@example.com', name: 'A' }, { email: 'b@example.com', name: 'B' }];

beforeEach(async () => {
  vi.resetModules();
  send.mockReset();
  process.env.RESEND_API_KEY = 're_test_key';
  ({ sendDocumentUploadedEmail } = await import('@/lib/document-email'));
});
afterEach(() => { delete process.env.RESEND_API_KEY; });

describe('sendDocumentUploadedEmail result shape', () => {
  it('reports the underlying reason when every send is rejected', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'The invitrocapital.com domain is not verified.' } });
    const r = await sendDocumentUploadedEmail({ recipients: RECIPIENTS, filename: 'k1.pdf' });
    expect(r.ok).toBe(false);
    expect(r.sent).toBe(0);
    expect(r.failed).toBe(2);
    // The whole point: the cause reaches the caller, not just "0 sent".
    expect(r.error).toBe('The invitrocapital.com domain is not verified.');
  });

  it('collapses one shared cause into a single message', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'API key is invalid' } });
    const r = await sendDocumentUploadedEmail({ recipients: RECIPIENTS, filename: 'k1.pdf' });
    expect(r.error).toBe('API key is invalid');
  });

  it('keeps distinct causes distinguishable', async () => {
    send
      .mockResolvedValueOnce({ data: null, error: { message: 'domain is not verified' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'rate limit exceeded' } });
    const r = await sendDocumentUploadedEmail({ recipients: RECIPIENTS, filename: 'k1.pdf' });
    expect(r.error).toContain('domain is not verified');
    expect(r.error).toContain('rate limit exceeded');
  });

  it('does not set error when at least one delivery succeeded', async () => {
    send
      .mockResolvedValueOnce({ data: { id: 'm1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'bounced' } });
    const r = await sendDocumentUploadedEmail({ recipients: RECIPIENTS, filename: 'k1.pdf' });
    expect(r.ok).toBe(true);
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.error).toBeUndefined();   // partial success is not a failure
  });

  it('sends one message per recipient, never a shared To: header', async () => {
    send.mockResolvedValue({ data: { id: 'm' }, error: null });
    await sendDocumentUploadedEmail({ recipients: RECIPIENTS, filename: 'k1.pdf' });
    expect(send).toHaveBeenCalledTimes(2);
    for (const call of send.mock.calls) expect(typeof call[0].to).toBe('string');
  });

  it('still skips cleanly with no API key', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const mod = await import('@/lib/document-email');
    const r = await mod.sendDocumentUploadedEmail({ recipients: RECIPIENTS, filename: 'k1.pdf' });
    expect(r).toEqual({ skipped: true, reason: 'RESEND_API_KEY not set' });
    expect(send).not.toHaveBeenCalled();
  });
});
