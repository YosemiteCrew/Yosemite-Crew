import React from 'react';
import { render, screen } from '@testing-library/react';
import GlobalFullscreenLoader from '@/app/ui/layout/GlobalFullscreenLoader';

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({
    testId,
    size,
    variant,
  }: {
    testId?: string;
    size?: number;
    variant?: string;
  }) => <div data-testid={testId} data-size={size} data-variant={variant} />,
}));

describe('GlobalFullscreenLoader', () => {
  it('renders the standardized fullscreen translucent loader', () => {
    render(<GlobalFullscreenLoader testId="global-loader" />);

    const loader = screen.getByTestId('global-loader');
    expect(loader).toHaveAttribute('data-size', '120');
    expect(loader).toHaveAttribute('data-variant', 'fullscreen-translucent');
  });
});
