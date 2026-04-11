import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '@/app/embed/merck-manuals/page';

jest.mock('@/app/features/integrations/pages/MerckManuals', () => ({
  EmbeddedMerckManuals: () => (
    <div data-testid="embedded-merck-manuals-mock">Embedded MSD Veterinary Manual</div>
  ),
}));

describe('MSD Veterinary Manual Embed Route', () => {
  it('renders embedded MSD Veterinary Manual page', () => {
    render(<Page />);
    expect(screen.getByTestId('embedded-merck-manuals-mock')).toBeInTheDocument();
  });
});
