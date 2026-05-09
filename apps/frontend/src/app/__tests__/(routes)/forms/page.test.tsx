import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/forms/page';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const MockDynamicComponent = () =>
      source.includes('features/forms/pages/Forms') ? (
        <div data-testid="protected-forms-mock">Forms Page Content</div>
      ) : (
        <div data-testid="unexpected-dynamic-mock" />
      );
    MockDynamicComponent.displayName = 'MockDynamicComponent';
    return MockDynamicComponent;
  },
}));

jest.mock('@/app/features/forms/pages/Forms', () => {
  return function MockProtectedForms() {
    return <div data-testid="protected-forms-mock">Forms Page Content</div>;
  };
});

describe('Forms Page', () => {
  it('renders the ProtectedForms component correctly', () => {
    render(<Page />);

    const childComponent = screen.getByTestId('protected-forms-mock');
    expect(childComponent).toBeInTheDocument();
  });
});
