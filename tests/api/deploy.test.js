import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('POST /api/deploy', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('returns 500 when VERCEL_DEPLOY_HOOK_URL is not set', async () => {
    delete process.env.VERCEL_DEPLOY_HOOK_URL;
    const { POST } = await import('@/app/api/deploy/route');
    const result = await POST();
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('Deploy hook not configured');
  });

  it('returns 200 with ok:true when hook succeeds', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/hooks/test';
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const { POST } = await import('@/app/api/deploy/route');
    const result = await POST();
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.ok).toBe(true);
    expect(body.message).toBe('Rebuild triggered');
  });

  it('returns 502 when hook returns non-2xx', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/hooks/test';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const { POST } = await import('@/app/api/deploy/route');
    const result = await POST();
    expect(result.status).toBe(502);
    const body = await result.json();
    expect(body.error).toBe('Hook returned error');
  });

  it('returns 502 when fetch throws', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/hooks/test';
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { POST } = await import('@/app/api/deploy/route');
    const result = await POST();
    expect(result.status).toBe(502);
    const body = await result.json();
    expect(body.error).toBe('Failed to reach deploy hook');
  });

  it('calls fetch with the correct URL and method POST', async () => {
    const hookUrl = 'https://api.vercel.com/v1/hooks/my-hook';
    process.env.VERCEL_DEPLOY_HOOK_URL = hookUrl;
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const { POST } = await import('@/app/api/deploy/route');
    await POST();
    expect(global.fetch).toHaveBeenCalledWith(hookUrl, { method: 'POST' });
  });
});
