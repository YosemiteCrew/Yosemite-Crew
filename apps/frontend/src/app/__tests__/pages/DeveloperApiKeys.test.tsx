import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick} data-testid={`primary-${text}`}>
      {text}
    </button>
  ),
}));

jest.mock('@iconify/react', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

import DeveloperApiKeys from '@/app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys';

describe('DeveloperApiKeys page', () => {
  test('renders the header, preview note and create key control', () => {
    render(<DeveloperApiKeys />);
    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'API keys' })).toBeInTheDocument();
    expect(screen.getByText(/key management API is coming soon/i)).toBeInTheDocument();
    expect(screen.getByTestId('primary-Create key')).toBeInTheDocument();
  });

  test('renders no dead per-row action control while key management is unavailable', () => {
    render(<DeveloperApiKeys />);

    // Key management has no destination yet, so the rows must not ship an
    // affordance for it at all — a disabled ellipsis button is still a dead
    // control. Every button that survives must be live and clickable.
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeEnabled();
    }
  });

  test('renders the sample key rows with environment and status badges', () => {
    render(<DeveloperApiKeys />);
    expect(screen.getByText('Monitor sync · sandbox')).toBeInTheDocument();
    expect(screen.getByText('Booking widget · prod')).toBeInTheDocument();
    expect(screen.getByText('Legacy import script')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getAllByText('Sandbox').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Active').length).toBe(2);
  });

  test('renders the usage footer total', () => {
    render(<DeveloperApiKeys />);
    expect(screen.getByText('Requests · 7 days')).toBeInTheDocument();
    expect(screen.getByText(/27,904/)).toBeInTheDocument();
  });

  test('copies the revealed key to the clipboard', () => {
    const writeText = jest.fn();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<DeveloperApiKeys />);
    fireEvent.click(screen.getByRole('button', { name: /Copy key/i }));
    expect(writeText).toHaveBeenCalledWith('yc_sand_9f2K…D41x_monitor');
  });

  test('dismisses and re-reveals the new key banner', () => {
    render(<DeveloperApiKeys />);
    expect(screen.getByTestId('dev-key-reveal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss new key banner/i }));
    expect(screen.queryByTestId('dev-key-reveal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('primary-Create key'));
    expect(screen.getByTestId('dev-key-reveal')).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    const { container } = render(<DeveloperApiKeys />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
