import { precacheScope } from './precache-scope.ts';

type Chunk = { type: 'chunk'; isEntry?: boolean; isDynamicEntry?: boolean; facadeModuleId?: string | null; imports: string[]; dynamicImports: string[] };
const chunk = (c: Partial<Chunk>): Chunk => ({ type: 'chunk', imports: [], dynamicImports: [], facadeModuleId: null, ...c });

// entry → shared runtime, lazy TopicPage → topic chunk, lazy wrapper → mermaid → diagram chunk (+ shared runtime)
const bundle = {
  'assets/index.js': chunk({ isEntry: true, imports: ['assets/runtime.js'], dynamicImports: ['assets/TopicPage.js', 'assets/mermaid-wrapper.js'] }),
  'assets/runtime.js': chunk({}),
  'assets/TopicPage.js': chunk({ isDynamicEntry: true, imports: ['assets/runtime.js'], dynamicImports: ['assets/caching.js'] }),
  'assets/caching.js': chunk({ isDynamicEntry: true }),
  'assets/mermaid-wrapper.js': chunk({ isDynamicEntry: true, facadeModuleId: '/app/src/lib/mermaid.ts', dynamicImports: ['assets/mermaid.core.js'] }),
  'assets/mermaid.core.js': chunk({
    isDynamicEntry: true,
    facadeModuleId: '/app/node_modules/mermaid/dist/mermaid.core.mjs',
    imports: ['assets/runtime.js'],
    dynamicImports: ['assets/flowDiagram.js'],
  }),
  'assets/flowDiagram.js': chunk({ isDynamicEntry: true }),
  'assets/index.css': { type: 'asset' },
};

function run() {
  const scope = precacheScope();
  const warn = vi.fn();
  (scope.plugin.generateBundle as (this: unknown, o: unknown, b: unknown) => void).call({ warn }, {}, bundle);
  return { ...scope, warn };
}

describe('precacheScope', () => {
  it('precaches everything reachable from the entry except Mermaid and what only Mermaid uses', () => {
    const { precached, deferred, warn } = run();
    expect([...precached].sort()).toEqual(['assets/TopicPage.js', 'assets/caching.js', 'assets/index.js', 'assets/mermaid-wrapper.js', 'assets/runtime.js']);
    expect([...deferred].sort()).toEqual(['assets/flowDiagram.js', 'assets/mermaid.core.js']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('removes deferred chunks from the Workbox manifest and keeps other files', async () => {
    const { manifestTransform } = run();
    const entries = ['assets/index.js', 'assets/caching.js', 'assets/mermaid.core.js', 'assets/flowDiagram.js', 'assets/index.css', 'index.html', 'pwa-192x192.png'].map(
      (url) => ({ url, size: 1, revision: null }),
    );
    const { manifest } = await manifestTransform(entries);
    expect(manifest.map((e) => e.url)).toEqual(['assets/index.js', 'assets/caching.js', 'assets/index.css', 'index.html', 'pwa-192x192.png']);
  });

  it('warns and precaches everything when the deferred root is missing', () => {
    const scope = precacheScope(() => false);
    const warn = vi.fn();
    (scope.plugin.generateBundle as (this: unknown, o: unknown, b: unknown) => void).call({ warn }, {}, bundle);
    expect(warn).toHaveBeenCalledOnce();
    expect(scope.deferred.size).toBe(0);
  });
});
