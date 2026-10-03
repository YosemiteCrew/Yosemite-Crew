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
import { devRoutes } from '@/app/constants/routes';

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

  // Left out of a configuration, the server falls back to a machine on the
  // reader's own computer, so a pasted configuration with no host in it cannot
  // work however carefully the key is filled in.
  it.each(['npx', 'Claude Desktop', 'VS Code'])(
    'tells the server which host to call on the %s tab',
    async (label) => {
      const previous = process.env.NEXT_PUBLIC_BASE_URL;
      process.env.NEXT_PUBLIC_BASE_URL = 'https://portal.example.test/';
      try {
        const user = userEvent.setup();
        render(<DeveloperMCPPlayground />);

        await typeTheKey(user);
        await selectTab(user, label);

        expect(configPanel()).toHaveTextContent('https://portal.example.test');
        // A trailing slash would make the server resolve the path wrongly, so
        // the address is trimmed on the way out.
        expect(configPanel().textContent).not.toContain('example.test/');
        // Still no key: the address is not a place to put one.
        expect(configPanel().textContent).not.toContain(TYPED_KEY);
        expect(configPanel().textContent).not.toContain('yc_dev_live');
      } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
        else process.env.NEXT_PUBLIC_BASE_URL = previous;
      }
    }
  );

  // Docker carries the host across by name rather than by value, so the command
  // names the variable and the reader's own environment supplies it.
  it('forwards the host variable by name on the Docker tab', async () => {
    const previous = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = 'https://portal.example.test/';
    try {
      const user = userEvent.setup();
      render(<DeveloperMCPPlayground />);

      await typeTheKey(user);
      await selectTab(user, 'Docker');

      expect(configPanel().textContent).toContain('"-e"');
      expect(configPanel().textContent).toContain('"YC_API_BASE_URL"');
      expect(configPanel().textContent).not.toContain('portal.example.test');
      expect(configPanel().textContent).not.toContain(TYPED_KEY);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
      else process.env.NEXT_PUBLIC_BASE_URL = previous;
    }
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

  // The page and the middleware rule both existed while the developer sidebar had
  // no link to it, so nothing in the app could open it. A route that no nav entry
  // points at is unreachable, and only this assertion notices.
  it('is listed in the developer navigation', () => {
    const entry = devRoutes.find((route) => route.href === '/developers/mcp');

    expect(entry).toBeDefined();
    expect(entry?.name).toBe('MCP Playground');
  });

  // The sidebar only offers a developer route the user is allowed to open, so a
  // nav entry that needs a permission has to name it or the page stays hidden
  // from the people who should see it.
  it('does not hide the page behind a permission the nav does not name', () => {
    const entry = devRoutes.find((route) => route.href === '/developers/mcp');

    expect(entry?.requiredAnyPermissions).toBeUndefined();
  });
});
