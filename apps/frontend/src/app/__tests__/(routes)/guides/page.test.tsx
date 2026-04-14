import React from 'react';
import { render, screen } from '@testing-library/react';

import Page from '@/app/(routes)/(app)/guides/page';

jest.mock('@/app/features/guides/pages/Guides', () => ({
  __esModule: true,
  default: () => <div data-testid="protected-guides">Guides</div>,
}));

describe('Guides route', () => {
  it('renders protected guides page', () => {
    render(<Page />);
    expect(screen.getByTestId('protected-guides')).toBeInTheDocument();
  });
});
