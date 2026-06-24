import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import YosemiteLoader from '@/app/ui/overlays/Loader/YosemiteLoader';

expect.extend(toHaveNoViolations);

describe('YosemiteLoader', () => {
  it('renders default inline variant with default size', () => {
    render(<YosemiteLoader testId="loader" />);

    const loader = screen.getByRole('status', { name: 'Loading' });
    expect(loader.className).toContain('yosemite-loader--inline');

    const spinner = loader.querySelector('.yosemite-loader__spinner');
    expect(spinner).toHaveStyle({ width: '80px', height: '80px' });
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

    const loader = screen.getByRole('status', { name: 'Please wait' });
    expect(loader.className).toContain('yosemite-loader--fullscreen-translucent');
    expect(screen.getByText('Please wait')).toBeInTheDocument();
    expect(loader.querySelector('.yosemite-loader__spinner')).toHaveStyle({ width: '120px' });
  });

  it('renders fullscreen variant', () => {
    render(<YosemiteLoader variant="fullscreen" label="Loading page" testId="loader" />);

    const loader = screen.getByRole('status', { name: 'Loading page' });
    expect(loader.className).toContain('yosemite-loader--fullscreen');
  });

  it('has no axe accessibility violations for inline variant', async () => {
    const { container } = render(<YosemiteLoader testId="loader" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations for fullscreen variant', async () => {
    const { container } = render(
      <YosemiteLoader variant="fullscreen-translucent" label="Loading data" testId="loader" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
