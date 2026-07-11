import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Page from '@/app/(routes)/(app)/public-booking-setup/page';

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

jest.mock(
  '@/app/features/onboarding/pages/PublicBookingSetup/PublicBookingSetup',
  () => ({
    __esModule: true,
    default: () => <div data-testid="public-booking-setup" />,
  })
);

describe('public-booking-setup route', () => {
  it('renders the setup wizard behind the auth and org guards', () => {
    render(<Page />);

    const protectedRoute = screen.getByTestId('protected-route');
    const orgGuard = screen.getByTestId('org-guard');
    const wizard = screen.getByTestId('public-booking-setup');

    expect(protectedRoute).toContainElement(orgGuard);
    expect(orgGuard).toContainElement(wizard);
  });
});
