import React from 'react';
import { render, screen } from '@testing-library/react';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';

jest.mock('next/image', () => {
  const MockImage = ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  );
  MockImage.displayName = 'Image';
  return MockImage;
});

describe('AppointmentAvatar', () => {
  it('renders an image when photoUrl is provided', () => {
    render(<AppointmentAvatar name="John Doe" photoUrl="https://example.com/photo.jpg" />);
    const img = screen.getByAltText('John Doe');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('renders initials fallback when no photoUrl', () => {
    render(<AppointmentAvatar name="John Doe" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders single initial for single-word name', () => {
    render(<AppointmentAvatar name="Buddy" />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders an empty initials span when name is empty', () => {
    const { container } = render(<AppointmentAvatar name="" />);
    const span = container.querySelector('span');
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe('');
  });

  it('applies custom size', () => {
    render(<AppointmentAvatar name="Alex" size={48} />);
    const container = screen.getByText('A').parentElement;
    expect(container).toHaveStyle({ width: '48px', height: '48px' });
  });
});
