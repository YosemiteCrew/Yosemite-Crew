import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StarRipple from '@/app/features/marketing/components/LandingPage/StarRipple';

jest.mock('framer-motion', () => ({
  motion: {
    svg: ({ children, className }: any) => <svg className={className}>{children}</svg>,
  },
}));

describe('StarRipple', () => {
  it('renders ripple container and eight star ripple svgs', () => {
    const { container } = render(<StarRipple />);

    expect(container.querySelector('.star-ripple-container')).toBeInTheDocument();
    expect(container.querySelector('.ripple-glow')).toBeInTheDocument();

    const ripples = container.querySelectorAll('svg.star-ripple');
    expect(ripples).toHaveLength(8);

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].getAttribute('d')).toContain('M ');
  });

  it('creates linear gradients with animateTransform for each ripple', () => {
    const { container } = render(<StarRipple />);

    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients).toHaveLength(8);

    const rotateAnimations = container.querySelectorAll('animateTransform');
    expect(rotateAnimations).toHaveLength(8);
    expect(rotateAnimations[0]).toHaveAttribute('type', 'rotate');
  });
});
