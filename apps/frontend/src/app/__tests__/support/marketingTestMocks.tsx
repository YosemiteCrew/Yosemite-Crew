import React from 'react';

// Shared jest mocks for the marketing/auth/legal component tests. Reference them
// from a `jest.mock` factory via `require` (factories run before imports):
//
//   jest.mock('next/image', () => ({
//     __esModule: true,
//     default: require('@/app/__tests__/support/marketingTestMocks').NextImageMock,
//   }));

const NEXT_IMAGE_ONLY_PROPS = [
  'fill',
  'priority',
  'sizes',
  'quality',
  'placeholder',
  'blurDataURL',
  'loader',
  'unoptimized',
];

/** A plain <img> that drops next/image-only props so they don't hit the DOM. */
export const NextImageMock = ({ alt, ...props }: Record<string, unknown>) => {
  const rest: Record<string, unknown> = { ...props };
  NEXT_IMAGE_ONLY_PROPS.forEach((key) => delete rest[key]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={typeof alt === 'string' ? alt : ''} {...rest} />;
};

/** A plain <a> that renders next/link children with a string href. */
export const NextLinkMock = ({ href, children, ...rest }: Record<string, unknown>) => (
  <a href={typeof href === 'string' ? href : '#'} {...rest}>
    {children as React.ReactNode}
  </a>
);
