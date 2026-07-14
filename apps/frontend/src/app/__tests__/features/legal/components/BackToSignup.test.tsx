import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import BackToSignup from '@/app/features/legal/components/BackToSignup';

const mockBack = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
  useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('react-icons/io5', () => ({
  IoArrowBack: () => <span data-testid="back-icon" />,
}));

describe('BackToSignup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when the legal page was not opened from signup', () => {
    mockGet.mockReturnValue(null);

    render(<BackToSignup />);

    expect(screen.queryByRole('button', { name: /back to sign up/i })).not.toBeInTheDocument();
  });

  it('renders below the public header and navigates back for signup referrals', () => {
    mockGet.mockReturnValue('signup');

    render(<BackToSignup />);

    const backButton = screen.getByRole('button', { name: /back to sign up/i });
    expect(backButton).toHaveClass('top-20', 'lg:top-24');
    expect(screen.getByTestId('back-icon')).toBeInTheDocument();

    fireEvent.click(backButton);

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
