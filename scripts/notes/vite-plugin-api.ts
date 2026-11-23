import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { Plugin } from 'vite';

/**
 * Serves /api/* from api/router.ts during `npm run dev`, so the Notes page works without `vercel dev`.
 * The module is loaded through Vite's SSR loader, so edits to the API apply on the next request.
 */
export function notesApiDev(): Plugin {
  return {
    name: 'levelup:notes-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse, next) => {
        void (async () => {
          const mod = (await server.ssrLoadModule('/api/router.ts')) as { default: { fetch: (r: Request) => Promise<Response> } };
          const url = new URL(req.originalUrl ?? req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
          const request = new Request(url, {
            method: req.method,
            headers,
            body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
            duplex: 'half',
          } as RequestInit);
          const response = await mod.default.fetch(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        })().catch(next);
      });
    },
  };
}
