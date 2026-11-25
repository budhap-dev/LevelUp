/**
 * The passphrase gate for the whole app, run by Vercel Routing Middleware (middleware.ts) before any page or
 * asset is served. It verifies the same session token as the Notes API (auth.ts) but with Web Crypto, so it
 * runs on the Edge runtime. /api/* is excluded: the API checks the session itself, and the unlock page needs
 * POST /api/session (rate-limited there) to sign in.
 */
import { SESSION_COOKIE } from './session-cookie.js';

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Same format and checks as auth.verifySessionToken: `<expiry ms>.<base64url HMAC-SHA256 of expiry>`. */
export async function verifySessionTokenEdge(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expires, mac, extra] = token.split('.');
  if (!expires || !mac || extra !== undefined || !/^\d+$/.test(expires) || Number(expires) <= now) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(expires)));
  if (expected.length !== mac.length) return false;
  let diff = 0; // constant-time comparison
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/** Files the unlock page itself uses, served without a session. Everything else needs one. */
const PUBLIC_PATHS = new Set(['/favicon.svg', '/apple-touch-icon.png', '/robots.txt']);

/**
 * `null` lets the request through; otherwise the response to send instead.
 * Fails closed: with no session secret configured, nothing is served.
 */
export async function gate(request: Request, secret: string | undefined): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || PUBLIC_PATHS.has(url.pathname)) return null;
  if (!secret) return new Response('LevelUp is not configured: NOTES_SESSION_SECRET is missing.', { status: 503 });
  if (await verifySessionTokenEdge(readCookie(request, SESSION_COOKIE), secret)) return null;

  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff' };
  const wantsPage = request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  if (!wantsPage) return new Response('Locked', { status: 401, headers: { ...headers, 'content-type': 'text/plain' } });
  return new Response(UNLOCK_PAGE, {
    status: 401,
    headers: {
      ...headers,
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
      'referrer-policy': 'no-referrer',
    },
  });
}

/** Self-contained (inline CSS and JS, no app assets) so it works while every other file is locked. */
export const UNLOCK_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LevelUp · Locked</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: light dark; --bg: #f6f7fb; --card: #fff; --fg: #111827; --muted: #6b7280; --line: #e5e7eb; --accent: #4f46e5; --on-accent: #fff; --danger: #b91c1c; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1020; --card: #121a2e; --fg: #e5e7eb; --muted: #9ca3af; --line: #26304a; --accent: #818cf8; --on-accent: #0b1020; --danger: #f87171; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--fg);
    font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 360px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.08); animation: rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  @keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
  @media (prefers-reduced-motion: reduce) { main, .shake { animation: none !important; } }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; margin-bottom: 4px; }
  .brand img { width: 32px; height: 32px; }
  p { margin: 0 0 20px; color: var(--muted); }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: inherit; font: inherit; }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
  button { margin-top: 14px; width: 100%; padding: 10px 12px; border: 0; border-radius: 10px; background: var(--accent); color: var(--on-accent); font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .error { min-height: 1.5em; margin: 10px 0 0; color: var(--danger); font-size: 14px; }
  .shake { animation: shake 300ms; }
</style>
</head>
<body>
<main>
  <div class="brand"><img src="/favicon.svg" alt="">LevelUp Engineer</div>
  <p>This site is private. Enter the passphrase to continue.</p>
  <form id="f">
    <label for="p">Passphrase</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required autofocus>
    <button id="b" type="submit">Unlock</button>
    <p class="error" id="e" role="alert"></p>
  </form>
</main>
<script>
  const f = document.getElementById('f'), p = document.getElementById('p'), b = document.getElementById('b'), e = document.getElementById('e');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    b.disabled = true; e.textContent = '';
    try {
      const r = await fetch('/api/session', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-notes-client': '1' },
        body: JSON.stringify({ password: p.value }),
      });
      if (r.ok) { location.reload(); return; }
      const body = await r.json().catch(() => ({}));
      e.textContent = body.error || (r.status === 401 ? 'Wrong passphrase.' : 'Could not unlock (' + r.status + ').');
    } catch { e.textContent = 'Network error. Check your connection and try again.'; }
    b.disabled = false; p.select();
    f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  });
</script>
</body>
</html>`;
