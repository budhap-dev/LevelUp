import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';
import { topics } from '@/lib/content';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('global search', () => {
  it('opens with Ctrl+K, navigates results with the keyboard and deep-links to a question', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });

    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox', { name: /search topics/i });
    expect(input).toHaveFocus();
    // Empty query suggests topics that have content.
    expect(screen.getAllByRole('option').length).toBe(topics.filter((t) => t.status !== 'stub').length);

    await user.type(input, 'cache stampede');
    const options = await screen.findAllByRole('option');
    const question = options.find((o) => o.textContent?.includes('What is a cache stampede'))!;
    expect(question).toBeDefined();

    // Move the active option to the question with the arrow keys, then open it.
    const target = options.indexOf(question);
    for (let i = 0; i < target; i++) await user.keyboard('{ArrowDown}');
    expect(question).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', question.id);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/topics/caching'));
    expect(router.state.location.hash).toBe('#q-cache-stampede');
    const item = await screen.findByText('What is a cache stampede and how do you prevent it?');
    await waitFor(() => expect(item.closest('details')).toHaveAttribute('open'));
  });

  it('selects the best overall match first, whatever its kind', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('combobox', { name: /search topics/i }), 'burn rate');
    const [first] = await screen.findAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(first!.textContent).toMatch(/burn rate/i);
  });

  it('opens from the header button and with "/"', async () => {
    const user = userEvent.setup();
    renderAt('/topics');
    const search = () => screen.getByRole('combobox', { name: /search topics/i });
    await user.click(await screen.findByRole('button', { name: 'Search' }));
    await waitFor(() => expect(search()).toHaveFocus());
    await user.keyboard('{Escape}');
    // A closed <dialog> leaves the accessibility tree.
    await waitFor(() => expect(screen.queryByRole('combobox', { name: /search topics/i })).not.toBeInTheDocument());
    await user.keyboard('/');
    await waitFor(() => expect(search()).toHaveFocus());
  });
});

describe('catalogue filters', () => {
  const rows = () => within(screen.getByRole('main')).getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/topics/'));

  it('filters by level, tag and content, reflecting the URL', async () => {
    const user = userEvent.setup();
    const router = renderAt('/topics');
    await screen.findByRole('heading', { level: 1, name: 'All topics' });
    expect(rows()).toHaveLength(topics.length);

    await user.click(screen.getByRole('radio', { name: 'Architect' }));
    expect(router.state.location.search).toBe('?level=Architect');
    expect(rows()).toHaveLength(topics.filter((t) => t.level === 'Architect').length);

    await user.click(screen.getByRole('switch', { name: 'With content only' }));
    expect(rows()).toHaveLength(topics.filter((t) => t.level === 'Architect' && t.status !== 'stub').length);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rows()).toHaveLength(topics.length);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'kafka');
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining('Messaging & Event Streaming')]);
  });

  it('reads filters from the URL and shows an empty state', async () => {
    renderAt('/topics?group=ai&level=Foundation&content=1');
    expect(await screen.findByText('No topics match these filters.')).toBeInTheDocument();
  });
});

describe('topic navigation', () => {
  it('lists every section in the on-this-page navigation, with the question count', async () => {
    renderAt('/topics/caching');
    await screen.findByRole('heading', { level: 1, name: 'Caching' });
    const [chips] = screen.getAllByRole('navigation', { name: 'On this page' });
    const links = within(chips!).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '#tldr', '#core-concepts', '#how-it-works', '#trade-offs', '#pitfalls', '#scenario', '#interview-questions', '#cheat-sheet', '#further-reading',
    ]);
    expect(screen.getByRole('link', { name: 'Link to Real-world Scenario' })).toHaveAttribute('href', '#scenario');
  });

  it('links tags to the filtered catalogue', async () => {
    renderAt('/topics/caching');
    expect(await screen.findByRole('link', { name: '#redis' })).toHaveAttribute('href', '/topics?tag=redis');
  });
});
