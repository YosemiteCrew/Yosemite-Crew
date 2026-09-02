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

jest.mock('@/app/ui/primitives/SectionCard/SectionCard', () => ({
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

  it('renders the card heading and the sealing note', () => {
    render(<DocumentESigning />);

    expect(screen.getByText('How consent documents get signed')).toBeInTheDocument();
    expect(
      screen.getByText(/Signed documents are sealed with a timestamp and signer identity/)
    ).toBeInTheDocument();
  });

  it('offers no channel switches and no Save, because none of it persisted', () => {
    // The three switches were module-local useState literals, so every user of
    // every clinic saw the same invented configuration; Save only raised a
    // success toast claiming the settings applied org-wide, and wrote nothing.
    render(<DocumentESigning />);

    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByText('Changes apply org-wide')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in the pet parent app')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign on clinic tablet')).not.toBeInTheDocument();
    expect(screen.queryByText('Require signature before surgery check-in')).not.toBeInTheDocument();
  });

  it('claims no save happened', () => {
    render(<DocumentESigning />);
    expect(notifyMock).not.toHaveBeenCalled();
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
