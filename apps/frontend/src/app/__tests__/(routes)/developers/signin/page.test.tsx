import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/developers/signin/page';
import SignIn from '@/app/features/auth/pages/SignIn/SignIn';

jest.mock('@/app/features/auth/pages/SignIn/SignIn', () => {
  return jest.fn(() => <div data-testid="mock-signin">SignIn Component</div>);
});

describe('Developer SignIn Page', () => {
  beforeEach(() => {
    (SignIn as jest.Mock).mockClear();
  });

  it('renders the SignIn component with the correct developer configuration props', () => {
    render(<Page />);

    expect(screen.getByTestId('mock-signin')).toBeInTheDocument();

    const props = (SignIn as jest.Mock).mock.calls[0][0];
    expect(props.isDeveloper).toBe(true);
    expect(props.signupHref).toBe('/developers/signup');
    expect(props.allowNext).toBe(false);
    // No hardcoded developer redirect: the account-type selector drives the
    // destination, so a business-mode sign-in on this route is not misrouted
    // into the developer area (and ejected by DevRouteGuard).
    expect(props.redirectPath).toBeUndefined();
  });
});
