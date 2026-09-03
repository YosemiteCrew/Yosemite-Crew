import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

import ProtectedGuides from '@/app/features/guides/pages/Guides';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/inputs/Search', () => ({
  __esModule: true,
  default: ({ value, setSearch, placeholder }: any) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
    />
  ),
}));

jest.mock('@/app/ui/overlays/Modal/GuidePlayerModal', () => ({
  __esModule: true,
  default: ({ showModal, guide, nextGuide, onNext, setShowModal }: any) =>
    showModal ? (
      <div data-testid="guide-player">
        <span data-testid="player-title">{guide?.title}</span>
        <span data-testid="player-next">{nextGuide?.title}</span>
        <button type="button" onClick={onNext}>
          player-next
        </button>
        <button type="button" onClick={() => setShowModal(false)}>
          player-close
        </button>
      </div>
    ) : null,
}));

const cardButton = (title: string) => screen.getByRole('button', { name: `Play guide: ${title}` });
const allCards = () => screen.queryAllByRole('button', { name: /^Play guide:/ });

describe('Guides page', () => {
  it('renders the warm-bone header and all seed guides', () => {
    render(<ProtectedGuides />);
    expect(screen.getByRole('heading', { name: /Guides \(6\)/ })).toBeInTheDocument();
    expect(
      screen.getByText('Short, practical walkthroughs · 2-6 minutes each')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Short, practical walkthroughs · updated with each release')
    ).toBeInTheDocument();
    expect(allCards()).toHaveLength(6);
    expect(cardButton('Your first day in the PIMS')).toBeInTheDocument();
    expect(cardButton('Connect IDEXX in 5 minutes')).toBeInTheDocument();
  });

  it('renders the New badge, which is content age rather than viewer state', () => {
    render(<ProtectedGuides />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows no viewing history, because nothing records one', () => {
    // "Watched" and a 60% progress bar were module literals, so every user of
    // every clinic was told they had already watched the same guide.
    render(<ProtectedGuides />);
    expect(screen.queryByText('Watched')).not.toBeInTheDocument();
    expect(screen.queryByText('60%')).not.toBeInTheDocument();
  });

  it('filters the grid by category chip', () => {
    render(<ProtectedGuides />);
    fireEvent.click(screen.getByRole('button', { name: 'Appointments' }));
    expect(allCards()).toHaveLength(1);
    expect(cardButton('Run a visit end to end')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Play guide: Your first day in the PIMS' })
    ).not.toBeInTheDocument();
  });

  it('narrows the shelf to one role, and keeps what everyone needs', () => {
    render(<ProtectedGuides />);

    fireEvent.click(screen.getByRole('button', { name: 'Veterinarian' }));

    /* Two, not one: a role's track carries its own guides AND the ones cut for
       the whole clinic. Picking a role that hid "Your first day in the PIMS"
       would bury the orientation guide for every reader but a new owner. */
    expect(allCards()).toHaveLength(2);
    expect(cardButton('Run a visit end to end')).toBeInTheDocument();
    expect(cardButton('Your first day in the PIMS')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Play guide: Connect IDEXX in 5 minutes' })
    ).toBeNull();
  });

  it('drops a role filter that no longer applies when All roles is picked', () => {
    render(<ProtectedGuides />);

    fireEvent.click(screen.getByRole('button', { name: 'Clinic owner' }));
    expect(allCards()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'All roles' }));
    expect(allCards()).toHaveLength(6);
  });

  it('offers a chip for every role present and none that is not', () => {
    render(<ProtectedGuides />);

    // Derived from the library rather than hardcoded, so a role with no guides
    // never gets a chip that filters to an empty shelf.
    for (const role of ['All roles', 'Everyone', 'Veterinarian', 'Practice manager']) {
      expect(screen.getByRole('button', { name: role })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Developer' })).toBeNull();
  });

  it('combines a role with a category', () => {
    render(<ProtectedGuides />);

    fireEvent.click(screen.getByRole('button', { name: 'Practice manager' }));
    fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));

    // Both filters apply; "Everyone" survives the role filter but still has to
    // match the category, so the orientation guide drops out here.
    expect(allCards()).toHaveLength(1);
    expect(cardButton('Connect IDEXX in 5 minutes')).toBeInTheDocument();
  });

  it('filters the grid by search text', () => {
    render(<ProtectedGuides />);
    fireEvent.change(screen.getByLabelText('Search guides'), { target: { value: 'idexx' } });
    expect(allCards()).toHaveLength(1);
    expect(cardButton('Connect IDEXX in 5 minutes')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search guides'), { target: { value: 'nonsense' } });
    expect(allCards()).toHaveLength(0);
    expect(screen.getByText('No guides match your search')).toBeInTheDocument();
  });

  it('clears filters from the empty state to restore the grid', () => {
    render(<ProtectedGuides />);
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    fireEvent.change(screen.getByLabelText('Search guides'), { target: { value: 'nonsense' } });
    expect(allCards()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(allCards()).toHaveLength(6);
    expect(screen.queryByText('No guides match your search')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Search guides') as HTMLInputElement).value).toBe('');
  });

  it('opens the player and advances to the next guide', () => {
    render(<ProtectedGuides />);
    fireEvent.click(cardButton('Your first day in the PIMS'));

    expect(screen.getByTestId('guide-player')).toBeInTheDocument();
    expect(screen.getByTestId('player-title')).toHaveTextContent('Your first day in the PIMS');
    expect(screen.getByTestId('player-next')).toHaveTextContent('Run a visit end to end');

    fireEvent.click(screen.getByRole('button', { name: 'player-next' }));
    expect(screen.getByTestId('player-title')).toHaveTextContent('Run a visit end to end');
    expect(screen.getByTestId('player-next')).toHaveTextContent('Invoices, deposits and payouts');
  });

  it('closes the player', () => {
    render(<ProtectedGuides />);
    fireEvent.click(cardButton('Stock that counts itself'));
    expect(screen.getByTestId('guide-player')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'player-close' }));
    expect(screen.queryByTestId('guide-player')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProtectedGuides />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
