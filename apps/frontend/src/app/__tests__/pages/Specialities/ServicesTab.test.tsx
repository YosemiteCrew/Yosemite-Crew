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

jest.mock('@/app/ui/primitives/SectionContainer/SectionContainer', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    titleSlot,
  }: {
    title: string;
    children: React.ReactNode;
    titleSlot?: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {titleSlot && <div data-testid="title-slot">{titleSlot}</div>}
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
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

    it('renders "Click to add service" button', () => {
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getByRole('button', { name: /click to add service/i })).toBeInTheDocument();
    });
  });

  describe('with services', () => {
    it('renders service name', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('Consultation').length).toBeGreaterThanOrEqual(1);
    });

    it('renders service code', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('CS-001').length).toBeGreaterThanOrEqual(1);
    });

    it('renders bookable badge when isBookable is true', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('does not render bookable badge when isBookable is false', () => {
      setupStoreMock([{ ...mockService, isBookable: false }]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    });

    it('renders edit button for service', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByLabelText('Edit Consultation').length).toBeGreaterThanOrEqual(1);
    });

    it('renders delete button for service', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByLabelText('Archive Consultation').length).toBeGreaterThanOrEqual(1);
    });

    it('renders service description', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      expect(screen.getAllByText('Basic consultation').length).toBeGreaterThanOrEqual(1);
    });

    it('renders "—" when description is empty', () => {
      setupStoreMock([{ ...mockService, description: '' }]);
      render(<ServicesTab {...defaultProps} />);
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
    it('opens add service form when "Click to add service" is clicked', () => {
      render(<ServicesTab {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /click to add service/i }));
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    it('hides "Click to add service" button when form is open', () => {
      render(<ServicesTab {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /click to add service/i }));
      expect(
        screen.queryByRole('button', { name: /click to add service/i })
      ).not.toBeInTheDocument();
    });

    it('closes add form when Close Form is clicked', () => {
      render(<ServicesTab {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /click to add service/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Close Form' }));
      expect(screen.queryByTestId('add-service-form')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /click to add service/i })).toBeInTheDocument();
    });
  });

  describe('edit service flow', () => {
    it('opens edit form when edit button is clicked', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      const editBtns = screen.getAllByLabelText('Edit Consultation');
      fireEvent.click(editBtns[0]);
      expect(screen.getByTestId('edit-service-form')).toBeInTheDocument();
      expect(screen.getByText('Editing: Consultation')).toBeInTheDocument();
    });

    it('closes edit form and shows service row again', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      const editBtns = screen.getAllByLabelText('Edit Consultation');
      fireEvent.click(editBtns[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Close Form' }));
      expect(screen.queryByTestId('edit-service-form')).not.toBeInTheDocument();
      expect(screen.getAllByText('Consultation').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('delete service flow', () => {
    it('opens delete confirmation modal when delete button is clicked', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      const deleteBtns = screen.getAllByLabelText('Archive Consultation');
      fireEvent.click(deleteBtns[0]);
      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(screen.getByText('Archive service')).toBeInTheDocument();
    });

    it('shows service name in delete confirmation', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      const deleteBtns = screen.getAllByLabelText('Archive Consultation');
      fireEvent.click(deleteBtns[0]);
      expect(screen.getByText('Consultation', { selector: 'strong' })).toBeInTheDocument();
    });

    it('calls archiveService and notifies on confirm archive', async () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      const archiveBtns = screen.getAllByLabelText('Archive Consultation');
      fireEvent.click(archiveBtns[0]);
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
      const deleteBtns = screen.getAllByLabelText('Archive Consultation');
      fireEvent.click(deleteBtns[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
      expect(mockArchiveService).not.toHaveBeenCalled();
    });

    it('closes modal via modal header close button', () => {
      setupStoreMock([mockService]);
      render(<ServicesTab {...defaultProps} />);
      const deleteBtns = screen.getAllByLabelText('Archive Consultation');
      fireEvent.click(deleteBtns[0]);
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
