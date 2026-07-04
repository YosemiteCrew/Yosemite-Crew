import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const isEnabled = jest.fn();
const startGithubSignIn = jest.fn();
const redirectToUrl = jest.fn();
jest.mock('@/app/features/auth/lib/githubOAuth', () => ({
  isGithubSignInEnabled: () => isEnabled(),
  startGithubSignIn: (redirectTo: string) => startGithubSignIn(redirectTo),
  redirectToUrl: (url: string) => redirectToUrl(url),
}));

import { GithubSignInButton } from '@/app/features/auth/pages/GithubSignInButton';

describe('GithubSignInButton', () => {
  beforeEach(() => {
    isEnabled.mockReset();
    startGithubSignIn.mockReset();
    redirectToUrl.mockReset();
  });

  it('renders nothing until GitHub sign-in is configured', () => {
    isEnabled.mockReturnValue(false);
    const { container } = render(<GithubSignInButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the button and optional note when enabled', () => {
    isEnabled.mockReturnValue(true);
    render(<GithubSignInButton note="Developer accounts only." />);
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.getByText('Developer accounts only.')).toBeInTheDocument();
  });

  it('redirects to the authorize URL on click', async () => {
    isEnabled.mockReturnValue(true);
    startGithubSignIn.mockResolvedValue('https://cognito.example/oauth2/authorize?x=1');
    render(<GithubSignInButton redirectTo="/developers/home" />);
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));
    await waitFor(() =>
      expect(redirectToUrl).toHaveBeenCalledWith('https://cognito.example/oauth2/authorize?x=1')
    );
    expect(startGithubSignIn).toHaveBeenCalledWith('/developers/home');
  });

  it('re-enables the button when no authorize URL is produced', async () => {
    isEnabled.mockReturnValue(true);
    startGithubSignIn.mockResolvedValue(null);
    render(<GithubSignInButton />);
    const button = screen.getByRole('button', { name: /continue with github/i });
    fireEvent.click(button);
    await waitFor(() => expect(startGithubSignIn).toHaveBeenCalled());
    expect(button).not.toBeDisabled();
    expect(redirectToUrl).not.toHaveBeenCalled();
  });
});
