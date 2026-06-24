import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpecialityAccordionRevamp from '@/app/features/organization/pages/Specialities/SpecialityAccordionRevamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('react-icons/io', () => ({
  IoIosArrowDown: ({ className }: any) => <span data-testid="arrow-icon" className={className} />,
  IoIosSearch: () => <span data-testid="search-icon" />,
}));

jest.mock('react-icons/ri', () => ({
  RiEdit2Line: () => <span data-testid="edit-icon" />,
}));

jest.mock('react-icons/md', () => ({
  MdOutlineArchive: () => <span data-testid="archive-icon" />,
  MdDeleteForever: () => <span data-testid="delete-icon" />,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <h3>{title}</h3>
      <button type="button" onClick={onClose}>
        Close Modal
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('react-icons/fi', () => ({
  FiCheck: () => <span data-testid="check-icon" />,
  FiX: () => <span data-testid="x-icon" />,
}));

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/TabToggle/TabToggle', () => ({
  __esModule: true,
  default: ({ tabs, activeKey, onChange }: any) => (
    <div data-testid="tab-toggle">
      {tabs.map((tab: any) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`tab-${tab.key}`}
          onClick={() => onChange(tab.key)}
          data-selected={activeKey === tab.key ? 'true' : 'false'}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Specialities/ServicesTab', () => ({
  __esModule: true,
  default: React.forwardRef((_props: any, _ref: any) => (
    <div data-testid="services-tab">Services</div>
  )),
}));

jest.mock('@/app/features/organization/pages/Specialities/PackagesTab', () => ({
  __esModule: true,
  default: React.forwardRef((_props: any, _ref: any) => (
    <div data-testid="packages-tab">Packages</div>
  )),
}));

jest.mock('@/app/features/organization/pages/Specialities/ArchiveTab', () => ({
  __esModule: true,
  default: () => <div data-testid="archive-tab">Archive</div>,
}));

const mockSpeciality = {
  id: 'spec-1',
  name: 'General Practice',
  status: 'ACTIVE' as const,
  code: 'GP',
  organisationId: 'org-1',
  teamMemberIds: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockNotify = jest.fn();
const mockRenameSpeciality = jest.fn();

describe('SpecialityAccordionRevamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: mockNotify });
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          renameSpeciality: mockRenameSpeciality,
          specialities: [mockSpeciality],
          services: [
            {
              id: 'svc-1',
              specialityId: 'spec-1',
              status: 'ACTIVE',
              name: 'Consultation',
              code: 'CON',
              type: 'CONSULTATION',
            },
          ],
          packages: [
            {
              id: 'pkg-1',
              specialityId: 'spec-1',
              status: 'ACTIVE',
              name: 'Wellness Pack',
              code: 'WP',
              breakdown: [{ id: 'b1' }, { id: 'b2' }],
            },
          ],
        });
      }
      return null;
    });
  });

  // --- Section 1: Basic Render ---

  it('renders the speciality name', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    expect(screen.getByText('General Practice')).toBeInTheDocument();
  });

  it('shows count of services and packages', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    // 1 service + 1 package = 2 total
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('renders collapsed by default when defaultOpen=false', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen={false} />);
    expect(screen.queryByTestId('services-tab')).not.toBeInTheDocument();
  });

  it('renders expanded when defaultOpen=true', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    expect(screen.getByTestId('services-tab')).toBeInTheDocument();
  });

  // --- Section 2: Toggle open/close ---

  it('toggles open when chevron button is clicked', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const toggleBtn = screen.getByRole('button', { name: /General Practice speciality/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('services-tab')).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('services-tab')).not.toBeInTheDocument();
  });

  // --- Section 3: Tab navigation ---

  it('shows services tab by default when open', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    expect(screen.getByTestId('services-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('packages-tab')).not.toBeInTheDocument();
  });

  it('switches to packages tab', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    fireEvent.click(screen.getByTestId('tab-packages'));
    expect(screen.getByTestId('packages-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('services-tab')).not.toBeInTheDocument();
  });

  it('switches to archive tab', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    fireEvent.click(screen.getByTestId('tab-archive'));
    expect(screen.getByTestId('archive-tab')).toBeInTheDocument();
  });

  // --- Section 4: Edit name ---

  it('enters name-editing mode when edit icon button is clicked', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const editBtn = screen.getByRole('button', { name: /Rename General Practice/i });
    fireEvent.click(editBtn);
    expect(screen.getByLabelText('Edit speciality name')).toBeInTheDocument();
  });

  it('saves name on check button click', async () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(mockRenameSpeciality).toHaveBeenCalledWith('spec-1', 'New Name');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Speciality renamed' })
      )
    );
  });

  it('saves name on Enter key', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRenameSpeciality).toHaveBeenCalledWith('spec-1', 'Updated Name');
  });

  it('cancels name edit on Escape key', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockRenameSpeciality).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Edit speciality name')).not.toBeInTheDocument();
  });

  it('cancels name edit on X button click', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel rename' }));
    expect(mockRenameSpeciality).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Edit speciality name')).not.toBeInTheDocument();
  });

  it('does not save when name is empty/whitespace', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(mockRenameSpeciality).not.toHaveBeenCalled();
  });

  // --- Section 5: Search (inline input, no separate toggle button) ---

  it('search input is always visible in header', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    expect(screen.getByLabelText('Search within General Practice')).toBeInTheDocument();
  });

  it('shows search results when query matches a service', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'consul' } });
    fireEvent.focus(searchInput);
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  it('shows search results when query matches a package', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'wellness' } });
    fireEvent.focus(searchInput);
    expect(screen.getByText('Wellness Pack')).toBeInTheDocument();
  });

  it('clears search query on Escape key', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'consul' } });
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('selecting a service search result opens accordion and switches to services tab', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'consul' } });
    fireEvent.focus(searchInput);
    fireEvent.mouseDown(screen.getByText('Consultation'));
    expect(screen.getByTestId('services-tab')).toBeInTheDocument();
  });

  it('selecting a package search result switches to packages tab', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'wellness' } });
    fireEvent.focus(searchInput);
    fireEvent.mouseDown(screen.getByText('Wellness Pack'));
    expect(screen.getByTestId('packages-tab')).toBeInTheDocument();
  });
});
