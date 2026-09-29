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
    expect(
      screen.getByRole('heading', { level: 2, name: 'Intake and continuing care' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Pre-visit history' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Preventive-care outreach' })
    ).toBeInTheDocument();
    expect(screen.getByText('03.1')).toBeInTheDocument();
    expect(screen.getByText('03.6')).toBeInTheDocument();
    expect(screen.getByText('No integration drafts yet')).toBeInTheDocument();
  });

  test('starts a named draft from an intake workflow', () => {
    render(<DeveloperMyIntegrations />);

    fireEvent.click(screen.getByRole('button', { name: 'Start with Pre-visit history' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Integration name')).toHaveValue('Pre-visit history');
    expect(screen.getByText(/Starting from/)).toHaveTextContent(
      'Starting from 03.1 · A timestamped response for staff to review.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'New integration' }));
    expect(screen.getByLabelText('Integration name')).toHaveValue('');
    expect(screen.queryByText(/Starting from/)).not.toBeInTheDocument();
  });

  test('opens and closes the draft dialog', () => {
    render(<DeveloperMyIntegrations />);
    const opener = screen.getByRole('button', { name: 'New integration' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const playgroundButton = screen.getByRole('button', { name: 'Open API playground' });
    expect(playgroundButton).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Open API playground' })).not.toBeInTheDocument();
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
    expect(opener).toHaveFocus();
    fireEvent.click(opener);
    expect(screen.getByLabelText('Integration name')).toHaveValue('');
  });

  test('keeps keyboard focus in the draft dialog and closes it with Escape', () => {
    render(<DeveloperMyIntegrations />);
    const opener = screen.getByRole('button', { name: 'New integration' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog');
    const firstFocusable = screen.getByRole('button', { name: 'Close' });
    const lastFocusable = screen.getByRole('button', { name: 'Cancel' });
    expect(firstFocusable).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastFocusable).toHaveFocus();

    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Lab bridge' },
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(dialog).not.toBeVisible();
    fireEvent.click(opener);
    expect(screen.getByLabelText('Integration name')).toHaveValue('');
  });

  test('opens the draft from the empty state and cancels it', () => {
    render(<DeveloperMyIntegrations />);
    fireEvent.click(screen.getByRole('button', { name: 'Start a draft' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Lab bridge' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New integration' }));
    expect(screen.getByLabelText('Integration name')).toHaveValue('');
  });

  test('clears a draft dismissed from the backdrop', () => {
    render(<DeveloperMyIntegrations />);
    fireEvent.click(screen.getByRole('button', { name: 'New integration' }));
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Lab bridge' },
    });

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New integration' }));
    expect(screen.getByLabelText('Integration name')).toHaveValue('');
  });

  test('has no accessibility violations', async () => {
    const { container } = render(<DeveloperMyIntegrations />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
