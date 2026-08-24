import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalError from '@/app/error';
import AppLayout from '@/app/(routes)/(app)/layout';
import PublicLayout from '@/app/(routes)/(public)/layout';
import AppointmentsLoading from '@/app/(routes)/(app)/appointments/loading';
import WorkspaceLoading from '@/app/(routes)/(app)/appointments/[appointmentId]/workspace/loading';
import WorkspacePage from '@/app/(routes)/(app)/appointments/[appointmentId]/workspace/page';
import ChatLayout from '@/app/(routes)/(app)/chat/layout';
import DeveloperSettingsLayout from '@/app/(routes)/(app)/developers/settings/layout';
import AccessibilityReportLayout from '@/app/(routes)/(public)/accessibility/report/layout';
import PaymentStatusLayout from '@/app/(routes)/(public)/payment-status/layout';
import SuccessLayout from '@/app/(routes)/(public)/success/layout';
import { connection } from 'next/server';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicWorkspaceRoute = ({ appointmentId }: { appointmentId: string }) => (
      <div data-testid="appointment-workspace">{appointmentId}</div>
    );
    return MockDynamicWorkspaceRoute;
  },
}));

jest.mock('next/server', () => ({
  connection: jest.fn(),
}));

jest.mock('@/app/ui/layout/SessionInitializer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="session-initializer">{children}</section>
  ),
}));

// ThemeScript is an async server component that reads the per-request nonce via
// next/headers; stub it so the app layout tree can render synchronously in RTL.
jest.mock('@/app/ui/theme/ThemeScript', () => ({
  __esModule: true,
  default: () => <script data-testid="theme-script" />,
}));

jest.mock('@/app/ui/layout/Header/Header', () => ({
  __esModule: true,
  default: () => <header data-testid="public-header" />,
}));

jest.mock('@/app/ui/widgets/Github/Github', () => ({
  __esModule: true,
  default: () => <aside data-testid="github-widget" />,
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label, testId }: { label: string; testId: string }) => (
    <div data-testid={testId}>{label}</div>
  ),
}));

describe('route wrappers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (connection as jest.Mock).mockResolvedValue(undefined);
  });

  it('logs global errors and retries from the error boundary UI', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = jest.fn();

    render(<GlobalError error={new Error('boom')} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Unhandled application error:', expect.any(Error));
    expect(reset).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('wraps app pages in the session initializer after opening a dynamic connection', async () => {
    const ui = await AppLayout({ children: <div data-testid="app-child" /> });

    render(ui);

    expect(connection).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('session-initializer')).toContainElement(
      screen.getByTestId('app-child')
    );
  });

  it('renders public route children through the pass-through layout', () => {
    // The public layout is now a pass-through: each page supplies its own chrome
    // (marketing pages use MarketingShell, auth pages AuthShell), so the layout
    // only forwards children plus the shared marketing stylesheet + theme script.
    const { container } = render(
      <PublicLayout>
        <div data-testid="public-child" />
      </PublicLayout>
    );

    expect(screen.getByTestId('public-child')).toBeInTheDocument();

    // Scroll reveals start hidden in marketing.css and only settle once the
    // observer in Reveal flips data-reveal. With scripting off nothing flips it,
    // so this noscript rule is the only thing keeping the marketing and legal
    // copy readable. Asserted here so it cannot be dropped unnoticed.
    const noscript = container.querySelector('noscript');
    expect(noscript).not.toBeNull();
    expect(noscript?.innerHTML).toContain('[data-reveal]');
    expect(noscript?.innerHTML).toContain('opacity:1');
  });

  it('renders route loading states with accessible labels', () => {
    render(
      <>
        <AppointmentsLoading />
        <WorkspaceLoading />
      </>
    );

    expect(screen.getByTestId('appointments-route-loader')).toHaveTextContent(
      'Loading appointments'
    );
    expect(screen.getByTestId('workspace-route-loader')).toHaveTextContent('Loading workspace');
  });

  it('passes the appointment id route param into the workspace page', async () => {
    const ui = await WorkspacePage({ params: Promise.resolve({ appointmentId: 'apt-123' }) });

    render(ui);

    expect(screen.getByTestId('appointment-workspace')).toHaveTextContent('apt-123');
  });

  it('renders passthrough layouts for nested routes', () => {
    const passthroughLayouts = [
      ChatLayout,
      DeveloperSettingsLayout,
      AccessibilityReportLayout,
      PaymentStatusLayout,
      SuccessLayout,
    ];

    for (const Layout of passthroughLayouts) {
      const { unmount } = render(
        <Layout>
          <div data-testid="nested-child" />
        </Layout>
      );
      expect(screen.getByTestId('nested-child')).toBeInTheDocument();
      unmount();
    }
  });
});
