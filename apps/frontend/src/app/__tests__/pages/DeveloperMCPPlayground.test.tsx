import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

import DeveloperMCPPlayground from '@/app/features/developers/pages/DeveloperMCPPlayground/DeveloperMCPPlayground';

const TYPED_KEY = 'yc_dev_live_9f3a2b7c1d';
const PLACEHOLDER = 'YOUR_API_KEY';
const TAB_LABELS = ['Claude Desktop', 'VS Code', 'Cursor', 'Docker', 'npx'] as const;

const typeTheKey = async (user: ReturnType<typeof userEvent.setup>) => {
  const field = screen.getByLabelText('API key');
  await user.type(field, TYPED_KEY);
  return field;
};

const configPanel = () => screen.getByRole('tabpanel');

// The copy handler is async, so the click has to be flushed inside act(). The
// text is then read back off the clipboard user-event stubs, which is what the
// page really handed over.
const clickCopyAndRead = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
  });
  return navigator.clipboard.readText();
};

const selectTab = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('tab', { name: new RegExp(name) }));
};

describe('DeveloperMCPPlayground', () => {
  it('keeps the typed key out of the visible configuration', async () => {
    const user = userEvent.setup();
    render(<DeveloperMCPPlayground />);

    await typeTheKey(user);

    expect(configPanel()).toHaveTextContent(PLACEHOLDER);
    expect(configPanel().textContent).not.toContain(TYPED_KEY);
  });

  it('keeps the typed key out of what the copy button puts on the clipboard', async () => {
    const user = userEvent.setup();
    render(<DeveloperMCPPlayground />);

    await typeTheKey(user);
    const copied = await clickCopyAndRead();

    expect(copied).toContain(PLACEHOLDER);
    expect(copied).not.toContain(TYPED_KEY);
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it.each(TAB_LABELS)('copies a %s configuration with no trace of the typed key', async (label) => {
    const user = userEvent.setup();
    render(<DeveloperMCPPlayground />);

    await typeTheKey(user);
    await selectTab(user, label);
    const copied = await clickCopyAndRead();

    expect(copied.length).toBeGreaterThan(0);
    expect(copied).not.toContain(TYPED_KEY);
    expect(copied).not.toContain('yc_dev_live');
    // The whole key, not just the part after the underscore, must be absent.
    expect(copied).not.toContain(TYPED_KEY.slice(0, 11));
  });

  it('tells the user the configuration carries no key', async () => {
    const user = userEvent.setup();
    render(<DeveloperMCPPlayground />);

    await typeTheKey(user);

    expect(screen.getByText(/the key is not in the text above/i)).toBeInTheDocument();
  });

  it('leaves the Docker tab reading the key from the environment', async () => {
    const user = userEvent.setup();
    render(<DeveloperMCPPlayground />);

    await typeTheKey(user);
    await selectTab(user, 'Docker');

    // No placeholder and no env override: the flag forwards the host variable.
    expect(configPanel()).not.toHaveTextContent(PLACEHOLDER);
    expect(configPanel().textContent).toContain('-e');
    expect(configPanel().textContent).toContain('YC_API_KEY');
  });

  it('renders the example questions with real quotation marks', () => {
    render(<DeveloperMCPPlayground />);

    expect(screen.getByText('“What practices can my key access?”')).toBeInTheDocument();

    const guard = screen.getByTestId('dev-guard');
    expect(guard.textContent).not.toContain('&ldquo;');
    expect(guard.textContent).not.toContain('&rdquo;');
    expect(guard.textContent).not.toContain('&apos;');
  });

  it('renders the second and third example questions as quoted text too', () => {
    render(<DeveloperMCPPlayground />);

    expect(
      screen.getByText('“Show me appointments for practice org_abc from last week”')
    ).toBeInTheDocument();
    expect(screen.getByText(`“What's my API usage this month?”`)).toBeInTheDocument();
  });

  it('keeps every example free of raw entities', () => {
    const { container } = render(<DeveloperMCPPlayground />);

    const examples = container.querySelectorAll('.MCPExamples li');
    expect(examples).toHaveLength(3);
    for (const example of Array.from(examples)) {
      expect(example.textContent).not.toMatch(/&[a-z]+;/i);
      expect(example.textContent?.startsWith('“')).toBe(true);
      expect(example.textContent?.endsWith('”')).toBe(true);
    }
  });
});
