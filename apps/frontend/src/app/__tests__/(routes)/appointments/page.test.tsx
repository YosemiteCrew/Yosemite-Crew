import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/appointments/page';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const MockDynamicComponent = () =>
      source.includes('features/appointments/pages/Appointments') ? (
        <div data-testid="protected-appointments-mock">Protected Component</div>
      ) : (
        <div data-testid="unexpected-dynamic-mock" />
      );
    MockDynamicComponent.displayName = 'MockDynamicComponent';
    return MockDynamicComponent;
  },
}));

jest.mock('@/app/features/appointments/pages/Appointments', () => {
  return function MockProtectedAppointments() {
    return <div data-testid="protected-appointments-mock">Protected Component</div>;
  };
});

describe('Appointments Page', () => {
  it('renders the ProtectedAppointments component correctly', () => {
    render(<Page />);

    const childComponent = screen.getByTestId('protected-appointments-mock');
    expect(childComponent).toBeInTheDocument();
  });
});
