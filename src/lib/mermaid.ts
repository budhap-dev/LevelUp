/**
 * Client-side Mermaid rendering for the `.mermaid-diagram` placeholders emitted by the content pipeline.
 * Mermaid is large, so it is loaded on demand the first time a diagram nears the viewport.
 */
import type { Mermaid } from 'mermaid';

let mermaidPromise: Promise<Mermaid> | null = null;
const loadMermaid = () =>
  (mermaidPromise ??= import('mermaid').then(
    (m) => m.default,
    (error: unknown) => {
      mermaidPromise = null; // don't cache the failure, so a later attempt can succeed
      throw error;
    },
  ));

let configuredTheme: string | null = null;
let counter = 0;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

/** Mermaid's `base` theme coloured from the active app theme (Mermaid needs concrete hex values, not CSS vars). */
function themeVariables(dark: boolean) {
  const [canvas, surface, subtle, line, fg, fgSoft, muted, accent, onAccent, accentSoft] = [
    'canvas', 'surface', 'subtle', 'line', 'fg', 'fg-soft', 'muted', 'accent', 'on-accent', 'accent-soft',
  ].map(token);
  return {
    darkMode: dark,
    background: surface,
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: '14px',
    primaryColor: accentSoft,
    primaryTextColor: fg,
    primaryBorderColor: accent,
    secondaryColor: subtle,
    secondaryTextColor: fg,
    secondaryBorderColor: line,
    tertiaryColor: surface,
    tertiaryTextColor: fg,
    tertiaryBorderColor: line,
    mainBkg: accentSoft,
    nodeBorder: accent,
    nodeTextColor: fg,
    textColor: fg,
    titleColor: fg,
    lineColor: muted,
    clusterBkg: subtle,
    clusterBorder: line,
    edgeLabelBackground: surface,
    // Sequence diagrams
    actorBkg: accentSoft,
    actorBorder: accent,
    actorTextColor: fg,
    actorLineColor: muted,
    signalColor: fgSoft,
    signalTextColor: fg,
    labelBoxBkgColor: subtle,
    labelBoxBorderColor: line,
    labelTextColor: fg,
    loopTextColor: fg,
    noteBkgColor: subtle,
    noteBorderColor: line,
    noteTextColor: fg,
    activationBkgColor: subtle,
    activationBorderColor: accent,
    sequenceNumberColor: onAccent,
    // Quadrant charts
    quadrant1Fill: accentSoft,
    quadrant2Fill: subtle,
    quadrant3Fill: canvas,
    quadrant4Fill: subtle,
    quadrant1TextFill: fg,
    quadrant2TextFill: fg,
    quadrant3TextFill: fg,
    quadrant4TextFill: fg,
    quadrantPointFill: accent,
    quadrantPointTextFill: fg,
    quadrantXAxisTextFill: fgSoft,
    quadrantYAxisTextFill: fgSoft,
    quadrantTitleFill: fg,
    quadrantInternalBorderStrokeFill: line,
    quadrantExternalBorderStrokeFill: line,
  };
}

const FADE_SELECTOR = [
  'g.cluster', 'g.node', 'g.edgeLabel',
  'rect.actor', 'text.actor', 'line.actor-line', '.note', '.noteText', '.labelBox', '.labelText', '.loopText', '.loopLine', '.messageText', '.activation0',
  '.quadrant', '.data-point', '.quadrant-points g',
].join(',');
const DRAW_SELECTOR = ['path.flowchart-link', '.edgePath path', '.messageLine0', '.messageLine1', 'path.relation', 'path.transition'].join(',');

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fade nodes in one after another, then draw solid edges along their length. */
function animateIn(container: HTMLElement) {
  const svg = container.querySelector('svg');
  if (!svg || reducedMotion()) return;
  container.dataset.animate = 'true';

  svg.querySelectorAll<SVGElement>(FADE_SELECTOR).forEach((el, i) => {
    el.classList.add('mmd-fade');
    el.style.setProperty('--i', String(Math.min(i, 24)));
  });

  const edges = [...svg.querySelectorAll<SVGGeometryElement>(DRAW_SELECTOR)].filter(
    // Dashed/dotted edges already use stroke-dasharray; leave those alone.
    (el) => typeof el.getTotalLength === 'function' && getComputedStyle(el).strokeDasharray === 'none',
  );
  edges.forEach((el, i) => {
    const length = el.getTotalLength();
    el.classList.add('mmd-draw');
    el.style.setProperty('--i', String(Math.min(i, 24)));
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.addEventListener(
      'transitionend',
      () => {
        el.style.strokeDasharray = '';
        el.style.strokeDashoffset = '';
      },
      { once: true },
    );
  });
  // Two frames so the start state is painted before transitioning to the drawn state.
  requestAnimationFrame(() => requestAnimationFrame(() => edges.forEach((el) => (el.style.strokeDashoffset = '0'))));
  container.addEventListener('animationend', () => delete container.dataset.animate, { once: true });
}

/**
 * Render (or re-render for a new theme) one placeholder.
 * The first render animates; theme re-renders swap in place.
 */
export async function renderDiagram(container: HTMLElement, themeId: string, dark: boolean) {
  const source = (container.dataset.source ??= container.textContent ?? '');
  if (container.dataset.renderedTheme === themeId) return;

  let mermaid: Mermaid;
  try {
    mermaid = await loadMermaid();
  } catch {
    // Mermaid is cached the first time a diagram renders, so a first view while offline can't load it.
    // Show the source for now and try again once the connection is back.
    container.dataset.state = 'error';
    container.textContent = `This diagram needs a connection the first time it's shown.\n\n${source}`;
    window.addEventListener('online', () => void renderDiagram(container, themeId, dark), { once: true });
    return;
  }
  if (configuredTheme !== themeId) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: themeVariables(dark) });
    configuredTheme = themeId;
  }

  const firstRender = !container.dataset.renderedTheme;
  const id = `mmd-${++counter}`;
  try {
    const { svg } = await mermaid.render(id, source);
    container.innerHTML = svg;
    container.dataset.state = 'rendered';
    container.dataset.renderedTheme = themeId;
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', `Diagram: ${source.split('\n')[0]?.trim() ?? 'diagram'}`);
    if (firstRender) animateIn(container);
  } catch (error) {
    document.getElementById(`d${id}`)?.remove(); // Mermaid leaves its error SVG in <body>
    container.dataset.state = 'error';
    container.textContent = `Diagram could not be rendered: ${(error as Error).message}\n\n${source}`;
  }
}
