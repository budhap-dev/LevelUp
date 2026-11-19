import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/lib/theme';
import { ThemePicker } from './ThemePicker';

const setup = () =>
  render(
    <ThemeProvider>
      <ThemePicker />
    </ThemeProvider>,
  );

describe('ThemePicker', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  });

  it('applies and remembers the chosen theme, including its light/dark mode', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Choose colour theme' }));
    await user.click(screen.getByRole('radio', { name: 'Forest' }));

    expect(document.documentElement.dataset.theme).toBe('forest');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('levelup:theme')).toBe('forest');
    expect(localStorage.getItem('levelup:theme-mode')).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Sepia' }));
    expect(document.documentElement.dataset.theme).toBe('sepia');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows the system setting by default and forgets the stored choice', async () => {
    localStorage.setItem('levelup:theme', 'ocean');
    const user = userEvent.setup();
    setup();
    expect(document.documentElement.dataset.theme).toBe('ocean');

    await user.click(screen.getByRole('button', { name: 'Choose colour theme' }));
    await user.click(screen.getByRole('radio', { name: 'System' }));
    expect(document.documentElement.dataset.theme).toBe('light'); // jsdom reports no dark preference
    expect(localStorage.getItem('levelup:theme')).toBeNull();
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole('button', { name: 'Choose colour theme' });
    await user.click(button);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Theme' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
