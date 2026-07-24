import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnlineBooking from '@/app/features/organization/pages/Organization/Sections/OnlineBooking';

jest.mock('@/app/ui/primitives/SectionCard/SectionCard', () => ({
  __esModule: true,
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('react-icons/io5', () => ({
  IoArrowForward: () => <span data-testid="icon-forward" />,
  IoCalendarOutline: () => <span data-testid="icon-calendar" />,
}));

describe('OnlineBooking section', () => {
  it('describes the booking page and links to the setup route', () => {
    render(<OnlineBooking />);

    expect(screen.getByText('Online booking')).toBeInTheDocument();
    expect(screen.getByText('Set up your public booking page')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Set up/ });
    expect(link).toHaveAttribute('href', '/public-booking-setup');
  });
});
