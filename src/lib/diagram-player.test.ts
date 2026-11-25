import { describe, expect, it } from 'vitest';
import { attachPlayer, parseNarration, stepKind } from './diagram-player';

const svgOf = (type: string, inner: string) => {
  const container = document.createElement('div');
  container.innerHTML = `<svg aria-roledescription="${type}">${inner}</svg>`;
  return container;
};
const edges = (n: number) => Array.from({ length: n }, (_, i) => `<path data-edge="true" data-id="e${i}"></path>`).join('');

describe('parseNarration', () => {
  it('collects `%% step:` comments in order and ignores other comments', () => {
    const source = 'flowchart LR\n  %% step: Client calls the API\n  A --> B\n  %% a plain comment\n  %%step:  API reads the cache  \n  B --> C';
    expect(parseNarration(source)).toEqual(['Client calls the API', 'API reads the cache']);
  });
});

describe('stepKind', () => {
  it('steps flowcharts and state diagrams by edge, sequence diagrams by message, and nothing else', () => {
    expect(stepKind(svgOf('flowchart-v2', '').firstElementChild!)).toBe('edges');
    expect(stepKind(svgOf('stateDiagram', '').firstElementChild!)).toBe('edges');
    expect(stepKind(svgOf('sequence', '').firstElementChild!)).toBe('sequence');
    expect(stepKind(svgOf('quadrantChart', '').firstElementChild!)).toBeNull();
  });
});

describe('attachPlayer', () => {
  it('adds step-through controls to a diagram with at least three steps', () => {
    const container = svgOf('flowchart-v2', edges(3));
    attachPlayer(container, 'flowchart LR');
    expect(container.querySelector('.mmd-player')).not.toBeNull();
    expect(container.querySelector('.mmd-start')?.textContent).toBe('Step through');
    expect(container.querySelector('[aria-label="Next step"]')).not.toBeNull();
  });

  it('leaves small diagrams and unsupported kinds alone', () => {
    const small = svgOf('flowchart-v2', edges(2));
    attachPlayer(small, 'flowchart LR');
    expect(small.querySelector('.mmd-player')).toBeNull();

    const quadrant = svgOf('quadrantChart', edges(5));
    attachPlayer(quadrant, 'quadrantChart');
    expect(quadrant.querySelector('.mmd-player')).toBeNull();
  });
});
