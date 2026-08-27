import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

import NotADeveloperState from '@/app/ui/layout/guards/DevRouteGuard/NotADeveloperState';

describe('NotADeveloperState', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names the account type as the problem rather than the credentials', () => {
    render(<NotADeveloperState onSignOut={jest.fn()} />);

    expect(screen.getByText(/isn't a developer account/i)).toBeInTheDocument();
    // The distinction that matters: they ARE signed in.
    expect(screen.getByText(/You're signed in/i)).toBeInTheDocument();
  });

  it('signs out before sending the user to sign up', () => {
    const onSignOut = jest.fn();
    render(<NotADeveloperState onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole('button', { name: /create a developer account/i }));

    /* Order matters: the sign-up form opening on top of a live session for a
       different account type is how you end up with two identities in play. */
    expect(onSignOut).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/developers/signup');
  });

  it('leaves the session alone when the user just goes back', () => {
    const onSignOut = jest.fn();
    render(<NotADeveloperState onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole('button', { name: /back to yosemite crew/i }));

    expect(onSignOut).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
