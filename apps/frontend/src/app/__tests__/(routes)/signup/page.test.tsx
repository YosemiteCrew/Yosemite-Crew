import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/signup/page';

// Mock the child SignUp component to isolate the page logic
jest.mock('@/app/features/auth/pages/SignUp/SignUp', () => {
  return function MockSignUp() {
    return <div data-testid="mock-signup">SignUp Component</div>;
  };
});

describe('Signup Page', () => {
  it('renders the SignUp component', () => {
    render(<Page />);
    expect(screen.getByTestId('mock-signup')).toBeInTheDocument();
  });
});
