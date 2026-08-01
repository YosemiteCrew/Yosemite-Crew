import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/finance/discounts/page';

jest.mock('@/app/features/finance/pages/Discounts', () => {
  return function MockProtectedDiscounts() {
    return <div data-testid="protected-discounts-mock">Discounts</div>;
  };
});

describe('Finance Discounts Page', () => {
  it('renders the ProtectedDiscounts component correctly', () => {
    render(<Page />);

    const childComponent = screen.getByTestId('protected-discounts-mock');
    expect(childComponent).toBeInTheDocument();
  });
});
