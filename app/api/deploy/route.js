export async function POST() {
  const hookUrl = process.env.DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return Response.json(
      { error: 'Deploy hook not configured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      return Response.json(
        { error: 'Hook returned error' },
        { status: 502 }
      );
    }
    return Response.json({ ok: true, message: 'Rebuild triggered' });
  } catch (err) {
    return Response.json(
      { error: 'Failed to reach deploy hook' },
      { status: 502 }
    );
  }
}
