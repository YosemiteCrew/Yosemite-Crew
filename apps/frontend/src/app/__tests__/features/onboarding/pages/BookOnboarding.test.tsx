import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProtectedBookOnboarding from '@/app/features/onboarding/pages/BookOnboarding';

const routerBackMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: routerBackMock }),
}));

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

jest.mock('@/app/ui/overlays/CalEmbedFrame', () => ({
  __esModule: true,
  default: ({ calLink, title }: { calLink: string; title: string }) => (
    <div data-testid="cal-embed" data-cal-link={calLink}>
      {title}
    </div>
  ),
}));

describe('BookOnboarding page', () => {
  it('renders the booking embed behind the auth and org guards', () => {
    render(<ProtectedBookOnboarding />);

    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByTestId('org-guard')).toBeInTheDocument();
    expect(screen.getByTestId('cal-embed')).toHaveAttribute(
      'data-cal-link',
      'yosemitecrew/onboarding'
    );
    expect(screen.getByTestId('cal-embed')).toHaveTextContent('Book onboarding call');
  });

  it('navigates back when the back button is pressed', () => {
    render(<ProtectedBookOnboarding />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(routerBackMock).toHaveBeenCalledTimes(1);
  });
});
