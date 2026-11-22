import type { Plugin } from 'vite';

/**
 * Decides which built JS chunks the service worker precaches.
 *
 * Everything reachable from the app entry is precached: the shell, every lazy route and every topic chunk,
 * so the whole knowledge base works offline after the first visit. The walk stops at Mermaid's chunk:
 * Mermaid and its ~100 diagram/layout chunks (~6 MB) would dominate the first download, so they are
 * cached at runtime instead, the first time a diagram renders (see `runtimeCaching` in vite.config.ts).
 *
 * `precacheScope()` returns the plugin plus a Workbox `manifestTransform` that applies the result.
 * The plugin's `generateBundle` runs before vite-plugin-pwa writes the service worker, so the set is
 * ready by the time the transform is called.
 */
export function precacheScope(isDeferredRoot: (moduleId: string) => boolean = (id) => /[\\/]node_modules[\\/]mermaid[\\/]/.test(id)) {
  const precached = new Set<string>();
  const deferred = new Set<string>();

  const plugin: Plugin = {
    name: 'levelup:precache-scope',
    apply: 'build',
    generateBundle(_options, bundle) {
      precached.clear();
      deferred.clear();
      const chunks = new Map<string, { imports: string[]; dynamicImports: string[] }>();
      const stops = new Set<string>();
      const queue: string[] = [];
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'chunk') continue;
        chunks.set(fileName, output);
        if (output.isEntry) queue.push(fileName);
        if (output.isDynamicEntry && output.facadeModuleId && isDeferredRoot(output.facadeModuleId)) stops.add(fileName);
      }
      if (stops.size === 0) this.warn('No deferred root chunk found; every chunk will be precached.');

      while (queue.length) {
        const fileName = queue.pop()!;
        if (precached.has(fileName) || stops.has(fileName)) continue;
        precached.add(fileName);
        const chunk = chunks.get(fileName);
        if (chunk) queue.push(...chunk.imports, ...chunk.dynamicImports);
      }
      for (const fileName of chunks.keys()) if (!precached.has(fileName)) deferred.add(fileName);
    },
  };

  /** Workbox manifest transform: drop deferred chunks; keep everything else (CSS, HTML, icons…). */
  const manifestTransform = async <T extends { url: string; size: number }>(entries: T[]) => {
    const manifest = entries.filter((e) => !deferred.has(e.url.replace(/^\//, '')));
    return { manifest, warnings: [] as string[] };
  };

  return { plugin, manifestTransform, precached, deferred };
}
