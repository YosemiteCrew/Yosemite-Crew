import React from 'react';
import { render } from '@testing-library/react';
import RedirectTo from '@/app/features/auth/components/RedirectTo';

// jest.setup.ts mocks next/navigation without `redirect`, so it is declared here.
const redirectMock = jest.fn();
jest.mock('next/navigation', () => ({ redirect: (route: string) => redirectMock(route) }));

describe('RedirectTo', () => {
  beforeEach(() => redirectMock.mockReset());

  it('redirects to the given route while rendering', () => {
    const { container } = render(<RedirectTo route="/dashboard" />);
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the query and hash of a same-origin path', () => {
    render(<RedirectTo route="/appointments?view=day#top" />);
    expect(redirectMock).toHaveBeenCalledWith('/appointments?view=day#top');
  });

  it.each([
    'https://evil.example/path',
    '//evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
  ])('sends %s to the home page instead of leaving the app', (route) => {
    render(<RedirectTo route={route} />);
    expect(redirectMock).toHaveBeenCalledWith('/');
  });
});
