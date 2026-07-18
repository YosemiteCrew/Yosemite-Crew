import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DocumentESigning from '@/app/features/organization/pages/Organization/Sections/DocumentESigning';

const notifyMock = jest.fn();

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/AccordionButton', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/features/docSigning/components/DocSigningPortal', () => ({
  __esModule: true,
  default: () => <div data-testid="doc-signing-portal" />,
}));

jest.mock('react-icons/io5', () => ({
  IoShieldCheckmarkOutline: () => <span data-testid="icon-shield" />,
}));

describe('DocumentESigning settings card', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the three e-signing channels with their default states', () => {
    render(<DocumentESigning />);

    expect(screen.getByText('How consent documents get signed')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sign in the pet parent app' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('switch', { name: 'Sign on clinic tablet' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(
      screen.getByRole('switch', { name: 'Require signature before surgery check-in' })
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByText(/Signed documents are sealed with a timestamp and signer identity/)
    ).toBeInTheDocument();
    expect(screen.getByText('Changes apply org-wide')).toBeInTheDocument();
  });

  it('toggles each channel independently', () => {
    render(<DocumentESigning />);

    const appToggle = screen.getByRole('switch', { name: 'Sign in the pet parent app' });
    fireEvent.click(appToggle);
    expect(appToggle).toHaveAttribute('aria-checked', 'false');

    const requireToggle = screen.getByRole('switch', {
      name: 'Require signature before surgery check-in',
    });
    fireEvent.click(requireToggle);
    expect(requireToggle).toHaveAttribute('aria-checked', 'true');
  });

  it('notifies on save', () => {
    render(<DocumentESigning />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'E-signing preferences updated' })
    );
  });

  it('discloses and hides the signing portal', () => {
    render(<DocumentESigning />);
    expect(screen.queryByTestId('doc-signing-portal')).not.toBeInTheDocument();

    const disclosure = screen.getByRole('button', { name: 'Manage document signing portal' });
    fireEvent.click(disclosure);
    expect(screen.getByTestId('doc-signing-portal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide document signing portal' }));
    expect(screen.queryByTestId('doc-signing-portal')).not.toBeInTheDocument();
  });
});
