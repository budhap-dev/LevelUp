/**
 * Step-through player for rendered Mermaid diagrams.
 *
 * Flowcharts and state diagrams step edge by edge (in source order); sequence diagrams step message by message
 * (top to bottom, notes included). Steps not reached yet are dimmed, the current edge or message draws itself,
 * and a caption narrates it. Authors can override captions with `%% step: …` comments in the diagram source:
 * the n-th comment narrates the n-th step.
 */

export interface DiagramStep {
  /** Everything revealed from this step on. */
  els: Element[];
  /** Highlighted while this is the current step. */
  focus: Element[];
  /** Solid lines that draw themselves when the step becomes current. */
  draw: SVGGeometryElement[];
  caption: string;
}

/** `%% step: …` comments, in order. */
export function parseNarration(source: string): string[] {
  return source
    .split('\n')
    .map((line) => /^\s*%%\s*step:\s*(.+?)\s*$/i.exec(line)?.[1])
    .filter((s): s is string => Boolean(s));
}

/** Which diagram kinds can be stepped through, from Mermaid's `aria-roledescription`. */
export function stepKind(svg: Element): 'edges' | 'sequence' | null {
  const type = svg.getAttribute('aria-roledescription') ?? '';
  if (type === 'sequence') return 'sequence';
  if (/^(flowchart|stateDiagram)/.test(type)) return 'edges';
  return null;
}

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const isSolid = (el: Element) =>
  !/edge-pattern-(dotted|dashed)|edge-animation|messageLine1/.test(el.getAttribute('class') ?? '') && typeof (el as SVGGeometryElement).getTotalLength === 'function';

/** Distance from a point to a rectangle (0 inside it). */
function distance(x: number, y: number, r: DOMRect) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function nearest<T extends Element>(x: number, y: number, candidates: T[]): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const d = distance(x, y, c.getBoundingClientRect());
    if (d < bestDistance) [best, bestDistance] = [c, d];
  }
  return best;
}

function endpoint(path: SVGGeometryElement, atEnd: boolean) {
  const p = path.getPointAtLength(atEnd ? path.getTotalLength() : 0);
  const ctm = path.getScreenCTM();
  return ctm ? new DOMPoint(p.x, p.y).matrixTransform(ctm) : p;
}

function nodeLabel(node: Element | undefined) {
  if (!node) return '?';
  const label = text(node.querySelector('.nodeLabel, .label')) || text(node);
  if (label) return label;
  return /state-start|root_start/.test(node.id) || node.querySelector('.state-start') ? 'start' : /end/.test(node.id) ? 'end' : '?';
}

/** Flowcharts and state diagrams: one step per edge, revealing the edge, its label and both ends. */
function edgeSteps(svg: SVGSVGElement): DiagramStep[] {
  const nodes = [...svg.querySelectorAll('g.node')];
  const edges = [...svg.querySelectorAll<SVGGeometryElement>('path[data-edge="true"]')].filter(
    (e) => typeof e.getTotalLength === 'function' && e.getTotalLength() > 0,
  );
  return edges.map((edge) => {
    const [a, b] = [endpoint(edge, false), endpoint(edge, true)];
    const from = nearest(a.x, a.y, nodes);
    const to = nearest(b.x, b.y, nodes);
    const id = edge.dataset.id;
    const label = id ? svg.querySelector(`g.label[data-id="${CSS.escape(id)}"]`)?.closest('g.edgeLabel') : null;
    const labelText = text(label);
    const els = [edge, label, from, to].filter((e): e is Element => Boolean(e));
    return {
      els,
      focus: [edge, label, to].filter((e): e is Element => Boolean(e)),
      draw: isSolid(edge) ? [edge] : [],
      caption: `${nodeLabel(from)} → ${nodeLabel(to)}${labelText ? `: ${labelText}` : ''}`,
    };
  });
}

/** Sequence diagrams: one step per message (text + arrow + number) or note, top to bottom. */
function sequenceSteps(svg: SVGSVGElement): DiagramStep[] {
  const actors = [...svg.querySelectorAll('rect.actor-top')].map((rect) => {
    const r = rect.getBoundingClientRect();
    return { centre: r.left + r.width / 2, name: text(rect.parentElement?.querySelector('text.actor')) };
  });
  const actorAt = (x: number) =>
    actors.reduce<{ centre: number; name: string } | undefined>(
      (best, a) => (!best || Math.abs(a.centre - x) < Math.abs(best.centre - x) ? a : best),
      undefined,
    )?.name;

  const lines = [...svg.querySelectorAll<SVGGeometryElement>('.messageLine0, .messageLine1')];
  const texts = [...svg.querySelectorAll('text.messageText')];
  const numbers = [...svg.querySelectorAll('text.sequenceNumber')];
  const top = (el: Element) => el.getBoundingClientRect().top;

  const messages = lines.map((line, i) => {
    const r = line.getBoundingClientRect();
    const label = texts.length === lines.length ? texts[i] : texts.find((t) => Math.abs(top(t) - r.top) < 40);
    const number = numbers.find((n) => Math.abs(top(n) - r.top) < 14);
    const a = endpoint(line, false);
    const b = endpoint(line, true);
    const fromName = actorAt(a.x);
    const toName = actorAt(b.x);
    const route = fromName && toName ? (fromName === toName ? `${fromName} (self)` : `${fromName} → ${toName}`) : '';
    const message = text(label);
    return {
      y: r.top,
      step: {
        els: [line, label, number].filter((e): e is Element => Boolean(e)),
        focus: [line, label].filter((e): e is Element => Boolean(e)),
        draw: isSolid(line) ? [line] : [],
        caption: [route, message].filter(Boolean).join(': '),
      },
    };
  });

  const notes = [...svg.querySelectorAll('rect.note')].map((rect) => {
    const group = rect.parentElement;
    const noteText = [...(group?.querySelectorAll('text.noteText') ?? [])];
    return {
      y: rect.getBoundingClientRect().top,
      step: { els: [rect, ...noteText], focus: [rect], draw: [], caption: `Note: ${noteText.map(text).join(' ')}` },
    };
  });

  return [...messages, ...notes].sort((p, q) => p.y - q.y).map((m) => m.step);
}

