import React from 'react';
import { render } from '@testing-library/react';
import posthog from 'posthog-js';
import PostHogUserSync from '@/app/ui/layout/PostHogUserSync';

const mockUseAuthStore = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    identify: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => mockUseAuthStore(selector),
}));

describe('PostHogUserSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('identifies authenticated users with safe person properties', () => {
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
          family_name: 'Doctor',
          given_name: 'Taylor',
          'custom:role': 'OWNER',
        },
        status: 'authenticated',
      })
    );

    render(<PostHogUserSync />);

    expect(posthog.identify).toHaveBeenCalledWith('user-sub-1', {
      email: 'vet@example.com',
      first_name: 'Taylor',
      last_name: 'Doctor',
      role: 'OWNER',
    });
  });

  it('resets analytics state when the user becomes unauthenticated', () => {
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: null,
        status: 'unauthenticated',
      })
    );

    render(<PostHogUserSync />);

    expect(posthog.reset).not.toHaveBeenCalled();
  });
});
