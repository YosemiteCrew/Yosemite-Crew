import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import YosemiteLoader from '@/app/ui/overlays/Loader/YosemiteLoader';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, unoptimized, ...props }: any) => <div role="img" aria-label={alt} {...props} />,
}));

describe('YosemiteLoader', () => {
  it('renders default inline variant with default size', () => {
    render(<YosemiteLoader testId="loader" />);

    const loader = screen.getByTestId('loader');
    expect(loader.className).toContain('yosemite-loader--inline');

    const image = screen.getByRole('img', { name: 'Loading' });
    expect(image).toHaveAttribute('width', '80');
    expect(image).toHaveAttribute('height', '80');
  });

  it('renders fullscreen translucent variant and label', () => {
    render(
      <YosemiteLoader
        variant="fullscreen-translucent"
        label="Please wait"
        size={120}
        testId="loader"
      />
    );

    const loader = screen.getByTestId('loader');
    expect(loader.className).toContain('yosemite-loader--fullscreen-translucent');
    expect(screen.getByText('Please wait')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Loading' })).toHaveAttribute('width', '120');
  });
});
