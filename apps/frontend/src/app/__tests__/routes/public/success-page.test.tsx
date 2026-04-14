import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SuccessPage from '@/app/(routes)/(public)/success/page';

const getParamMock = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => getParamMock(key),
  }),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text }: { text: string }) => <button type="button">{text}</button>,
}));

describe('success public page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getParamMock.mockReturnValue(null);
    global.fetch = jest.fn() as typeof fetch;
  });

  it('reuses the payment status experience for Stripe success redirects', () => {
    render(<SuccessPage />);

    expect(screen.getByText('Missing payment session')).toBeInTheDocument();
    expect(screen.getByText('Return home')).toBeInTheDocument();
  });
});
