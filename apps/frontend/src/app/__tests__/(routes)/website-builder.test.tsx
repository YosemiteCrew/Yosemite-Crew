import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Page from '@/app/(routes)/(app)/website-builder/page';

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

jest.mock('@/app/features/websiteBuilder/pages/WebsiteBuilder/WebsiteBuilder', () => ({
  __esModule: true,
  default: () => <div data-testid="website-builder" />,
}));

describe('website-builder route', () => {
  it('renders the website builder behind the auth and org guards', () => {
    render(<Page />);

    const protectedRoute = screen.getByTestId('protected-route');
    const orgGuard = screen.getByTestId('org-guard');
    const wizard = screen.getByTestId('website-builder');

    expect(protectedRoute).toContainElement(orgGuard);
    expect(orgGuard).toContainElement(wizard);
  });
});
