import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from '../../api/_lib/auth.ts';
import { gate, verifySessionTokenEdge } from '../../api/_lib/gate.ts';

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

  it('fails closed when the secret is not configured', async () => {
    expect((await gate(req('/'), undefined))?.status).toBe(503);
  });
});
