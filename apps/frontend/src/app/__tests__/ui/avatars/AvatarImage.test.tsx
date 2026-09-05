import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AvatarImage from '@/app/ui/avatars/AvatarImage';

// There is no repo-wide next/image mock, and the real component in jsdom never
// fires `error` (jsdom does not fetch images). A plain <img> that forwards its
// props keeps `onError` reachable, which is the behaviour under test here.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className, style, onError }: any) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onError={onError}
    />
  ),
}));

const fallback = <span data-testid="monogram">B</span>;

describe('AvatarImage', () => {
  it('renders the photo with the requested intrinsic size, classes and style', () => {
    render(
      <AvatarImage
        src="https://cdn.example.com/bella.png"
        alt="Bella"
        size={40}
        className="rounded-full"
        style={{ width: 40, height: 40 }}
        fallback={fallback}
      />
    );

    const img = screen.getByRole('img', { name: 'Bella' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/bella.png');
    expect(img).toHaveAttribute('width', '40');
    expect(img).toHaveAttribute('height', '40');
    expect(img).toHaveClass('rounded-full');
    expect(img).toHaveStyle({ width: '40px', height: '40px' });
    expect(screen.queryByTestId('monogram')).not.toBeInTheDocument();
  });

  it('swaps to the fallback once the photo fails to load', () => {
    render(
      <AvatarImage
        src="https://cdn.example.com/dead.png"
        alt="Bella"
        size={40}
        fallback={fallback}
      />
    );

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByTestId('monogram')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('trims the src before handing it to next/image', () => {
    render(
      <AvatarImage
        src="  https://cdn.example.com/bella.png  "
        alt="Bella"
        size={40}
        fallback={fallback}
      />
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/bella.png');
  });

  it.each([
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['the literal "undefined"', 'undefined'],
    ['the literal "null"', 'null'],
    ['a path ending in /undefined', 'https://cdn.example.com/photos/undefined'],
    ['a path ending in /null with a query', 'https://cdn.example.com/photos/null?v=2'],
  ])('renders the fallback straight away for %s', (_label, src) => {
    render(<AvatarImage src={src} alt="Bella" size={40} fallback={fallback} />);

    expect(screen.getByTestId('monogram')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('renders the fallback straight away when src is %s', (_label, src) => {
    render(<AvatarImage src={src} alt="Bella" size={40} fallback={fallback} />);

    expect(screen.getByTestId('monogram')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('gives a replacement photo its own attempt after the previous one failed', () => {
    const { rerender } = render(
      <AvatarImage
        src="https://cdn.example.com/dead.png"
        alt="Bella"
        size={40}
        fallback={fallback}
      />
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByTestId('monogram')).toBeInTheDocument();

    rerender(
      <AvatarImage
        src="https://cdn.example.com/new.png"
        alt="Bella"
        size={40}
        fallback={fallback}
      />
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/new.png');
    expect(screen.queryByTestId('monogram')).not.toBeInTheDocument();
  });

  it('stays on the fallback while the same dead URL is re-rendered', () => {
    const { rerender } = render(
      <AvatarImage
        src="https://cdn.example.com/dead.png"
        alt="Bella"
        size={40}
        fallback={fallback}
      />
    );
    fireEvent.error(screen.getByRole('img'));

    rerender(
      <AvatarImage
        src="https://cdn.example.com/dead.png"
        alt="Bella"
        size={48}
        fallback={fallback}
      />
    );

    expect(screen.getByTestId('monogram')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
