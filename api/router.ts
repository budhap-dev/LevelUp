/**
 * The Notes API: one Vercel Function behind every /api/* path (see the rewrite in vercel.json).
 * Locally, `npm run dev` serves the same handler through a Vite middleware (vite.config.ts).
 *
 * Environment: DATABASE_URL (Neon), NOTES_PASSWORD, NOTES_SESSION_SECRET.
 */
import { createApp } from './_lib/app.js';
import { createNeonRepo, type NotesRepo } from './_lib/repo.js';

let repo: NotesRepo | undefined;

const handle = createApp({
  repo: () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    return (repo ??= createNeonRepo(process.env.DATABASE_URL));
  },
  get password() {
    return process.env.NOTES_PASSWORD;
  },
  get sessionSecret() {
    return process.env.NOTES_SESSION_SECRET;
  },
});

export default { fetch: handle };
