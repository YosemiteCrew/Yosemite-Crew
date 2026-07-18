import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  NoDataMessage,
  ViewButton,
  RescheduleButton,
  ProfileTitle,
  ProfileSubtitle,
} from '@/app/ui/tables/common';

describe('NoDataMessage (empty-state recipe)', () => {
  it('renders the default title and the default icon chip with no props', () => {
    const { container } = render(<NoDataMessage />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
    // Default icon renders as an inline SVG inside the chip.
    expect(container.querySelector('svg')).toBeInTheDocument();
    // No subtitle / CTA by default.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a custom title and subtitle', () => {
    render(<NoDataMessage title="Nothing here yet" subtitle="Try adjusting your filters" />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('renders a custom icon in place of the default', () => {
    render(<NoDataMessage icon={<span data-testid="custom-icon">icon</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders a button CTA and fires its onClick', () => {
    const onClick = jest.fn();
    render(<NoDataMessage cta={{ label: 'Add item', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a link CTA when href is provided', () => {
    const onClick = jest.fn();
    render(<NoDataMessage cta={{ label: 'Go to dashboard', href: '/dashboard', onClick }} />);
    const link = screen.getByRole('link', { name: 'Go to dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('common table helpers', () => {
  it('ViewButton fires onClick', () => {
    const onClick = jest.fn();
    render(<ViewButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('RescheduleButton fires onClick', () => {
    const onClick = jest.fn();
    render(<RescheduleButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ProfileTitle and ProfileSubtitle render their children', () => {
    render(
      <>
        <ProfileTitle>Poppy</ProfileTitle>
        <ProfileSubtitle>Beagle</ProfileSubtitle>
      </>
    );
    expect(screen.getByText('Poppy')).toBeInTheDocument();
    expect(screen.getByText('Beagle')).toBeInTheDocument();
  });
});
