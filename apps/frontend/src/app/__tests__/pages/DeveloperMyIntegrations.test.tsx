import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import DeveloperMyIntegrations from '@/app/features/developers/pages/DeveloperMyIntegrations/DeveloperMyIntegrations';

expect.extend(toHaveNoViolations);
jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));
jest.mock('@/app/ui/icons/Icon', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

describe('DeveloperMyIntegrations', () => {
  test('shows the complete builder path and truthful empty state', () => {
    render(<DeveloperMyIntegrations />);
    expect(screen.getByRole('heading', { level: 1, name: 'My integrations' })).toBeInTheDocument();
    expect(screen.getByText('Shape the idea')).toBeInTheDocument();
    expect(screen.getByText('Install at a practice')).toBeInTheDocument();
    expect(screen.getByText('No integration drafts yet')).toBeInTheDocument();
  });

  test('opens and closes the draft dialog', () => {
    render(<DeveloperMyIntegrations />);
    fireEvent.click(screen.getByRole('button', { name: 'New integration' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Lab bridge' },
    });
    expect(screen.getByLabelText('Integration name')).toHaveValue('Lab bridge');
    expect(screen.getByRole('link', { name: 'Open API playground' })).toHaveAttribute(
      'href',
      '/developers/playground'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('opens the draft from the empty state and cancels it', () => {
    render(<DeveloperMyIntegrations />);
    fireEvent.click(screen.getByRole('button', { name: 'Start a draft' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('has no accessibility violations', async () => {
    const { container } = render(<DeveloperMyIntegrations />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
