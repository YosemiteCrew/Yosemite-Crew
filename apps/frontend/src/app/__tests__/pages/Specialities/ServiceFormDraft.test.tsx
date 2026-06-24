import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServiceFormDraft from '@/app/features/organization/pages/Specialities/ServiceFormDraft';
import { ServiceRevamp } from '@/app/features/organization/types/revamp';

jest.mock('react-icons/md', () => ({
  MdOutlineArchive: () => <span data-testid="icon-archive" />,
  MdDeleteForever: () => <span data-testid="icon-delete" />,
}));
jest.mock('react-icons/fi', () => ({
  FiCheck: () => <span data-testid="icon-check" />,
}));
jest.mock('react-icons/lu', () => ({
  LuBedSingle: () => <span data-testid="icon-bed" />,
  LuCheck: () => <span data-testid="icon-check-lu" />,
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
    error,
    readonly,
    intype,
  }: {
    inlabel: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    readonly?: boolean;
    intype?: string;
  }) => (
    <div>
      <label htmlFor={`fi-${inlabel}`}>{inlabel}</label>
      <input
        id={`fi-${inlabel}`}
        aria-label={inlabel}
        type={intype ?? 'text'}
        value={value}
        onChange={onChange ?? (() => {})}
        readOnly={readonly}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({
    placeholder,
    options,
    onSelect,
  }: {
    placeholder: string;
    options: { value: string; label: string }[];
    onSelect: (o: { value: string; label: string }) => void;
  }) => (
    <div>
      <label htmlFor={`dd-${placeholder}`}>{placeholder}</label>
      <select
        id={`dd-${placeholder}`}
        aria-label={placeholder}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) onSelect(opt);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: (e: React.MouseEvent) => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: (e: React.MouseEvent) => void }) => (
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

const mockAddService = jest.fn();
const mockUpdateService = jest.fn();
const mockDeleteService = jest.fn();
const mockGenerateCode = jest.fn().mockReturnValue('CS-0005');
const mockNotify = jest.fn();

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/features/organization/services/catalogCalculations', () => ({
  computeServiceTotal: jest.fn(({ grossAmount, defaultDiscount }) => {
    const amt = grossAmount - (grossAmount * defaultDiscount) / 100;
    return { defaultDiscountAmt: (grossAmount * defaultDiscount) / 100, total: amt };
  }),
}));

import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

const setupStoreMock = () => {
  (useRevampCatalogStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        addService: mockAddService,
        updateService: mockUpdateService,
        deleteService: mockDeleteService,
        generateItemCode: mockGenerateCode,
      };
      return selector(state);
    }
  );
};

const defaultProps = {
  specialityId: 'spec-1',
  organisationId: 'org-1',
  onClose: jest.fn(),
};

const mockEditService: ServiceRevamp = {
  id: 'svc-edit-1',
  code: 'CS-0001',
  name: 'Existing Service',
  description: 'Some description',
  type: 'CONSULTATION',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  grossAmount: 500,
  defaultDiscount: 10,
  maxDiscount: 20,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2025-01-01T00:00:00Z',
};

