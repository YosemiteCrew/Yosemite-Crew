import { render, screen, fireEvent } from '@testing-library/react';
import { ChatAvatar, accentFor, initialsOf } from '@/app/features/chat/components/ChatAvatar';

describe('ChatAvatar helpers', () => {
  describe('initialsOf', () => {
    it('derives up to two uppercase initials from a name', () => {
      expect(initialsOf('bella rose')).toBe('BR');
    });

    it('caps initials at two parts', () => {
      expect(initialsOf('one two three four')).toBe('OT');
    });

    it('ignores a parenthetical suffix such as (owner)', () => {
      expect(initialsOf('Sam Smith (owner)')).toBe('SS');
    });

    it('falls back to "?" when no usable letters remain', () => {
      expect(initialsOf('   ')).toBe('?');
    });

    it('handles a single-word name', () => {
      expect(initialsOf('Madonna')).toBe('M');
    });
  });

  describe('accentFor', () => {
    it('is deterministic for the same seed', () => {
      expect(accentFor('Bella')).toBe(accentFor('Bella'));
    });

    it('returns a class string from the accent palette', () => {
      expect(typeof accentFor('Charlie')).toBe('string');
      expect(accentFor('Charlie').length).toBeGreaterThan(0);
    });
  });
});

describe('ChatAvatar', () => {
  it('renders initials derived from the name by default (md size)', () => {
    const { container } = render(<ChatAvatar name="Bella Rose" />);
    expect(screen.getByText('BR')).toBeInTheDocument();
    // md size class present.
    expect(container.querySelector('.h-11.w-11')).toBeInTheDocument();
  });

  it('renders the online presence dot when online is true', () => {
    const { container } = render(<ChatAvatar name="Bella" online />);
    expect(container.querySelector('.bg-success-bright')).toBeInTheDocument();
  });

  it('does not render the presence dot when online is falsy', () => {
    const { container } = render(<ChatAvatar name="Bella" />);
    expect(container.querySelector('.bg-success-bright')).not.toBeInTheDocument();
  });

  it('renders the group glyph instead of initials when group is true', () => {
    const { container } = render(<ChatAvatar name="Care Team" group />);
    // No initials text rendered.
    expect(screen.queryByText('CT')).not.toBeInTheDocument();
    // Group styling applied; an svg icon is rendered.
    expect(container.querySelector('.bg-chat-panel.text-primary-600')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies the sm size classes', () => {
    const { container } = render(<ChatAvatar name="Sam" size="sm" />);
    expect(container.querySelector('.h-9.w-9')).toBeInTheDocument();
  });

  it('applies the lg size classes', () => {
    const { container } = render(<ChatAvatar name="Sam" size="lg" />);
    expect(container.querySelector('.h-12.w-12')).toBeInTheDocument();
  });

  it('applies an accent class from the palette for non-group avatars', () => {
    const { container } = render(<ChatAvatar name="Daisy" />);
    // The inner badge carries the deterministic accent class.
    expect(container.querySelector(`.${accentFor('Daisy').split(' ')[0]}`)).toBeInTheDocument();
  });

  it('hashes different names to (potentially) different accents and renders both', () => {
    const { container: a } = render(<ChatAvatar name="aaaa" />);
    const { container: b } = render(<ChatAvatar name="zzzz" />);
    expect(a.querySelector('span')).toBeInTheDocument();
    expect(b.querySelector('span')).toBeInTheDocument();
  });

  it('forwards an extra className onto the outer wrapper', () => {
    const { container } = render(<ChatAvatar name="Sam" className="custom-cls" />);
    expect(container.querySelector('.custom-cls')).toBeInTheDocument();
  });

  it('is interactive-free but mounts cleanly (sanity render)', () => {
    const { container } = render(<ChatAvatar name="Bella" />);
    // fireEvent on a static node should not throw.
    fireEvent.mouseOver(container.firstChild as Element);
    expect(container.firstChild).toBeInTheDocument();
  });
});
