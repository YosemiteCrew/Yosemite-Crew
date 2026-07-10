import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  default: ({ children, showModal, setShowModal }: any) =>
    showModal ? (
      <div data-testid="center-modal">
        <button type="button" onClick={() => setShowModal(false)}>
          Backdrop Close
        </button>
        {children}
      </div>
    ) : null,
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
  default: React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ openAdd: mockServicesOpenAdd }));
    return <div data-testid="services-tab">Services</div>;
  }),
}));

jest.mock('@/app/features/organization/pages/Specialities/PackagesTab', () => ({
  __esModule: true,
  default: React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ openAdd: mockPackagesOpenAdd }));
    return <div data-testid="packages-tab">Packages</div>;
  }),
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
const mockDeleteSpeciality = jest.fn();
const mockServicesOpenAdd = jest.fn();
const mockPackagesOpenAdd = jest.fn();

describe('SpecialityAccordionRevamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: mockNotify });
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          renameSpeciality: mockRenameSpeciality,
          deleteSpeciality: mockDeleteSpeciality,
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

  it('keeps the accordion open when selecting a result while already open', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'consul' } });
    fireEvent.mouseDown(screen.getByText('Consultation'));
    // `if (!open) setOpen(true)` is skipped — the accordion was already open.
    expect(screen.getByTestId('services-tab')).toBeInTheDocument();
  });

  // --- Section 6: header counts (loaded vs server-provided) ---

  it('uses loaded service/package counts once the catalog is loaded', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            renameSpeciality: mockRenameSpeciality,
            deleteSpeciality: mockDeleteSpeciality,
            specialities: [mockSpeciality],
            loadedSpecialityIds: ['spec-1:active'],
            services: [
              {
                id: 'svc-1',
                specialityId: 'spec-1',
                status: 'ACTIVE',
                name: 'A',
                code: 'A',
                type: 'CONSULTATION',
              },
              {
                id: 'svc-2',
                specialityId: 'spec-1',
                status: 'ACTIVE',
                name: 'B',
                code: 'B',
                type: 'CONSULTATION',
              },
            ],
            packages: [
              {
                id: 'pkg-1',
                specialityId: 'spec-1',
                status: 'ACTIVE',
                name: 'P',
                code: 'P',
                breakdown: [],
              },
            ],
          })
        : null
    );
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    // specialityLoaded === true → 2 loaded services + 1 loaded package = 3
    expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
  });

  it('falls back to server-provided counts before the catalog is loaded', () => {
    render(
      <SpecialityAccordionRevamp
        speciality={{ ...mockSpeciality, activeServiceCount: 5, activePackageCount: 3 }}
      />
    );
    // specialityLoaded === false and activeServiceCount/activePackageCount defined → 5 + 3 = 8
    expect(screen.getByText(/\(8\)/)).toBeInTheDocument();
  });

  // --- Section 7: search edge cases ---

  it('shows "No results found." when the query matches nothing', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('matches a service by code when the name does not match', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            renameSpeciality: mockRenameSpeciality,
            deleteSpeciality: mockDeleteSpeciality,
            specialities: [mockSpeciality],
            services: [
              {
                id: 'svc-x',
                specialityId: 'spec-1',
                status: 'ACTIVE',
                name: 'Ultrasound',
                code: 'ZZ99',
                type: 'IMAGING',
              },
            ],
            packages: [],
          })
        : null
    );
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    // query hits the `|| service.code.toLowerCase().includes(...)` branch, not the name
    fireEvent.change(searchInput, { target: { value: 'zz99' } });
    expect(screen.getByText('Ultrasound')).toBeInTheDocument();
  });

  it('matches a package by code when the name does not match', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            renameSpeciality: mockRenameSpeciality,
            deleteSpeciality: mockDeleteSpeciality,
            specialities: [mockSpeciality],
            services: [],
            packages: [
              {
                id: 'pkg-x',
                specialityId: 'spec-1',
                status: 'ACTIVE',
                name: 'Bundle',
                code: 'PK77',
                breakdown: [{ id: 'b1' }],
              },
            ],
          })
        : null
    );
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice');
    // query hits the `|| pack.code.toLowerCase().includes(...)` branch, not the name
    fireEvent.change(searchInput, { target: { value: 'pk77' } });
    expect(screen.getByText('Bundle')).toBeInTheDocument();
  });

  it('clears the search via the clear (X) button', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'consul' } });
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(searchInput.value).toBe('');
    expect(screen.queryByText('Consultation')).not.toBeInTheDocument();
  });

  it('ignores non-Escape keys pressed in the search box', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    const searchInput = screen.getByLabelText('Search within General Practice') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'consul' } });
    // `if (e.key === 'Escape')` false branch — query is left intact.
    fireEvent.keyDown(searchInput, { key: 'a' });
    expect(searchInput.value).toBe('consul');
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  // --- Section 8: rename validation & failure ---

  it('shows the required error, then clears it on the next keystroke', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(mockRenameSpeciality).not.toHaveBeenCalled();
    expect(screen.getByText('Speciality name is required.')).toBeInTheDocument();
    // typing again trips `if (nameError) setNameError('')`
    fireEvent.change(input, { target: { value: 'Cardiology' } });
    expect(screen.queryByText('Speciality name is required.')).not.toBeInTheDocument();
  });

  it('rejects a duplicate name within the same organisation', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            renameSpeciality: mockRenameSpeciality,
            deleteSpeciality: mockDeleteSpeciality,
            specialities: [
              mockSpeciality, // self → `s.id !== speciality.id` false
              { id: 'spec-2', organisationId: 'org-1', name: 'Radiology' }, // same org, name mismatch
              { id: 'spec-3', organisationId: 'org-2', name: 'Cardiology' }, // org mismatch
              { id: 'spec-4', organisationId: 'org-1', name: 'Cardiology' }, // duplicate match
            ],
            services: [],
            packages: [],
          })
        : null
    );
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: 'Cardiology' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(mockRenameSpeciality).not.toHaveBeenCalled();
    expect(screen.getByText('A speciality with this name already exists.')).toBeInTheDocument();
  });

  it('notifies with an error when renaming rejects', async () => {
    mockRenameSpeciality.mockRejectedValueOnce(new Error('boom'));
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    const input = screen.getByLabelText('Edit speciality name');
    fireEvent.change(input, { target: { value: 'Fresh Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(mockRenameSpeciality).toHaveBeenCalledWith('spec-1', 'Fresh Name');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to rename speciality' })
      )
    );
  });

  // --- Section 9: focus handling on edit ---

  it('focuses the name input after entering edit mode', () => {
    jest.useFakeTimers();
    try {
      render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
      fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
      const input = screen.getByLabelText('Edit speciality name');
      const focusSpy = jest.spyOn(input, 'focus');
      act(() => {
        jest.runAllTimers();
      });
      expect(focusSpy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not throw if the input unmounts before the focus timer fires', () => {
    jest.useFakeTimers();
    try {
      render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
      fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
      // Cancel unmounts the input, so `inputRef.current?.focus()` short-circuits.
      fireEvent.click(screen.getByRole('button', { name: 'Cancel rename' }));
      act(() => {
        jest.runAllTimers();
      });
      expect(screen.queryByLabelText('Edit speciality name')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  // --- Section 10: add-new via the Primary button ---

  it('opens the add-service flow from the New Service button', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    fireEvent.click(screen.getByRole('button', { name: 'New Service' }));
    expect(mockServicesOpenAdd).toHaveBeenCalled();
  });

  it('opens the add-package flow from the New Package button', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    fireEvent.click(screen.getByTestId('tab-packages'));
    fireEvent.click(screen.getByRole('button', { name: 'New Package' }));
    expect(mockPackagesOpenAdd).toHaveBeenCalled();
  });

  it('hides the New button on the Archive tab', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} defaultOpen />);
    fireEvent.click(screen.getByTestId('tab-archive'));
    // `activeTab !== 'archive'` false → no add button rendered
    expect(screen.queryByRole('button', { name: 'New Service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Package' })).not.toBeInTheDocument();
  });

  // --- Section 11: delete flow ---

  const openDeleteModal = () => {
    fireEvent.click(screen.getByRole('button', { name: /Rename General Practice/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete General Practice' }));
  };

  it('deletes the speciality and notifies on success', async () => {
    mockDeleteSpeciality.mockResolvedValueOnce(undefined);
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeleteSpeciality).toHaveBeenCalledWith('spec-1');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Speciality deleted' })
      )
    );
  });

  it('surfaces the catalog error message when delete fails', async () => {
    mockDeleteSpeciality.mockRejectedValueOnce({
      response: { data: { error: { message: 'It has active appointments.' } } },
    });
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          title: 'Unable to delete speciality',
          text: 'It has active appointments.',
        })
      )
    );
  });

  it('ignores repeat clicks while a delete is in flight', async () => {
    let resolveDelete: (value?: unknown) => void = () => undefined;
    mockDeleteSpeciality.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = () => resolve(undefined);
      })
    );
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // While pending the button flips to the busy label...
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument()
    );
    // ...and a second click is a no-op guarded by `if (deleting) return`.
    fireEvent.click(screen.getByRole('button', { name: 'Deleting...' }));
    expect(mockDeleteSpeciality).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDelete();
    });
  });

  it('closes the delete modal on cancel', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    openDeleteModal();
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('closes the delete modal via the modal header close button', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close Modal' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('closes the delete modal via the overlay setShowModal handler', () => {
    render(<SpecialityAccordionRevamp speciality={mockSpeciality} />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: 'Backdrop Close' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });
});
