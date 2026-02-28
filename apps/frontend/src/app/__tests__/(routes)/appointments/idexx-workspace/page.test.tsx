import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/appointments/idexx-workspace/page';

jest.mock('@/app/features/integrations/pages/IdexxWorkspace', () => {
  return function MockIdexxWorkspace() {
    return <div data-testid="idexx-workspace-mock">IDEXX Workspace</div>;
  };
});

describe('Appointments IDEXX Workspace route', () => {
  it('renders the protected IDEXX workspace wrapper', () => {
    render(<Page />);
    expect(screen.getByTestId('idexx-workspace-mock')).toBeInTheDocument();
  });
});
