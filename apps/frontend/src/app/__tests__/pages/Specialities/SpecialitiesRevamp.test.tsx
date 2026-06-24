import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SpecialitiesRevamp from '@/app/features/organization/pages/Specialities/SpecialitiesRevamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSearchStore } from '@/app/stores/searchStore';

// --- Mocks ---

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, 'aria-label': ariaLabel }: any) => (
    <a href={href} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

const mockSearchParamsGet = jest.fn(() => null);
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

jest.mock('@/app/features/organization/pages/Specialities/SpecialityAccordionRevamp', () => ({
  __esModule: true,
  default: ({ speciality, defaultOpen }: any) => (
    <div data-testid={`accordion-${speciality.id}`} data-default-open={String(defaultOpen)}>
      {speciality.name}
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Specialities/AddSpecialityModal', () => ({
  __esModule: true,
  default: ({ showModal }: any) => (showModal ? <div data-testid="add-speciality-modal" /> : null),
}));

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/layout/MobileSearchBar/MobileSearchBar', () => ({
  __esModule: true,
  default: () => <div data-testid="mobile-search-bar" />,
}));

jest.mock('react-icons/io5', () => ({
  IoChevronBack: () => <span data-testid="chevron-back" />,
}));

// --- Test Data ---

const mockSpecialities = [
  { id: 'spec-1', name: 'General Practice', organisationId: 'org-1' },
  { id: 'spec-2', name: 'Dentistry', organisationId: 'org-1' },
  { id: 'spec-3', name: 'Emergency Care', organisationId: 'org-1' },
  { id: 'spec-4', name: 'Other Org', organisationId: 'org-2' },
];

describe('SpecialitiesRevamp', () => {
  const mockLoadOrganisationCatalog = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        specialities: mockSpecialities,
        status: 'ready',
        loadOrganisationCatalog: mockLoadOrganisationCatalog,
      })
    );
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (useSearchStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ query: '' })
    );
  });

  // --- Section 1: Rendering ---

  it('renders the page heading', () => {
    render(<SpecialitiesRevamp />);
    expect(screen.getByRole('heading', { level: 1, name: /Specialities/ })).toBeInTheDocument();
  });

  it('renders the back link to /organization', () => {
    render(<SpecialitiesRevamp />);
    const backLink = screen.getByRole('link', { name: /Back to Organisation/i });
    expect(backLink).toHaveAttribute('href', '/organization');
  });

  it('renders the mobile search bar', () => {
    render(<SpecialitiesRevamp />);
    expect(screen.getByTestId('mobile-search-bar')).toBeInTheDocument();
  });

  it('renders an accordion for each speciality', () => {
    render(<SpecialitiesRevamp />);
    expect(screen.getByTestId('accordion-spec-1')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-spec-2')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-spec-3')).toBeInTheDocument();
    expect(screen.queryByTestId('accordion-spec-4')).not.toBeInTheDocument();
  });

  it('opens the first accordion by default (no openId in searchParams)', () => {
    render(<SpecialitiesRevamp />);
    expect(screen.getByTestId('accordion-spec-1')).toHaveAttribute('data-default-open', 'true');
    expect(screen.getByTestId('accordion-spec-2')).toHaveAttribute('data-default-open', 'false');
  });

  // --- Section 2: Add Modal ---

  it('does not show the add modal initially', () => {
    render(<SpecialitiesRevamp />);
    expect(screen.queryByTestId('add-speciality-modal')).not.toBeInTheDocument();
  });

  it('opens AddSpecialityModal when "Add Speciality" button in header is clicked', () => {
    render(<SpecialitiesRevamp />);
    // The header button (first one rendered)
    const addButtons = screen.getAllByRole('button', { name: 'Add Speciality' });
    fireEvent.click(addButtons[0]);
    expect(screen.getByTestId('add-speciality-modal')).toBeInTheDocument();
  });

  // --- Section 3: Search Filtering ---

  it('filters specialities by search query (case-insensitive)', () => {
    (useSearchStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ query: 'dent' })
    );
    render(<SpecialitiesRevamp />);
    expect(screen.queryByTestId('accordion-spec-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('accordion-spec-2')).toBeInTheDocument();
    expect(screen.queryByTestId('accordion-spec-3')).not.toBeInTheDocument();
  });

  it('shows no-results message when search yields no matches', () => {
    (useSearchStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ query: 'zzzznotfound' })
    );
    render(<SpecialitiesRevamp />);
    expect(screen.getByText(/No specialities match "zzzznotfound"/)).toBeInTheDocument();
  });

  it('shows "No specialities yet." when list is empty and no search query', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        specialities: [],
        status: 'ready',
        loadOrganisationCatalog: mockLoadOrganisationCatalog,
      })
    );
    render(<SpecialitiesRevamp />);
    expect(screen.getByText('No specialities yet.')).toBeInTheDocument();
  });

  it('shows an add button inside the empty state when no search query', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        specialities: [],
        status: 'ready',
        loadOrganisationCatalog: mockLoadOrganisationCatalog,
      })
    );
    render(<SpecialitiesRevamp />);
    const addButtons = screen.getAllByRole('button', { name: 'Add Speciality' });
    // Header button + empty-state button = 2
    expect(addButtons.length).toBeGreaterThanOrEqual(2);
    // Clicking the empty-state button also opens the modal
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(screen.getByTestId('add-speciality-modal')).toBeInTheDocument();
  });

  it('does not show add button in empty state when search query is active', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        specialities: [],
        status: 'ready',
        loadOrganisationCatalog: mockLoadOrganisationCatalog,
      })
    );
    (useSearchStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ query: 'something' })
    );
    render(<SpecialitiesRevamp />);
    // The no-result message is shown but no secondary add button
    expect(screen.getByText(/No specialities match "something"/)).toBeInTheDocument();
    // There should still be the header "Add Speciality" button (only 1)
    expect(screen.getAllByRole('button', { name: 'Add Speciality' })).toHaveLength(1);
  });

  // --- Section 4: missing org ---

  it('shows a scoped empty state when primaryOrgId is null', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null })
    );
    render(<SpecialitiesRevamp />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('Select an organisation before managing specialities.')
    ).toBeInTheDocument();
  });

  // --- Section 5: openId from searchParams ---

  it('opens the matching accordion when openId is in searchParams', () => {
    (mockSearchParamsGet as jest.Mock).mockImplementation((key: string) =>
      key === 'open' ? 'spec-2' : null
    );

    render(<SpecialitiesRevamp />);
    expect(screen.getByTestId('accordion-spec-2')).toHaveAttribute('data-default-open', 'true');
    expect(screen.getByTestId('accordion-spec-1')).toHaveAttribute('data-default-open', 'false');
  });
});
