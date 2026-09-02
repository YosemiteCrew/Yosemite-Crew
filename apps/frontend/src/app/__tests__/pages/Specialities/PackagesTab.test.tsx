import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PackagesTab, {
  type PackagesTabHandle,
} from '@/app/features/organization/pages/Specialities/PackagesTab';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useNotify } from '@/app/hooks/useNotify';

// --- Mocks ---

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `$ ${amount.toFixed(2)}`,
  recordCurrency: (record: { currency?: string | null } | null | undefined, fallback: string) =>
    record?.currency ?? fallback,
  formatMoneyPrecise: (amount: number, currency: string) =>
    `${currency} ${Number(amount).toFixed(2)}`,
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('@/app/features/organization/pages/Specialities/PackageFormDraft', () => ({
  __esModule: true,
  default: ({ onClose, editPackage }: any) => (
    <div data-testid={editPackage ? `edit-draft-${editPackage.id}` : 'add-draft'}>
      <button type="button" onClick={onClose}>
        Close Draft
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Specialities/PackageBreakdownTable', () => ({
  __esModule: true,
  default: () => <div data-testid="breakdown-table" />,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, setShowModal, children }: any) =>
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
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        Modal Close
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

jest.mock('@/app/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/app/ui/primitives/SectionContainer/SectionContainer', () => ({
  __esModule: true,
  default: ({ children, title, titleSlot }: any) => (
    <div>
      <span>{title}</span>
      {titleSlot}
      {children}
    </div>
  ),
}));

jest.mock('@/app/features/organization/services/catalogCalculations', () => ({
  computePackageTotals: jest.fn(() => ({ totalCost: 100, grossTotal: 120 })),
}));

jest.mock(
  'react-icons/ri',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/md',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/lu',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/ai',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

// --- Test Data ---

const mockPackage = {
  id: 'pkg-1',
  name: 'Wellness Package',
  code: 'WEL001',
  specialityId: 'spec-1',
  status: 'ACTIVE' as const,
  isBookable: true,
  description: 'Annual wellness check',
  durationText: 'Approx. 60 mins',
  additionalDiscount: 10,
  breakdown: [],
};

const mockPackageWithBreakdown = {
  ...mockPackage,
  id: 'pkg-2',
  name: 'Premium Package',
  breakdown: [{ id: 'b1', name: 'Lab Test', price: 50, quantity: 1, discount: 0 }],
};

describe('PackagesTab', () => {
  const mockArchivePackage = jest.fn();
  const mockHydratePackageDetail = jest.fn();
  const mockLoadSpecialityCatalog = jest.fn();
  const mockNotify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: mockNotify });
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        packages: [mockPackage, mockPackageWithBreakdown],
        archivePackage: mockArchivePackage,
        hydratePackageDetail: mockHydratePackageDetail,
        loadSpecialityCatalog: mockLoadSpecialityCatalog,
        loadedSpecialityIds: ['spec-1:active'],
      };
      return selector(state);
    });
  });

  // --- Section 1: Rendering ---

  it('renders package cards for active packages in the speciality', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getByText('Wellness Package')).toBeInTheDocument();
    expect(screen.getByText('Premium Package')).toBeInTheDocument();
  });

  it('renders "Click to add package" button when draft is not open', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getByText('Click to add package')).toBeInTheDocument();
  });

  it('shows empty state message when no packages exist', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        packages: [],
        archivePackage: mockArchivePackage,
        hydratePackageDetail: mockHydratePackageDetail,
        loadSpecialityCatalog: mockLoadSpecialityCatalog,
        loadedSpecialityIds: ['spec-1:active'],
      })
    );
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getByText(/haven.*t added any packages yet/i)).toBeInTheDocument();
  });

  it('does not show empty state when packages exist', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.queryByText(/haven.*t added any packages yet/i)).not.toBeInTheDocument();
  });

  it('only renders packages matching the specialityId and ACTIVE status', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        packages: [
          mockPackage,
          { ...mockPackage, id: 'pkg-other', specialityId: 'spec-other' },
          { ...mockPackage, id: 'pkg-hidden', status: 'ARCHIVED' as const },
        ],
        archivePackage: mockArchivePackage,
        hydratePackageDetail: mockHydratePackageDetail,
        loadSpecialityCatalog: mockLoadSpecialityCatalog,
      };
      return selector(state);
    });
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getAllByText('Wellness Package')).toHaveLength(1);
  });

  // --- Section 2: Add flow ---

  it('opens add draft at bottom when "Click to add package" is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getByText('Click to add package'));
    expect(screen.getByTestId('add-draft')).toBeInTheDocument();
    // Add button should be hidden while draft is open
    expect(screen.queryByText('Click to add package')).not.toBeInTheDocument();
  });

  it('closes the add draft when Close Draft is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getByText('Click to add package'));
    fireEvent.click(screen.getByText('Close Draft'));
    expect(screen.queryByTestId('add-draft')).not.toBeInTheDocument();
    expect(screen.getByText('Click to add package')).toBeInTheDocument();
  });

  // --- Section 3: Edit flow ---

  it('opens edit draft when edit button for a package is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const editButtons = screen.getAllByRole('button', { name: /Edit Wellness Package/i });
    fireEvent.click(editButtons[0]);
    expect(screen.getByTestId('edit-draft-pkg-1')).toBeInTheDocument();
  });

  it('hydrates package detail when viewing an empty breakdown', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const viewButtons = screen.getAllByRole('button', {
      name: /View breakdown of Wellness Package/i,
    });
    fireEvent.click(viewButtons[0]);
    expect(mockHydratePackageDetail).toHaveBeenCalledWith('pkg-1');
  });

  it('closes edit draft when Close Draft is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const editButtons = screen.getAllByRole('button', { name: /Edit Wellness Package/i });
    fireEvent.click(editButtons[0]);
    fireEvent.click(screen.getByText('Close Draft'));
    expect(screen.queryByTestId('edit-draft-pkg-1')).not.toBeInTheDocument();
  });

  // --- Section 4: Delete flow ---

  it('shows delete confirmation modal when delete button is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Archive Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getByText('Archive package')).toBeInTheDocument();
    expect(screen.getAllByText(/Wellness Package/).length).toBeGreaterThanOrEqual(1);
  });

  it('cancels delete when Cancel is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Archive Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    expect(mockArchivePackage).not.toHaveBeenCalled();
  });

  it('confirms archive and calls archivePackage + notify on confirm', async () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const archiveButtons = screen.getAllByRole('button', { name: /Archive Wellness Package/i });
    fireEvent.click(archiveButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(mockArchivePackage).toHaveBeenCalledWith('pkg-1');
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Package archived' })
      );
      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    });
  });

  it('closes delete modal via modal header close button', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Archive Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    // Modal close button (from ModalHeader mock)
    fireEvent.click(screen.getByRole('button', { name: 'Modal Close' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('closes the archive modal via the modal backdrop', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Archive Wellness Package/i })[0]);
    fireEvent.click(screen.getByText('Backdrop Close'));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    expect(mockArchivePackage).not.toHaveBeenCalled();
  });

  it('notifies an error and keeps the modal open when archiving fails', async () => {
    mockArchivePackage.mockRejectedValueOnce(new Error('archive failed'));
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Archive Wellness Package/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to archive package' })
      )
    );
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
  });

  // --- Section 5: Imperative handle + card variants ---

  it('opens the add draft at the top via the openAdd handle', () => {
    const ref = React.createRef<PackagesTabHandle>();
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" ref={ref} />);
    act(() => {
      ref.current?.openAdd();
    });
    expect(screen.getByTestId('add-draft')).toBeInTheDocument();
    expect(screen.queryByText('Click to add package')).not.toBeInTheDocument();
  });

  it('does not hydrate when editing a package that already has a breakdown', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Edit Premium Package/i })[0]);
    expect(screen.getByTestId('edit-draft-pkg-2')).toBeInTheDocument();
    expect(mockHydratePackageDetail).not.toHaveBeenCalled();
  });

  it('renders an em dash when a package has no description', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        packages: [{ ...mockPackage, description: '' }],
        archivePackage: mockArchivePackage,
        hydratePackageDetail: mockHydratePackageDetail,
        loadSpecialityCatalog: mockLoadSpecialityCatalog,
        loadedSpecialityIds: ['spec-1:active'],
      })
    );
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    // Both the narrow and the wide layout render the em-dash fallback.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
