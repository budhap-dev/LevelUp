import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'notes_session';
export const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time passphrase check (hashing first makes the lengths equal). */
export function passwordMatches(input: string, expected: string): boolean {
  return timingSafeEqual(sha256(input), sha256(expected));
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/** Session token: `<expiry ms>.<HMAC of expiry>`. Rotating NOTES_SESSION_SECRET signs every device out. */
export function createSessionToken(secret: string, now = Date.now()): string {
  const expires = String(now + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${expires}.${sign(expires, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const [expires, mac, extra] = token.split('.');
  if (!expires || !mac || extra !== undefined || !/^\d+$/.test(expires)) return false;
  const expected = Buffer.from(sign(expires, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Number(expires) > now;
}

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/api', 'HttpOnly', 'SameSite=Strict', `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearedSessionCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, 'Path=/api', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ');
}
