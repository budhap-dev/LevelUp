/**
 * Runs the content pipeline inside Vite:
 * - build: compiles once and fails the build on content errors
 * - dev: recompiles when anything under /content changes and shows errors in the browser overlay
 */
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { buildContent, writeContent } from './pipeline.ts';

export function contentPlugin(): Plugin {
  let root = process.cwd();
  let devServer: ViteDevServer | undefined;
  const contentDir = () => path.join(root, 'content');
  const outDir = () => path.join(root, 'src/generated');

  async function compile(server?: ViteDevServer) {
    const build = await buildContent(contentDir());
    const { errors, warnings } = build.diagnostics;
    if (errors.length) {
      const message = `Content errors:\n${build.diagnostics.format()}`;
      if (!server) throw new Error(message);
      server.config.logger.error(message, { timestamp: true });
      server.ws.send({ type: 'error', err: { message, stack: '', plugin: 'levelup-content' } });
      return;
    }
    await writeContent(outDir(), build);
    const log = server?.config.logger;
    if (log && warnings.length) log.warn(`content: ${warnings.length} warning(s) — run "npm run content" for details`, { timestamp: true });
  }

  return {
    name: 'levelup-content',
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      // In dev this runs once at startup (errors are reported, not thrown); the watcher handles changes afterwards.
      await compile(devServer);
    },
    configureServer(server) {
      devServer = server;
      server.watcher.add(contentDir());
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onChange = (file: string) => {
        if (!file.startsWith(contentDir())) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          compile(server).catch((e) => server.config.logger.error(String(e)));
        }, 100);
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
