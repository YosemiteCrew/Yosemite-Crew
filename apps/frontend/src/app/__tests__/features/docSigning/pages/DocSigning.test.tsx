import React from 'react';
import { render, screen } from '@testing-library/react';
import DocSigning from '@/app/features/docSigning/pages/DocSigning';
import { useLoadOrg } from '@/app/hooks/useLoadOrg';

jest.mock('@/app/hooks/useLoadOrg', () => ({ useLoadOrg: jest.fn() }));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="org-guard">{children}</div>
  ),
}));

jest.mock('@/app/features/docSigning/components/DocSigningPortal', () => ({
  __esModule: true,
  default: () => <div data-testid="doc-signing-portal" />,
}));

describe('DocSigning page', () => {
  it('renders the signing portal behind the auth and org guards', () => {
    render(<DocSigning />);

    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByTestId('org-guard')).toBeInTheDocument();
    expect(screen.getByTestId('doc-signing-portal')).toBeInTheDocument();
  });

  it('loads the active organisation on mount', () => {
    render(<DocSigning />);

    expect(useLoadOrg).toHaveBeenCalled();
  });
});