export function buildSteps(svg: SVGSVGElement, narration: string[] = []): DiagramStep[] {
  const kind = stepKind(svg);
  const steps = kind === 'sequence' ? sequenceSteps(svg) : kind === 'edges' ? edgeSteps(svg) : [];
  return steps.map((s, i) => ({ ...s, caption: narration[i] ?? s.caption }));
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  play: 'M6 4l14 8-14 8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  prev: 'm15 18-6-6 6-6',
  next: 'm9 18 6-6-6-6',
  restart: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
};

function iconButton(action: keyof typeof ICONS | 'step', label: string, icon: keyof typeof ICONS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mmd-btn';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="${ICONS[icon]}"/></svg>`;
  return button;
}

export const STEP_INTERVAL_MS = 1900;

/**
 * Add the step-through controls under a rendered diagram. Does nothing for diagrams with fewer than 3 steps
 * or kinds that can't be stepped. Steps are measured lazily, on first use, when the SVG is laid out.
 */
export function attachPlayer(container: HTMLElement, source: string) {
  const svg = container.querySelector<SVGSVGElement>(':scope > svg');
  if (!svg || !stepKind(svg)) return;
  const count = svg.getAttribute('aria-roledescription') === 'sequence'
    ? svg.querySelectorAll('.messageLine0, .messageLine1, rect.note').length
    : svg.querySelectorAll('path[data-edge="true"]').length;
  if (count < 3) return;

  const narration = parseNarration(source);
  let steps: DiagramStep[] | null = null;
  let current = -1;
  let timer: number | undefined;

  const bar = document.createElement('div');
  bar.className = 'mmd-player';
  bar.dataset.active = 'false';
  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'mmd-start';
  start.dataset.action = 'start';
  start.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path d="${ICONS.play}"/></svg><span>Step through</span>`;
  const play = iconButton('play', 'Play', 'play');
  const prev = iconButton('prev', 'Previous step', 'prev');
  const next = iconButton('next', 'Next step', 'next');
  const restart = iconButton('restart', 'Start again', 'restart');
  const counter = document.createElement('span');
  counter.className = 'mmd-count';
  const caption = document.createElement('p');
  caption.className = 'mmd-caption';
  caption.setAttribute('aria-live', 'polite');
  const controls = document.createElement('div');
  controls.className = 'mmd-controls';
  controls.append(prev, play, next, restart, counter);
  bar.append(start, controls, caption);
  container.append(bar);

  const ensureSteps = () => {
    if (steps) return steps;
    steps = buildSteps(svg, narration);
    steps.forEach((s) => s.els.forEach((el) => el.classList.add('mmd-step')));
    return steps;
  };

  const setPlaying = (on: boolean) => {
    window.clearInterval(timer);
    timer = undefined;
    play.dataset.action = on ? 'pause' : 'play';
    play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    play.title = on ? 'Pause' : 'Play';
    play.querySelector('path')?.setAttribute('d', on ? ICONS.pause : ICONS.play);
    if (on) {
      timer = window.setInterval(() => {
        if (!container.isConnected) return setPlaying(false);
        if (current >= (steps?.length ?? 0) - 1) return setPlaying(false);
        show(current + 1);
      }, STEP_INTERVAL_MS);
    }
  };

  function show(index: number) {
    const all = ensureSteps();
    current = Math.max(-1, Math.min(index, all.length - 1));
    const shown = new Set(all.slice(0, current + 1).flatMap((s) => s.els));
    const focus = new Set(all[current]?.focus ?? []);
    all.forEach((s) =>
      s.els.forEach((el) => {
        el.classList.toggle('is-shown', shown.has(el));
        el.classList.toggle('is-current', focus.has(el));
      }),
    );
    if (!reducedMotion()) {
      all[current]?.draw.forEach((el) => {
        const length = el.getTotalLength();
        el.animate(
          [
            { strokeDasharray: `${length} ${length}`, strokeDashoffset: `${length}` },
            { strokeDasharray: `${length} ${length}`, strokeDashoffset: '0' },
          ],
          { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
      });
      caption.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], {
        duration: 260,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    }
    counter.textContent = `${current + 1} / ${all.length}`;
    caption.textContent = all[current]?.caption ?? 'Press play, or step with the arrows.';
    prev.disabled = current < 0;
    next.disabled = current >= all.length - 1;
  }

  const activate = () => {
    delete container.dataset.animate; // stop the entrance animation from overriding step opacity
    svg.classList.add('mmd-stepping');
    bar.dataset.active = 'true';
    show(0);
    setPlaying(true);
    play.focus();
  };

  bar.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
    switch (action) {
      case 'start':
        return activate();
      case 'play':
        if (current >= ensureSteps().length - 1) show(0);
        return setPlaying(true);
      case 'pause':
        return setPlaying(false);
      case 'prev':
        setPlaying(false);
        return show(current - 1);
      case 'next':
        setPlaying(false);
        return show(current + 1);
      case 'restart':
        setPlaying(false);
        return show(-1);
    }
  });

  bar.addEventListener('keydown', (event) => {
    if (bar.dataset.active !== 'true') return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaying(false);
      show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
}
