import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/(routes)/(app)/integrations/merck-manuals/page';

jest.mock('@/app/features/integrations/pages/MerckManuals', () => {
  return function MockProtectedMerckManuals() {
    return <div data-testid="protected-merck-manuals-mock">Protected MSD Veterinary Manual</div>;
  };
});

describe('MSD Veterinary Manual App Route', () => {
  it('renders protected MSD Veterinary Manual wrapper', () => {
    render(<Page />);
    expect(screen.getByTestId('protected-merck-manuals-mock')).toBeInTheDocument();
  });
});
