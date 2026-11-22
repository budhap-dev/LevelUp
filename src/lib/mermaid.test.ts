// Simulate the Mermaid chunk failing to load, as it does offline before it has been cached.
vi.mock('mermaid', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

const { renderDiagram } = await import('./mermaid');

describe('renderDiagram when Mermaid cannot load', () => {
  it('shows the diagram source with an explanation instead of failing silently', async () => {
    const container = document.createElement('div');
    container.textContent = 'flowchart LR\n  A --> B';
    await renderDiagram(container, 'light', false);
    expect(container.dataset.state).toBe('error');
    expect(container.textContent).toContain('needs a connection');
    expect(container.textContent).toContain('A --> B');
    expect(container.dataset.renderedTheme).toBeUndefined();
  });
});

export {};
