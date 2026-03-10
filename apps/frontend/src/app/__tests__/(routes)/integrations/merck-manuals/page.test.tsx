import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/integrations/merck-manuals/page';

jest.mock('@/app/features/integrations/pages/MerckManuals', () => {
  return function MockProtectedMerckManuals() {
    return <div data-testid="protected-merck-manuals-mock">Protected Merck Manuals</div>;
  };
});

describe('Merck Manuals App Route', () => {
  it('renders protected Merck Manuals wrapper', () => {
    render(<Page />);
    expect(screen.getByTestId('protected-merck-manuals-mock')).toBeInTheDocument();
  });
});
