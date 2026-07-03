import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Page from '@/app/(routes)/(public)/verify-email/page';

jest.mock('@/app/features/auth/pages/VerifyEmail/VerifyEmail', () => ({
  __esModule: true,
  default: () => <div data-testid="verify-email-mock">VerifyEmail Mock</div>,
}));

describe('Verify Email route page', () => {
  it('renders the VerifyEmail landing component', () => {
    render(<Page />);
    expect(screen.getByTestId('verify-email-mock')).toBeInTheDocument();
  });
});
