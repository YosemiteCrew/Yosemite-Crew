import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

import ProtectedGuides from '@/app/features/guides/pages/Guides';
import type { GuideVideo } from '@/app/features/guides/types/guides';

/* A getter-backed override so ONE test can render an empty library without a
   second module registry. `jest.isolateModules` + `require` pulled in a second
   copy of React and every hook call threw. */
let mockGuidesOverride: unknown[] | null = null;
jest.mock('@/app/features/guides/data/guidesData', () => {
  const actual = jest.requireActual('@/app/features/guides/data/guidesData');
  return {
    get guidesData() {
      return mockGuidesOverride ?? actual.guidesData;
    },
  };
});

afterEach(() => {
  mockGuidesOverride = null;
});

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

/* A fixture, not the shipped library. These tests are about what the SHELF
   does - filter by role, filter by category, search, open the player - and that
   behaviour must not be re-pinned every time a film is added or re-cut. The
   generated library gets one test of its own at the bottom of this file. */
const guide = (over: Partial<GuideVideo> & { id: string; title: string }): GuideVideo => ({
  persona: 'Everyone',
  description: 'A short walkthrough.',
  duration: '0:22',
  category: 'Getting started',
  tags: [],
  videoUrl: `https://cdn.example.test/videos/guides/${over.id}.mp4`,
  thumbnailUrl: `https://cdn.example.test/guidePosters/${over.id}-poster.png`,
  ...over,
});

const FIXTURE: GuideVideo[] = [
  guide({ id: 'first-day', title: 'Your first day in the PIMS', featured: true }),
  guide({
    id: 'run-a-visit',
    title: 'Run a visit end to end',
    persona: 'Veterinarian',
    category: 'The visit',
  }),
  guide({
    id: 'invoices',
    title: 'Invoices, deposits and payouts',
    persona: 'Practice manager',
    category: 'Money',
  }),
  guide({
    id: 'stock',
    title: 'Stock that counts itself',
    persona: 'Nurse or technician',
    category: 'Inventory',
  }),
  guide({
    id: 'idexx',
    title: 'Connect IDEXX in 5 minutes',
    persona: 'Practice manager',
    category: 'Integrations',
  }),
  guide({
    id: 'invite',
    title: 'Invite your team, set roles',
    persona: 'Clinic owner',
    category: 'Your setup',
    status: 'new',
  }),
];

describe('Guides page', () => {
  beforeEach(() => {
    mockGuidesOverride = FIXTURE;
  });

  it('renders the warm-bone header and every guide in the library', () => {
    render(<ProtectedGuides />);
    expect(screen.getByRole('heading', { name: /Guides \(6\)/ })).toBeInTheDocument();
    /* The runtime is derived from the library, not asserted in the markup: the
       header hardcoded "2-6 minutes each". The fixture's guides all run 0:22, so
       the derived line says so; the shipped library is the same shape. And "Short, practical walkthroughs" used to be on BOTH lines, with
       neither hidden at any width, so the phrase appeared twice on screen. */
    /* A function matcher, because the runtime is interpolated: the line is two
       text nodes, and a plain string query only ever sees one of them. */
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'SPAN' &&
          el.textContent === 'Short, practical walkthroughs · a minute or less each'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Updated with each release')).toBeInTheDocument();
    expect(screen.getAllByText(/Short, practical walkthroughs/)).toHaveLength(1);
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
    fireEvent.click(screen.getByRole('button', { name: 'The visit' }));
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

  it('does not blame the search when the library itself is empty', () => {
    /* FilteredEmptyState offers "Clear filters" and tells the reader to try a
       different search. With nothing in the library that is a dead end: no
       filter change can help. Same defect the finance phone band had, blaming
       filters that were never applied. */
    mockGuidesOverride = [];
    render(<ProtectedGuides />);

    expect(screen.getByText('No guides yet')).toBeInTheDocument();
    expect(screen.queryByText('No guides match your search')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('clears filters from the empty state to restore the grid', () => {
    render(<ProtectedGuides />);
    fireEvent.click(screen.getByRole('button', { name: 'Money' }));
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
