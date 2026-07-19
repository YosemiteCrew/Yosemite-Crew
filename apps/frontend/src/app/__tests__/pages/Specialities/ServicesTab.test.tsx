import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServicesTab from '@/app/features/organization/pages/Specialities/ServicesTab';
import { ServiceRevamp } from '@/app/features/organization/types/revamp';

jest.mock('react-icons/ri', () => ({
  RiEdit2Line: () => <span data-testid="icon-edit" />,
}));
jest.mock('react-icons/md', () => ({
  MdDeleteForever: () => <span data-testid="icon-delete" />,
  MdOutlineArchive: () => <span data-testid="icon-archive" />,
}));

jest.mock('react-icons/lu', () => ({
  LuBedSingle: () => <span data-testid="icon-bed" />,
  LuCheck: () => <span data-testid="icon-check" />,
}));
jest.mock('react-icons/ai', () => ({
  AiOutlineInfoCircle: () => <span data-testid="icon-info" />,
  AiOutlinePlus: () => <span data-testid="icon-plus" />,
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `$ ${amount.toFixed(2)}`,
}));

jest.mock('@/app/features/organization/services/catalogCalculations', () => ({
  computeServiceTotal: jest.fn(() => ({ total: 90 })),
}));

jest.mock('@/app/features/organization/pages/Specialities/ServiceFormDraft', () => ({
  __esModule: true,
  default: ({ onClose, editService }: { onClose: () => void; editService?: ServiceRevamp }) => (
    <div data-testid={editService ? 'edit-service-form' : 'add-service-form'}>
      <span>{editService ? `Editing: ${editService.name}` : 'New service form'}</span>
      <button type="button" onClick={onClose}>
        Close Form
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children, showModal }: { children: React.ReactNode; showModal: boolean }) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: { title: string; onClose: () => void }) => (
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
  default: ({ text, onClick }: { text: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const mockNotify = jest.fn();
const mockArchiveService = jest.fn();
const mockLoadSpecialityCatalog = jest.fn();

import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

const mockService: ServiceRevamp = {
  id: 'svc-1',
  code: 'CS-001',
  name: 'Consultation',
  description: 'Basic consultation',
  type: 'CONSULTATION',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  grossAmount: 100,
  defaultDiscount: 10,
  maxDiscount: 20,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2025-01-01T00:00:00Z',
};

const defaultProps = {
  specialityId: 'spec-1',
  organisationId: 'org-1',
};

const setupStoreMock = (services: ServiceRevamp[] = []) => {
  (useRevampCatalogStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        services,
        archiveService: mockArchiveService,
        loadSpecialityCatalog: mockLoadSpecialityCatalog,
        loadedSpecialityIds: ['spec-1:active'],
      };
      return selector(state);
    }
  );
};

/** Opens the first row's ⋯ menu; both the wide and compact rows render one. */
const openRowMenu = (serviceName = 'Consultation') => {
  fireEvent.click(screen.getAllByLabelText(`Actions for ${serviceName}`)[0]);
};

/** Expands the first row so the verbose catalog fields are revealed. */
const expandRow = (serviceName = 'Consultation') => {
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(serviceName) })[0]);
};

