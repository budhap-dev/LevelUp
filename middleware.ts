/**
 * Vercel Routing Middleware: the whole app sits behind the Notes passphrase.
 * Runs before every page and static file (but not /api/*, see api/_lib/gate.ts).
 */
import { gate } from './api/_lib/gate.js';

export const config = { matcher: ['/((?!api/).*)'] };

export default async function middleware(request: Request): Promise<Response> {
  return (await gate(request, process.env.NOTES_SESSION_SECRET)) ?? new Response(null, { headers: { 'x-middleware-next': '1' } });
}
