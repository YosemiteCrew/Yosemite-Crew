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

describe('Guides page', () => {
  it('renders the warm-bone header and all seed guides', () => {
    render(<ProtectedGuides />);
    expect(screen.getByRole('heading', { name: /Learn the crew's way/ })).toBeInTheDocument();
    expect(
      screen.getByText('Short, practical walkthroughs · 2-6 minutes each')
    ).toBeInTheDocument();
    expect(screen.getByText('12 guides · updated with each release')).toBeInTheDocument();
    expect(screen.getByText('6 results')).toBeInTheDocument();
    expect(cardButton('Your first day in the PIMS')).toBeInTheDocument();
    expect(cardButton('Connect IDEXX in 5 minutes')).toBeInTheDocument();
  });

  it('renders each card status variant', () => {
    render(<ProtectedGuides />);
    expect(screen.getByText('Watched')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('filters the grid by category chip', () => {
    render(<ProtectedGuides />);
    fireEvent.click(screen.getByRole('button', { name: 'Appointments' }));
    expect(screen.getByText('1 results')).toBeInTheDocument();
    expect(cardButton('Run a visit end to end')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Play guide: Your first day in the PIMS' })
    ).not.toBeInTheDocument();
  });

  it('filters the grid by search text', () => {
    render(<ProtectedGuides />);
    fireEvent.change(screen.getByLabelText('Search guides'), { target: { value: 'idexx' } });
    expect(screen.getByText('1 results')).toBeInTheDocument();
    expect(cardButton('Connect IDEXX in 5 minutes')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search guides'), { target: { value: 'nonsense' } });
    expect(screen.getByText('0 results')).toBeInTheDocument();
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
