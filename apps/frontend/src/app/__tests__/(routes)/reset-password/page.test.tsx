import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Page from '@/app/(routes)/(public)/reset-password/page';

jest.mock('@/app/features/auth/pages/ResetPassword/ResetPassword', () => ({
  __esModule: true,
  default: () => <div data-testid="reset-password-mock">ResetPassword Mock</div>,
}));

describe('Reset Password route page', () => {
  it('renders the ResetPassword landing component', () => {
    render(<Page />);
    expect(screen.getByTestId('reset-password-mock')).toBeInTheDocument();
  });
});
