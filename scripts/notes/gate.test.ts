import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from '../../api/_lib/auth.ts';
import { gate, PUBLIC_PATHS, verifySessionTokenEdge } from '../../api/_lib/gate.ts';

const SECRET = 'test-secret';
const req = (path: string, init: { cookie?: string; accept?: string; method?: string } = {}) =>
  new Request(`https://levelup.example${path}`, {
    method: init.method ?? 'GET',
    headers: { accept: init.accept ?? 'text/html', ...(init.cookie ? { cookie: init.cookie } : {}) },
  });

describe('verifySessionTokenEdge', () => {
  it('agrees with the Node verifier on valid, tampered, foreign and expired tokens', async () => {
    const token = createSessionToken(SECRET, 1_000);
    const cases = [token, token.slice(0, -2) + 'xx', createSessionToken('other', 1_000), `${token}.extra`, 'garbage', ''];
    for (const t of cases) {
      expect(await verifySessionTokenEdge(t, SECRET, 2_000)).toBe(verifySessionToken(t, SECRET, 2_000));
    }
    expect(await verifySessionTokenEdge(token, SECRET, 2_000)).toBe(true);
    expect(await verifySessionTokenEdge(token, SECRET, 1_000 + 31 * 86_400_000)).toBe(false);
  });
});

describe('gate', () => {
  const cookie = () => `theme=dark; notes_session=${createSessionToken(SECRET)}`;

  it('serves the unlock page for a locked page request', async () => {
    const res = await gate(req('/topics/caching'), SECRET);
    expect(res?.status).toBe(401);
    expect(res?.headers.get('cache-control')).toBe('no-store');
    expect(await res?.text()).toContain('Enter the passphrase');
  });

  it('refuses locked assets without the page', async () => {
    const res = await gate(req('/assets/index-abc.js', { accept: '*/*' }), SECRET);
    expect(res?.status).toBe(401);
    expect(await res?.text()).toBe('Locked');
  });

  it('lets a valid session through to everything', async () => {
    expect(await gate(req('/', { cookie: cookie() }), SECRET)).toBeNull();
    expect(await gate(req('/assets/index-abc.js', { cookie: cookie(), accept: '*/*' }), SECRET)).toBeNull();
  });

  it('always lets the API and the unlock page’s own files through', async () => {
    expect(await gate(req('/api/session'), SECRET)).toBeNull();
    expect(await gate(req('/favicon.svg'), SECRET)).toBeNull();
  });

  it('serves the web app manifest and its icons without a session, so the app can be installed', async () => {
    for (const path of ['/manifest.webmanifest', '/pwa-192x192.png', '/pwa-512x512.png', '/maskable-512x512.png']) {
      expect(await gate(req(path, { accept: '*/*' }), SECRET)).toBeNull();
    }
    // The service worker and app files stay locked.
    expect((await gate(req('/sw.js', { accept: '*/*' }), SECRET))?.status).toBe(401);
  });

  it('lists every manifest icon as public', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const iconPaths = [...config.matchAll(/src: '(\/[^']+\.png)'/g)].map((m) => m[1] ?? '');
    expect(iconPaths.length).toBeGreaterThan(0);
    for (const path of iconPaths) expect(PUBLIC_PATHS.has(path), path).toBe(true);
  });

  it('fails closed when the secret is not configured', async () => {
    expect((await gate(req('/'), undefined))?.status).toBe(503);
  });
});
