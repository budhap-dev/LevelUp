import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';
import { paths } from '@/lib/content';
import { pathProgress } from '@/lib/paths';
import { PROGRESS_STORAGE_KEY } from '@/lib/progress/local-storage-store';
import { emptyProgress, type TopicProgress } from '@/lib/progress/types';

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
const learned = (): TopicProgress => ({ state: 'learned', updatedAt: '2026-11-01T00:00:00.000Z' });

function seedLearned(...ids: string[]) {
  const data = emptyProgress();
  for (const id of ids) data.topics[id] = learned();
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
}

beforeEach(() => localStorage.clear());

const staff = paths.find((p) => p.id === 'senior-to-staff')!;

describe('pathProgress', () => {
  it('counts only required steps and picks the first unlearned required step as next', () => {
    const pp = pathProgress(staff, { 'system-design': learned(), 'llms-rag-agents': learned() });
    expect(pp.required).toBe(13);
    expect(pp.learned).toBe(1); // the optional LLM step doesn't count
    expect(pp.next?.meta.id).toBe('architecture-patterns');
  });

  it('reports a path complete once every required step is learned', () => {
    const all = Object.fromEntries(staff.steps.filter((s) => !s.optional).map((s) => [s.topicId, learned()]));
    const pp = pathProgress(staff, all);
    expect(pp.learned).toBe(pp.required);
    expect(pp.next?.meta.id).toBe('llms-rag-agents'); // only the optional step is left
  });
});

describe('learning paths UI', () => {
  it('lists every path with its progress', async () => {
    seedLearned('system-design');
    renderAt('/paths');
    expect(await screen.findByRole('heading', { level: 1, name: 'Learning paths' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getAllByRole('heading', { level: 2 })).toHaveLength(paths.length);
    expect(screen.getByRole('progressbar', { name: `${staff.title}: steps learned` })).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows a path’s ordered steps and links to the next one', async () => {
    seedLearned('system-design');
    renderAt('/paths/senior-to-staff');
    expect(await screen.findByRole('heading', { level: 1, name: staff.title })).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(steps).toHaveLength(staff.steps.length);
    expect(screen.getByRole('link', { name: 'Continue with Architecture Patterns' })).toHaveAttribute('href', '/topics/architecture-patterns');
    expect(within(steps[1]!).getByRole('link')).toHaveAttribute('aria-current', 'step');
    expect(within(steps.at(-1)!).getByText('Optional')).toBeInTheDocument();
  });

  it('returns not found for an unknown path', async () => {
    renderAt('/paths/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shows path progress on the dashboard', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Learning paths' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(staff.title) })).toHaveAttribute('href', '/paths/senior-to-staff');
  });
});
