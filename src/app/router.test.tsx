import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './router';
import { topics } from '@/lib/content';

/** Any topic still without content; once every topic is written there is none and the stub test is skipped. */
const stub = topics.find((t) => t.status === 'stub');

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
    // Every claim in the topic has been verified, so no "unverified claims" badge is shown.
    expect(screen.queryByText(/unverified claim/)).not.toBeInTheDocument();
  });

  it.runIf(stub)('shows a placeholder for stub topics', async () => {
    renderAt(`/topics/${stub!.id}`);
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

  it('opens the mobile menu as a modal drawer and closes it with Escape', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const button = await screen.findByRole('button', { name: 'Open menu' });
    const main = screen.getByRole('main');
    expect(document.getElementById('sidebar')).toHaveAttribute('inert');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAccessibleName('Close menu');
    expect(main).toHaveAttribute('inert');
    expect(document.getElementById('sidebar')).not.toHaveAttribute('inert');
    expect(document.getElementById('sidebar')).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(main).not.toHaveAttribute('inert');
    expect(button).toHaveFocus();
  });
});
