import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';

// A plain <img> that forwards `onError`, so the dead-photo path is reachable.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, onError }: any) => (
    <img data-testid="companion-photo" alt={alt} src={src} onError={onError} />
  ),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn((src: string) => `safe:${src}`),
}));

describe('CompanionAvatar', () => {
  it('renders the real photo when the companion has one', () => {
    render(
      <CompanionAvatar
        photoUrl="https://cdn.example.com/rex.png"
        name="Rex"
        speciesType="Dog"
        size={48}
        alt="Rex"
      />
    );

    const photo = screen.getByTestId('companion-photo');
    expect(photo).toHaveAttribute('src', 'safe:https://cdn.example.com/rex.png');
    expect(photo).toHaveAttribute('alt', 'Rex');
    expect(screen.queryByText('R')).not.toBeInTheDocument();
  });

  // Design rule: the initials fallback is mandatory, never an empty circle. A
  // photo URL that stopped resolving (a deleted S3 object) must degrade to the
  // monogram disc rather than leave a blank circle in the row.
  it('swaps to the monogram when the photo fails to load', () => {
    render(
      <CompanionAvatar photoUrl="https://cdn.example.com/gone.png" name="Rex" size={48} alt="Rex" />
    );
    expect(screen.queryByText('R')).not.toBeInTheDocument();

    fireEvent.error(screen.getByTestId('companion-photo'));

    expect(screen.queryByTestId('companion-photo')).not.toBeInTheDocument();
    // Same disc as the no-photo branch: decorative initials plus the sr-only name.
    expect(screen.getByText('R')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Rex')).toHaveClass('sr-only');
  });

  // Bug 38: a companion with no photo must not be given a stock species picture,
  // which reads as a real photo of that pet.
  it('renders a monogram instead of a default photo when there is no photoUrl', () => {
    render(<CompanionAvatar photoUrl={undefined} name="Axel" speciesType="Dog" size={48} />);

    expect(screen.queryByTestId('companion-photo')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('treats an empty photoUrl as no photo', () => {
    render(<CompanionAvatar photoUrl="" name="Oliver" size={40} />);

    expect(screen.queryByTestId('companion-photo')).not.toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
  });

  it('falls back to "?" when the companion has no name', () => {
    render(<CompanionAvatar photoUrl={null} name={undefined} size={40} />);

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('keeps the monogram palette stable for a given seed', () => {
    const { rerender } = render(<CompanionAvatar name="Axel" seed="companion-1" size={40} />);
    const first = screen.getByText('A').parentElement?.getAttribute('style');
    // Guard against both reads being null, which would pass against nothing.
    expect(first).toEqual(expect.stringContaining('background'));

    rerender(<CompanionAvatar name="Axel" seed="companion-1" size={40} />);
    expect(screen.getByText('A').parentElement?.getAttribute('style')).toBe(first);
  });

  it('names the monogram disc only when an alt is supplied', () => {
    const { rerender } = render(<CompanionAvatar name="Axel" size={40} alt="pet image" />);
    // The initials are decoration; the alt is what a reader announces.
    expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('pet image')).toHaveClass('sr-only');

    rerender(<CompanionAvatar name="Axel" size={40} />);
    expect(screen.queryByText('pet image')).not.toBeInTheDocument();
  });

  it('applies the requested size and text class to the monogram disc', () => {
    render(<CompanionAvatar name="Axel" size={64} textClassName="text-body-1" />);

    const disc = screen.getByText('A').parentElement as HTMLElement;
    expect(disc).toHaveClass('text-body-1');
    expect(disc).toHaveStyle({ width: '64px', height: '64px' });
  });
});
