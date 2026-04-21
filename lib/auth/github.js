/**
 * Commit users.json changes back to the GitHub repo.
 * Triggers a Vercel redeploy via the existing main-branch watcher.
 */
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'AndrewBotros-bit';
const GITHUB_REPO = process.env.GITHUB_REPO || 'invitro-dashboard';
const USERS_PATH = 'lib/auth/users.json';

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN env var not set');
  return t;
}

async function getFileRaw() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${USERS_PATH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub getFile failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getFileSha() {
  const json = await getFileRaw();
  return json.sha;
}

/**
 * Read users.json directly from GitHub main branch (always fresh).
 * Use this for the admin UI so newly-created users show up immediately
 * even before Vercel finishes its redeploy.
 */
export async function readUsersFromGitHub() {
  const json = await getFileRaw();
  const content = Buffer.from(json.content, 'base64').toString('utf8');
  return JSON.parse(content);
}

/**
 * Commit the new users array to users.json on main.
 * @param {object[]} users
 * @param {string} changedBy - username performing the change
 * @param {string} action - e.g. "create user X"
 */
export async function commitUsersToGitHub(users, changedBy, action) {
  const sha = await getFileSha();
  const content = JSON.stringify(users, null, 2) + '\n';
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${USERS_PATH}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: `admin: ${action} (by ${changedBy})`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      sha,
      branch: 'main',
    }),
  });
  if (!res.ok) throw new Error(`GitHub commit failed: ${res.status} ${await res.text()}`);
  return res.json();
}