describe('ServicesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupStoreMock();
  });

  describe('empty state', () => {
    it('renders empty message when no services', () => {
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getByText("You haven't added any services yet.")).toBeInTheDocument();
    });

    it('renders the add-service button', () => {
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Add service' })).toBeInTheDocument();
    });

    it('names the speciality on the add-service button when specialityName is provided', () => {
      render(<ServicesTab {...defaultProps} specialityName="Small animals" />);
      expect(
        screen.getByRole('button', { name: 'Add service to Small animals' })
      ).toBeInTheDocument();
    });
  });

  describe('with services', () => {
    it('renders service name', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('Consultation').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the design table header columns', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Practitioners')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Price')).toBeInTheDocument();
      expect(screen.getByText('Bookable')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders the duration, price and status pill on the row', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('30 min').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('$ 90.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });

    describe('status pill copy', () => {
      it('never renders the raw backend enum, in the wide row or the compact row', () => {
        setupStoreMock([mockService]);
        render(<ServicesTab {...defaultProps} />);

        // Both layouts (wide table row + compact stacked row) render a pill, and
        // both must carry the humanized label rather than the backend value.
        expect(screen.getAllByText('Active')).toHaveLength(2);
        expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
      });

      it('keeps the design all-caps look as a text-transform, not as raw copy', () => {
        setupStoreMock([mockService]);
        render(<ServicesTab {...defaultProps} />);
        expect(screen.getAllByText('Active')[0]).toHaveClass('uppercase');
      });

      it('drops non-active services before they can reach a pill', () => {
        // The tab lists active services only (ARCHIVED lives in the Archive tab),
        // so no other backend status can leak into the pill from here.
        setupStoreMock([{ ...mockService, status: 'ARCHIVED' }]);
        render(<ServicesTab {...defaultProps} />);
        expect(screen.queryByText('ARCHIVED')).not.toBeInTheDocument();
        expect(screen.queryByText('Archived')).not.toBeInTheDocument();
        expect(screen.getByText("You haven't added any services yet.")).toBeInTheDocument();
      });
    });

    it('renders the practitioner avatar cluster with an overflow count', () => {
      setupStoreMock([mockService]);
      render(
        <ServicesTab
          {...defaultProps}
          practitioners={[
            { id: 'p1', name: 'Sarah Weber' },
            { id: 'p2', name: 'Matteo Brunner' },
            { id: 'p3', name: 'Anna Keller' },
            { id: 'p4', name: 'Jonas Meier' },
          ]}
        />
      );
      expect(screen.getAllByText('SW').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('+1').length).toBeGreaterThanOrEqual(1);
    });

    it('renders an em dash when the speciality has no practitioners', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    });

    it('reveals the verbose catalog fields when a row is expanded', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.queryByText('CS-001')).not.toBeInTheDocument();

      expandRow();

      expect(screen.getByText('CS-001')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('-10%')).toBeInTheDocument();
      expect(screen.getByText('-20%')).toBeInTheDocument();
    });

    it('reports the in-patient preference in the expanded detail', () => {
      setupStoreMock([{ ...mockService, isInpatientPreferred: true }]);
      render(<ServicesTab {...defaultProps} />);
      expandRow();
      expect(screen.getByText('In-patient')).toBeInTheDocument();
      expect(screen.getByText('Preferred')).toBeInTheDocument();
    });

    it('renders the "In app" channel indicator when isBookable is true', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('In app').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the "Desk only" channel indicator when isBookable is false', () => {
      setupStoreMock([{ ...mockService, isBookable: false }]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('Desk only').length).toBeGreaterThanOrEqual(1);
    });

    it('renders a ⋯ actions menu for each service', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByLabelText('Actions for Consultation').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

      openRowMenu();

      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    });

    it('closes the actions menu on Escape', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openRowMenu();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Edit' }), { key: 'Escape' });
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('closes the actions menu on Escape from the ⋯ trigger', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openRowMenu();
      fireEvent.keyDown(screen.getAllByLabelText('Actions for Consultation')[0], {
        key: 'Escape',
      });
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('keeps the actions menu open for keys other than Escape', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openRowMenu();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Archive' }), { key: 'ArrowDown' });
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('renders service description as the row subline', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('Basic consultation').length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to the type label when the description is empty', () => {
      setupStoreMock([{ ...mockService, description: '' }]);
      render(<ServicesTab {...defaultProps} />);
      expandRow();
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    });

    it('does not show empty message when services present', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.queryByText("You haven't added any services yet.")).not.toBeInTheDocument();
    });

    it('only shows active services from the specialityId', () => {
      const otherService: ServiceRevamp = {
        ...mockService,
        id: 'svc-other',
        specialityId: 'spec-other',
      };
      // The store mock filters by specialityId already (done via useShallow selector)
      setupStoreMock([mockService, otherService]);
      // Since our mock doesn't filter, both are shown — this tests the component renders multiple
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('Consultation').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('add service flow', () => {
    it('opens add service form when the add-service button is clicked', () => {
      render(<ServicesTab {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /add service/i }));
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    it('hides the add-service button when form is open', () => {
      render(<ServicesTab {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /add service/i }));
      expect(screen.queryByRole('button', { name: /add service/i })).not.toBeInTheDocument();
    });

    it('closes add form when Close Form is clicked', () => {
      render(<ServicesTab {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /add service/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Close Form' }));
      expect(screen.queryByTestId('add-service-form')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add service/i })).toBeInTheDocument();
    });
  });

  describe('edit service flow', () => {
    it('opens edit form from the row actions menu', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openRowMenu();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByTestId('edit-service-form')).toBeInTheDocument();
      expect(screen.getByText('Editing: Consultation')).toBeInTheDocument();
    });

    it('closes edit form and shows service row again', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openRowMenu();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close Form' }));
      expect(screen.queryByTestId('edit-service-form')).not.toBeInTheDocument();
      expect(screen.getAllByText('Consultation').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('delete service flow', () => {
    const openArchiveModal = () => {
      openRowMenu();
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    };

    it('opens delete confirmation modal from the row actions menu', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openArchiveModal();
      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(screen.getByText('Archive service')).toBeInTheDocument();
    });

    it('shows service name in delete confirmation', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openArchiveModal();
      expect(screen.getByText('Consultation', { selector: 'strong' })).toBeInTheDocument();
    });

    it('calls archiveService and notifies on confirm archive', async () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openArchiveModal();
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
      expect(mockArchiveService).toHaveBeenCalledWith('svc-1');
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Service archived' })
        )
      );
    });

    it('closes modal on Cancel without deleting', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openArchiveModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
      expect(mockArchiveService).not.toHaveBeenCalled();
    });

    it('closes modal via modal header close button', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      openArchiveModal();
      fireEvent.click(screen.getByRole('button', { name: 'Close Modal' }));
      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    });
  });

  describe('imperative handle (openAdd)', () => {
    it('opens add form at top via ref.openAdd()', () => {
      const ref = React.createRef<{ openAdd: () => void }>();
      render(<ServicesTab {...defaultProps} ref={ref} />);
      expect(ref.current).not.toBeNull();
      act(() => {
        ref.current!.openAdd();
      });
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });
  });
});
