import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';
import { PROGRESS_STORAGE_KEY } from '@/lib/progress/local-storage-store';
import { loadTopic } from '@/lib/content';
import type { Topic } from '@/lib/content/schema';

// Counts come from the real Caching content, so editing that topic doesn't break these tests.
let caching: Topic;
beforeAll(async () => {
  caching = (await loadTopic('caching'))!;
});
const cachingQuestions = () => caching.questions.length;
const cachingFoundation = () => caching.questions.filter((q) => q.level === 'Foundation').length;

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}
const stored = () => JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? 'null');
const reviews = () => Object.values((stored()?.reviews ?? {}) as Record<string, { kind: string; intervalDays: number; repetitions: number }>);

beforeEach(() => localStorage.clear());

async function chooseOnly(user: ReturnType<typeof userEvent.setup>, topic: string) {
  await user.click(await screen.findByRole('button', { name: 'None' }));
  await user.click(screen.getByRole('checkbox', { name: topic }));
}

describe('interview mode', () => {
  it('runs a session: reveal, rate with keys, re-queue on Again, then summarise', async () => {
    const user = userEvent.setup();
    renderAt('/interview');
    await chooseOnly(user, 'Caching');
    expect(await screen.findByRole('status')).toHaveTextContent(`0 due · ${cachingQuestions()} new · 0 scheduled later`);
    await user.selectOptions(screen.getByRole('combobox'), '5');
    await user.click(screen.getByRole('button', { name: 'Start 5 questions' }));

    expect(screen.getByText('Card 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    await user.keyboard(' '); // reveal
    expect(screen.getByRole('region', { name: 'Model answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Good/ })).toHaveTextContent('1d');
    await user.keyboard('3'); // Good
    await waitFor(() => expect(reviews()).toEqual([expect.objectContaining({ kind: 'question', intervalDays: 1, repetitions: 1 })]));

    // Again puts the card back into this session.
    await user.click(screen.getByRole('button', { name: /Reveal answer/ }));
    await user.click(screen.getByRole('button', { name: /Again/ }));
    expect(screen.getByText('Card 3 of 6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toHaveFocus();
    expect(screen.getByText(/2 reviews/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change topics' }));
    expect(await screen.findByRole('status')).toHaveTextContent(`0 due · ${cachingQuestions() - 2} new · 2 scheduled later`);
  });

  it('filters by level and remembers the setup', async () => {
    const user = userEvent.setup();
    const first = renderAt('/interview');
    await chooseOnly(user, 'Caching');
    await user.click(screen.getByRole('checkbox', { name: 'Senior' }));
    await user.click(screen.getByRole('checkbox', { name: 'Architect' }));
    expect(await screen.findByRole('status')).toHaveTextContent(`0 due · ${cachingFoundation()} new`);
    first.unmount();

    renderAt('/interview');
    expect(await screen.findByRole('checkbox', { name: 'Caching' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Typescript'.replace('script', 'Script') })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Senior' })).not.toBeChecked();
  });

  it('explains when nothing can be started', async () => {
    const user = userEvent.setup();
    renderAt('/interview');
    await user.click(await screen.findByRole('button', { name: 'None' }));
    expect(await screen.findByText('Choose at least one topic and level.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No questions to review' })).toBeDisabled();
  });
});

describe('flashcards', () => {
  it('flips a card and schedules it', async () => {
    const user = userEvent.setup();
    renderAt('/flashcards');
    await chooseOnly(user, 'Caching');
    await user.click(await screen.findByRole('button', { name: /^Start \d+ cards$/ }));

    await user.click(screen.getByRole('button', { name: /Show answer/ }));
    expect(screen.getByRole('region', { name: /^Answer:/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    await waitFor(() => expect(reviews()).toEqual([expect.objectContaining({ kind: 'flashcard', intervalDays: 4 })]));
    expect(screen.getByText(/^Card 2 of/)).toBeInTheDocument();
  });
});

describe('due counts', () => {
  it('shows due reviews in the sidebar and on the dashboard', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const card = (cardId: string, kind: string) => ({ cardId, kind, easiness: 2.5, intervalDays: 1, repetitions: 1, lapses: 0, dueAt: past });
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, topics: {}, bookmarks: {}, notes: {}, reviews: { 'caching#q-x': card('caching#q-x', 'question'), 'caching#fc-y': card('caching#fc-y', 'flashcard') } }),
    );
    renderAt('/');
    const nav = within(document.getElementById('sidebar')!);
    expect(await nav.findByRole('link', { name: 'Interview mode 1 due' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Flashcards 1 due' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 questions due' })).toHaveAttribute('href', '/interview');
  });
});
