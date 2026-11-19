import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './router';

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('app routes', () => {
  it('shows every group on the dashboard', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const groups = screen.getByRole('heading', { name: 'Topic groups' }).nextElementSibling as HTMLElement;
    expect(within(groups).getAllByRole('listitem')).toHaveLength(10);
  });

  it('renders a sample topic with its sections and questions', async () => {
    renderAt('/topics/caching');
    expect(await screen.findByRole('heading', { level: 1, name: 'Caching' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'TL;DR' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Interview Questions' })).toBeInTheDocument();
    expect(screen.getByText('What is a cache stampede and how do you prevent it?')).toBeInTheDocument();
    expect(screen.getByText(/unverified claim/)).toBeInTheDocument();
  });

  it('shows a placeholder for stub topics', async () => {
    renderAt('/topics/javascript');
    expect(await screen.findByRole('heading', { name: 'No content yet' })).toBeInTheDocument();
  });

  it('returns not found for unknown topics', async () => {
    renderAt('/topics/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });

  it('filters the catalogue by group', async () => {
    renderAt('/topics?group=data');
    expect(await screen.findByRole('heading', { level: 1, name: 'Data' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });
});
