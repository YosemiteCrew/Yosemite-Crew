import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(
    { href, children, ...rest },
    ref
  ) {
    return (
      <a ref={ref} href={typeof href === 'string' ? href : '#'} {...rest}>
        {children}
      </a>
    );
  });
  return { __esModule: true, default: Link };
});

jest.mock('@/app/features/marketing/site', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    Reveal: ({ children, as = 'div', className, style }: any) =>
      R.createElement(as, { className, style }, children),
    Spotlight: ({ children, style }: any) => R.createElement('div', { style }, children),
    useMagnet: () => R.useRef(null),
  };
});

import { Pricing } from '@/app/features/marketing/pages/Pricing/Pricing';

describe('Pricing (marketing)', () => {
  test('renders the hero and all three plans', () => {
    render(<Pricing />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Host it free\. Or pay as you grow\./i })
    ).toBeInTheDocument();

    // Plan headers
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();

    // Real per-plan features from the prototype
    expect(screen.getByText('IDEXX + MSD Veterinary Manual')).toBeInTheDocument();
    expect(screen.getByText('Billing, invoicing & Stripe payments')).toBeInTheDocument();
    expect(screen.getByText('Team, rooms & departments')).toBeInTheDocument();
    expect(screen.getByText('Scheduler, templates & e-signing')).toBeInTheDocument();

    // Save note in logo blue
    expect(screen.getByText('Save 2 months billing yearly')).toBeInTheDocument();
  });

  test('billing toggle switches the Business price from monthly to yearly', () => {
    render(<Pricing />);

    // Defaults to monthly: €12 per user / month
    expect(screen.getByText('€12')).toBeInTheDocument();
    expect(screen.getByText('per user / month')).toBeInTheDocument();
    expect(screen.queryByText('€10')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));

    // Yearly: €10 per user / month, billed yearly
    expect(screen.getByText('€10')).toBeInTheDocument();
    expect(screen.getByText('per user / month, billed yearly')).toBeInTheDocument();
    expect(screen.queryByText('€12')).not.toBeInTheDocument();

    // Switch back to monthly
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('€12')).toBeInTheDocument();
  });

  test('renders the FAQ questions', () => {
    render(<Pricing />);

    expect(screen.getByText('Do you take a cut of my payments?')).toBeInTheDocument();
    expect(screen.getByText('Is it really free?')).toBeInTheDocument();
  });
});