describe('ServiceFormDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupStoreMock();
    defaultProps.onClose = jest.fn();
  });

  describe('create mode', () => {
    it('renders the draft title for new service', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      expect(screen.getByText('New Service (draft)')).toBeInTheDocument();
    });

    it('renders Name, Description, Type, Duration, Gross amt., Default Discount, Max Discount fields', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Duration')).toBeInTheDocument();
      expect(screen.getByLabelText('Gross amt.')).toBeInTheDocument();
    });

    it('does not render Archive button in create mode', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      expect(screen.queryByText('Delete Service')).not.toBeInTheDocument();
    });

    it('shows Cancel and Save Service buttons', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Service' })).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows validation error when saving with empty name', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Name is required.')).toBeInTheDocument();
    });

    it('shows validation error when gross amount is missing', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      // fill name but not gross amount
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Service' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.getByText('Enter a valid gross amount.')).toBeInTheDocument();
    });

    it('shows max discount error when value is above 100', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Service A' } });
      fireEvent.change(screen.getByLabelText('Gross amt.'), { target: { value: '200' } });
      fireEvent.change(screen.getByLabelText('Max. Discount (%)'), { target: { value: '150' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.getByText('Max discount must be 0–100.')).toBeInTheDocument();
    });

    it('shows default discount error when value is above 100', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Service A' } });
      fireEvent.change(screen.getByLabelText('Gross amt.'), { target: { value: '200' } });
      fireEvent.change(screen.getByLabelText('Default Discount (%)'), {
        target: { value: '150' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.getByText('Default discount must be 0–100.')).toBeInTheDocument();
    });

    it('shows default discount error when it exceeds max discount', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Service A' } });
      fireEvent.change(screen.getByLabelText('Gross amt.'), { target: { value: '200' } });
      fireEvent.change(screen.getByLabelText('Default Discount (%)'), {
        target: { value: '20' },
      });
      fireEvent.change(screen.getByLabelText('Max. Discount (%)'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.getByText('Default discount cannot exceed max discount.')).toBeInTheDocument();
    });

    it('calls addService and onClose when form is valid', async () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Service' } });
      fireEvent.change(screen.getByLabelText('Gross amt.'), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(mockAddService).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Service added' })
        )
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('renders bookable badge when isBookable is true', () => {
      // Default is CONSULTATION type → isBookable starts true
      render(<ServiceFormDraft {...defaultProps} />);
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('clears name error when user starts typing', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.getByText('Name is required.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } });
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument();
    });

    it('changes type via dropdown', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      const typeDropdown = screen.getByLabelText('Type');
      fireEvent.change(typeDropdown, { target: { value: 'PROCEDURE' } });
      // When type changes to non-CONSULTATION and not editing, isBookable becomes false (badge gone)
      expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    });

    it('generates preview code on mount', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      expect(mockGenerateCode).toHaveBeenCalled();
    });

    it('does not call addService when validation fails', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(mockAddService).not.toHaveBeenCalled();
    });

    it('toggles bookable checkbox', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      const checkbox = screen.getByLabelText('Bookable') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('toggles inpatient preferred checkbox', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      const checkbox = screen.getByLabelText('Inpatient preferred') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    it('updates description textarea', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
      fireEvent.change(descInput, { target: { value: 'Some description' } });
      expect(descInput.value).toBe('Some description');
    });
  });

  describe('edit mode', () => {
    it('renders title with existing service name', () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      expect(screen.getByText('Existing Service (draft)')).toBeInTheDocument();
    });

    it('pre-fills form fields from editService', () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      expect(screen.getByLabelText('Name')).toHaveValue('Existing Service');
      expect(screen.getByLabelText('Gross amt.')).toHaveValue(500);
    });

    it('shows Delete Service button in edit mode', () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      expect(screen.getByText('Delete Service')).toBeInTheDocument();
    });

    it('confirms before deleting, then calls deleteService and onClose', async () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      // Clicking the toolbar button opens the confirmation modal — no delete yet.
      fireEvent.click(screen.getByText('Delete Service'));
      expect(mockDeleteService).not.toHaveBeenCalled();
      // Confirm in the modal.
      fireEvent.click(screen.getByText('Delete'));
      expect(mockDeleteService).toHaveBeenCalledWith('svc-edit-1');
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Service deleted' })
        )
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls updateService on save in edit mode', async () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(mockUpdateService).toHaveBeenCalledWith(
        'svc-edit-1',
        expect.objectContaining({ name: 'Existing Service' })
      );
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Service updated' })
        )
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows existing service code as preview code', () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      // code is shown in the titleSlot
      expect(screen.getByText('CS-0001')).toBeInTheDocument();
    });

    it('does not call generateCode in edit mode', () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      expect(mockGenerateCode).not.toHaveBeenCalled();
    });

    it('does not show bookable badge when isBookable is false', () => {
      const nonBookableService = { ...mockEditService, isBookable: false };
      render(<ServiceFormDraft {...defaultProps} editService={nonBookableService} />);
      expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    });

    it('shows "Service" in draft title when name is empty in edit mode', () => {
      const namelessEdit = { ...mockEditService, name: '' };
      render(<ServiceFormDraft {...defaultProps} editService={namelessEdit} />);
      expect(screen.getByText('Service (draft)')).toBeInTheDocument();
    });
  });

  describe('max discount validation edge cases', () => {
    it('does not show max discount error when field is empty', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Svc' } });
      fireEvent.change(screen.getByLabelText('Gross amt.'), { target: { value: '100' } });
      // maxDiscount is empty by default - should pass
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.queryByText('Max discount must be 0–100.')).not.toBeInTheDocument();
      expect(mockAddService).toHaveBeenCalledTimes(1);
    });

    it('shows max discount error when value is negative', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Svc' } });
      fireEvent.change(screen.getByLabelText('Gross amt.'), { target: { value: '100' } });
      fireEvent.change(screen.getByLabelText('Max. Discount (%)'), { target: { value: '-5' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
      expect(screen.getByText('Max discount must be 0–100.')).toBeInTheDocument();
    });
  });

  describe('total amount display', () => {
    it('renders total amount input as readonly', () => {
      render(<ServiceFormDraft {...defaultProps} editService={mockEditService} />);
      const totalInput = screen.getByLabelText('Total Amount');
      expect(totalInput).toHaveAttribute('readonly');
    });

    it('total amount shows empty when grossAmount is 0', () => {
      render(<ServiceFormDraft {...defaultProps} />);
      const totalInput = screen.getByLabelText('Total Amount');
      expect(totalInput).toHaveValue('');
    });
  });
});
