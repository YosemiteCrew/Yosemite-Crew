import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';

jest.mock('next/image', () => {
  // Forwards `onError` so the dead-photo path is reachable from the test.
  const MockImage = ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    <img src={src} alt={alt} onError={onError} />
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

  it('falls back to a safe person image for unsupported image URLs', () => {
    render(<AppointmentAvatar name="John Doe" photoUrl="blob:https://example.com/photo.jpg" />);
    expect(screen.getByAltText('John Doe')).not.toHaveAttribute(
      'src',
      'blob:https://example.com/photo.jpg'
    );
  });

  // Design rule: the initials fallback is mandatory, never an empty circle. A
  // photo whose URL stopped resolving must degrade to the initials disc.
  it('falls back to the initials when the photo fails to load', () => {
    render(<AppointmentAvatar name="John Doe" photoUrl="https://example.com/gone.jpg" />);
    expect(screen.queryByText('JD')).not.toBeInTheDocument();

    fireEvent.error(screen.getByAltText('John Doe'));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
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
