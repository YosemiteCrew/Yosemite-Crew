import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/integrations/page';

jest.mock('@/app/features/integrations/pages/Integrations', () => {
  return function MockProtectedIntegrations() {
    return <div data-testid="protected-integrations-mock">Protected Integrations</div>;
  };
});

describe('Integrations Page', () => {
  it('renders the ProtectedIntegrations component correctly', () => {
    render(<Page />);

    const childComponent = screen.getByTestId('protected-integrations-mock');
    expect(childComponent).toBeInTheDocument();
  });
});
