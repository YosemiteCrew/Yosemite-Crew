import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/organization/page';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const MockDynamicComponent = () =>
      source.includes('features/organization/pages/Organization') ? (
        <div data-testid="protected-organization-mock">Organization Profile</div>
      ) : (
        <div data-testid="unexpected-dynamic-mock" />
      );
    MockDynamicComponent.displayName = 'MockDynamicComponent';
    return MockDynamicComponent;
  },
}));

// 1. Mock the child component
// This replaces the actual Organization page logic with a simple dummy element.
jest.mock('@/app/features/organization/pages/Organization', () => {
  return function MockProtectedOrganization() {
    return <div data-testid="protected-organization-mock">Organization Profile</div>;
  };
});

describe('Organization Page', () => {
  it('renders the ProtectedOrganization component correctly', () => {
    // 2. Render the page wrapper
    render(<Page />);

    // 3. Assert that the specific mocked child is present
    const childComponent = screen.getByTestId('protected-organization-mock');
    expect(childComponent).toBeInTheDocument();
  });
});
