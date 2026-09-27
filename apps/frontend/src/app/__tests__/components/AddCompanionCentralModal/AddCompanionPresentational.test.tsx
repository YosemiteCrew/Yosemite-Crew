import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AlertChipView,
  AlertChipEdit,
  PhotoDropzone,
} from '@/app/features/companions/components/AddCompanionCentralModal/AddCompanionPresentational';
import type { CompanionAlert } from '@/app/features/companions/components/AddCompanion/type';

// ─── AlertChipView / AlertChipEdit — StatusPill geometry parity ────────────────
//
// Both chips must render the same box the design system's `StatusPill` uses
// (10px/700 uppercase, +0.08em tracking, 3px 10px padding, `leading: normal`) so
// an alert badge doesn't visibly mismatch every other status pill in the app.
// `AlertChipView` renders `StatusPill` directly; `AlertChipEdit` keeps its own
// markup for the inline remove button but must match its geometry.

const alert: CompanionAlert = { id: 'a1', label: 'Diabetic', priority: 'high' };

describe('AlertChipView', () => {
  it('renders through the shared StatusPill box', () => {
    render(<AlertChipView alert={alert} />);
    const chip = screen.getByText('Diabetic');
    expect(chip).toHaveClass(
      'yc-status-pill',
      'px-2.5',
      'leading-[normal]',
      'uppercase',
      'tracking-[0.08em]'
    );
  });

  it('colours from the alert priority config', () => {
    render(<AlertChipView alert={alert} />);
    expect(screen.getByText('Diabetic')).toHaveStyle({ backgroundColor: 'var(--danger-bg)' });
  });

  it('falls back to the medium tone for an unrecognised priority', () => {
    render(<AlertChipView alert={{ id: 'a2', label: 'Odd', priority: 'unknown' as never }} />);
    expect(screen.getByText('Odd')).toHaveStyle({ backgroundColor: 'var(--warn-bg)' });
  });
});

describe('AlertChipEdit', () => {
  it('matches StatusPill geometry: 2.5 padding, normal leading, uppercase, +0.08em tracking', () => {
    render(<AlertChipEdit alert={alert} onRemove={jest.fn()} />);
    const chip = screen.getByText('Diabetic').closest('span');
    expect(chip).toHaveClass('px-2.5', 'leading-[normal]', 'uppercase', 'tracking-[0.08em]');
    // Not px-[9px] / leading-[1.4] — the pre-fix geometry that mismatched StatusPill.
    expect(chip).not.toHaveClass('px-[9px]');
    expect(chip).not.toHaveClass('leading-[1.4]');
  });

  it('removes the alert when its close button is clicked', () => {
    const onRemove = jest.fn();
    render(<AlertChipEdit alert={alert} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Diabetic' }));
    expect(onRemove).toHaveBeenCalledWith('a1');
  });
});

// ─── PhotoDropzone — only picture types are read ───────────────────────────────

describe('PhotoDropzone', () => {
  const readAsDataURL = jest.spyOn(FileReader.prototype, 'readAsDataURL');

  afterEach(() => readAsDataURL.mockClear());
  afterAll(() => readAsDataURL.mockRestore());

  const pick = (type: string, name = 'pet') => {
    const onPhotoSelected = jest.fn();
    const onPhotoRejected = jest.fn();
    render(
      <PhotoDropzone
        photoUrl=""
        onPhotoSelected={onPhotoSelected}
        onPhotoRejected={onPhotoRejected}
      />
    );
    const input = screen.getByLabelText('Upload companion photo') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], name, { type })] } });
    return { input, onPhotoSelected, onPhotoRejected };
  };

  it('offers only png, jpeg, gif and webp in the file picker', () => {
    render(<PhotoDropzone photoUrl="" onPhotoSelected={jest.fn()} />);
    expect(screen.getByLabelText('Upload companion photo')).toHaveAttribute(
      'accept',
      'image/png,image/jpeg,image/gif,image/webp'
    );
  });

  it.each([
    ['image/heic', 'pet.heic'],
    ['image/svg+xml', 'pet.svg'],
    ['image/avif', 'pet.avif'],
    ['application/pdf', 'pet.pdf'],
  ])('turns away %s with the message to show, without reading it', (type, name) => {
    const { onPhotoSelected, onPhotoRejected } = pick(type, name);

    expect(onPhotoRejected).toHaveBeenCalledWith('Please choose a PNG, JPG, GIF or WEBP image.');
    expect(readAsDataURL).not.toHaveBeenCalled();
    expect(onPhotoSelected).not.toHaveBeenCalled();
  });

  it('turns a file away quietly when no one listens for it', () => {
    render(<PhotoDropzone photoUrl="" onPhotoSelected={jest.fn()} />);
    const input = screen.getByLabelText('Upload companion photo') as HTMLInputElement;

    expect(() =>
      fireEvent.change(input, {
        target: { files: [new File(['x'], 'pet.heic', { type: 'image/heic' })] },
      })
    ).not.toThrow();
    expect(readAsDataURL).not.toHaveBeenCalled();
  });

  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])('reads a %s', (type) => {
    const { onPhotoRejected } = pick(type);

    expect(readAsDataURL).toHaveBeenCalledTimes(1);
    expect(onPhotoRejected).not.toHaveBeenCalled();
  });
});
