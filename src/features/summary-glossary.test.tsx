import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { glossaryCount, groups, topics } from '@/lib/content';

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('content summary', () => {
  it('shows overall completion and every module', async () => {
    renderAt('/summary');
    await screen.findByRole('heading', { level: 1, name: 'Content summary' });
    const complete = topics.filter((t) => t.status === 'complete').length;
    expect(screen.getByText(`${complete} of ${topics.length} topics`)).toBeInTheDocument();
    for (const g of groups) expect(screen.getByRole('heading', { level: 3, name: g.title })).toBeInTheDocument();
  });

  it('expands a module to list its topics with links', async () => {
    const user = userEvent.setup();
    renderAt('/summary');
    const heading = await screen.findByRole('heading', { level: 3, name: 'Data' });
    const toggle = heading.closest('button')!;
    if (toggle.getAttribute('aria-expanded') === 'false') await user.click(toggle);
    const section = toggle.closest('section')!;
    expect(within(section).getByRole('link', { name: 'Caching' })).toHaveAttribute('href', '/topics/caching');
  });

  it('is linked from the sidebar', async () => {
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Content summary' })).toHaveAttribute('href', '/summary');
    expect(within(nav).getByRole('link', { name: 'Glossary' })).toHaveAttribute('href', '/glossary');
  });
});

describe('glossary', () => {
  it('lists terms with definitions, details, use cases and topic links', async () => {
    renderAt('/glossary');
    const entry = (await screen.findByRole('heading', { level: 3, name: 'Idempotency' })).closest('article')!;
    expect(within(entry).getByText('Key details')).toBeInTheDocument();
    expect(within(entry).getByText('Use cases')).toBeInTheDocument();
    expect(within(entry).getByRole('link', { name: 'REST, GraphQL & gRPC' })).toHaveAttribute('href', '/topics/api-styles');
    expect(glossaryCount).toBeGreaterThan(100);
  });

  it('filters terms as you type', async () => {
    const user = userEvent.setup();
    renderAt('/glossary');
    await screen.findByRole('heading', { level: 3, name: 'Idempotency' });
    await user.type(screen.getByRole('searchbox', { name: 'Filter terms' }), 'stampede');
    expect(screen.getByRole('heading', { level: 3, name: 'Cache Stampede' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Idempotency' })).not.toBeInTheDocument();
  });
});
