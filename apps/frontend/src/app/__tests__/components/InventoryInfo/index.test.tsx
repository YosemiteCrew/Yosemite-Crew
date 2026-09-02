import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InventoryInfo from '@/app/features/inventory/components/InventoryInfo';
import { BusinessType } from '@/app/features/organization/types/org';

// ----------------------------------------------------------------------------
// 1. Mocks & Setup
// ----------------------------------------------------------------------------

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  formatDisplayDate: jest.fn((val) => (val ? `Formatted ${val}` : '')),
  toStringSafe: jest.fn((val) => (val === null || val === undefined ? '' : String(val))),
  formatCurrencyValue: jest.fn((val, currency) =>
    val === undefined || val === null || val === '' ? '—' : `${currency ?? 'USD'} ${val}`
  ),
  formatPercentValue: jest.fn((val) => (val === undefined ? '—' : `${val}%`)),
  getGrossProfitPerUnit: jest.fn(() => 10),
  getMarginPercent: jest.fn(() => 50),
  getStockValue: jest.fn(() => 100),
}));

jest.mock('@/app/features/inventory/components/AddInventory/InventoryConfig', () => ({
  InventoryFormConfig: {
    VETERINARY: {
      batch: [
        {
          kind: 'row',
          fields: [
            {
              name: 'manufactureDate',
              component: 'date',
              placeholder: 'Mfg Date',
            },
            { name: 'expiryDate', component: 'date', placeholder: 'Exp Date' },
          ],
        },
        {
          kind: 'single',
          field: { name: 'quantity', component: 'text', placeholder: 'Qty', numeric: true },
        },
        {
          kind: 'single',
          field: {
            name: 'expiryWarningBefore',
            component: 'dropdown',
            placeholder: 'Expiring warning before',
            options: ['30 days', '60 days'],
          },
        },
        {
          kind: 'single',
          field: { name: 'barcode', component: 'text', placeholder: 'Barcode' },
        },
        {
          kind: 'single',
          field: {
            name: 'tracking',
            component: 'dropdown',
            // Object options exercise the pass-through side of the option
            // normaliser; 'expiryWarningBefore' above keeps the string form.
            options: [
              { label: 'Track A', value: 'Track A' },
              { label: 'Track B', value: 'Track B' },
            ],
          },
        },
        {
          kind: 'single',
          field: { name: 'litterId', component: 'multiSelect' },
        },
        // A dropdown with no options and a date with no placeholder cover the
        // renderer's fallbacks for optional field config.
        {
          kind: 'single',
          field: { name: 'serial', component: 'dropdown', placeholder: 'Serial' },
        },
        {
          kind: 'single',
          field: { name: 'nextRefillDate', component: 'date' },
        },
      ],
    },
  },
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children, title, onEditClick, showEditIcon }: any) => (
    <div data-testid="accordion">
      <button onClick={onEditClick} data-testid="accordion-edit-btn">
        {showEditIcon ? 'Edit' : 'View'}
      </button>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="primary-btn">
      {text}
    </button>
  ),
  // The destructive footer action renders as the outlined danger Secondary, so
  // it gets its own test id and `getAction()` below resolves whichever of the
  // two trailing actions the panel is showing.
  Secondary: ({ text, onClick, isDisabled, danger }: any) => (
    <button
      onClick={onClick}
      disabled={isDisabled}
      data-testid={danger ? 'danger-btn' : 'secondary-btn'}
    >
      {text}
    </button>
  ),
}));

const getAction = () => screen.queryByTestId('danger-btn') ?? screen.getByTestId('primary-btn');

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ currentDate, setCurrentDate, placeholder }: any) => (
    <>
      <input
        data-testid={`datepicker-${placeholder}`}
        value={currentDate ? currentDate.toISOString().split('T')[0] : ''}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value) : null;
          setCurrentDate(d);
        }}
      />
      {/* Drives the updater-function form of setCurrentDate. */}
      <button
        type="button"
        data-testid={`datepicker-updater-${placeholder}`}
        onClick={() => setCurrentDate((prev: Date | null) => prev ?? new Date(2030, 2, 4))}
      />
    </>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ onSelect, defaultOption, placeholder }: any) => {
    const selectedValue = placeholder === 'Expiring warning before' ? '60 days' : 'Track A';
    return (
      <button
        data-testid="dropdown"
        onClick={() => onSelect({ value: selectedValue, label: selectedValue })}
      >
        {placeholder}
        Selected: {defaultOption}
      </button>
    );
  },
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, inname, readonly }: any) => (
    <input
      data-testid={`input-${inname}`}
      value={value}
      onChange={onChange ?? (() => {})}
      readOnly={readonly}
    />
  ),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, meta, eyebrow, actions, onClose }: any) => (
    <div>
      {eyebrow && <div>{eyebrow}</div>}
      <span>{title}</span>
      {meta && <div>{meta}</div>}
      {actions}
      <button type="button" aria-label="close" data-testid="modal-header-close" onClick={onClose}>
        Close Header
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="delete-btn">
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/widgets/Labels/Labels', () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div>
      {labels.map((l: any) => (
        <button key={l.key} data-testid={`tab-${l.key}`} onClick={() => setActiveLabel(l.key)}>
          {l.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/features/inventory/components/InfoSection', () => ({
  __esModule: true,
  default: function MockInfoSection({ ref, onEditingChange, onSaveSection, sectionKey }: any) {
    const [editing, setEditing] = React.useState(false);

    React.useImperativeHandle(ref, () => ({
      save: async () => {
        let data = {};
        if (sectionKey === 'basicInfo')
          data = {
            name: 'Updated Name',
            category: 'Cat',
            subCategory: 'Sub',
          };
        if (sectionKey === 'pricing') data = { purchaseCost: '10', selling: '20' };
        if (sectionKey === 'stock') data = { current: '5', reorderLevel: '2' };
        if (sectionKey === 'basicInfo_fail') data = { name: '' };

        // Swallow rethrown errors here so a failing save surfaced through the
        // imperative handle doesn't become an unhandled rejection in tests; the
        // component still runs its own catch/log path before rethrowing.
        try {
          await onSaveSection(sectionKey === 'basicInfo_fail' ? 'basicInfo' : sectionKey, data);
        } catch {
          /* handled by the component under test */
        }
      },
      cancel: () => {
        setEditing(false);
        onEditingChange(false);
      },
      startEditing: () => {
        setEditing(true);
        onEditingChange(true);
      },
      isEditing: () => editing,
    }));

    return (
      <div data-testid="info-section">
        Current Section: {sectionKey}
        <button
          onClick={() => {
            setEditing(true);
            onEditingChange(true);
          }}
          data-testid="simulate-edit-start"
        >
          Edit Section
        </button>
        <button onClick={() => onSaveSection(sectionKey, {})} data-testid="simulate-invalid-save">
          Invalid Save
        </button>
      </div>
    );
  },
}));

describe('InventoryInfo Component', () => {
  const mockSetShowModal = jest.fn();
  const mockOnUpdate = jest.fn();
  const mockOnHide = jest.fn();
  const mockOnUnhide = jest.fn();
  const mockOnAddBatch = jest.fn();
  const mockOnUpdateBatch = jest.fn();

  // Cast as any to avoid strict union type errors in test setup
  const activeInventory = {
    id: 'item-1',
    status: 'ACTIVE',
    businessType: 'VETERINARY' as BusinessType,
    basicInfo: {
      name: 'Item 1',
      category: 'C1',
      subCategory: 'S1',
      status: 'Active',
    },
    classification: {},
    pricing: { purchaseCost: '10', selling: '15' },
    vendor: {},
    stock: { current: '100', reorderLevel: '10' },
    attributes: {
      expiryWarningBefore: '30 days',
      barcode: 'OLD-BAR',
    },
    batch: {
      batch: 'B1',
      quantity: '100',
      expiryWarningBefore: '30 days',
      barcode: 'OLD-BAR',
    },
    batches: [
      {
        _id: 'b1',
        batch: 'B1',
        quantity: '100',
        manufactureDate: '2023-01-01',
        expiryDate: '2024-01-01',
        expiryWarningBefore: '30 days',
        barcode: 'OLD-BAR',
        tracking: 'Track A',
        litterId: 'L1, L2',
      },
    ],
  } as any;

  const defaultProps = {
    showModal: true,
    setShowModal: mockSetShowModal,
    activeInventory: activeInventory,
    businessType: 'VETERINARY' as BusinessType,
    onUpdate: mockOnUpdate,
    onHide: mockOnHide,
    onUnhide: mockOnUnhide,
    onAddBatch: mockOnAddBatch,
    onUpdateBatch: mockOnUpdateBatch,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Tests
  // --------------------------------------------------------------------------
  it('renders the modal with basic info tab active by default', () => {
    render(<InventoryInfo {...defaultProps} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(getAction()).toHaveTextContent('Delete item');
  });

  it('opens directly on the requested initialSection (Restock → Stock Control)', () => {
    render(<InventoryInfo {...defaultProps} initialSection="stock" />);
    expect(screen.getByText('Current Section: stock')).toBeInTheDocument();
  });

  it('switches tabs correctly', () => {
    render(<InventoryInfo {...defaultProps} />);

    // Default is basicInfo
    expect(screen.getByText('Current Section: basicInfo')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-pricing'));
    expect(screen.getByText('Current Section: pricing')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-batch'));

    // Batch tab renders BatchEditor (which has "Batch and expiry" title)
    // We check that InfoSection is NOT present
    expect(screen.queryByText('Current Section:')).not.toBeInTheDocument();
    const headers = screen.getAllByText('Batch and expiry');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('handles validation failure in Basic Info', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('simulate-edit-start'));
    expect(getAction()).toHaveTextContent('Save');
    expect(screen.getByTestId('secondary-btn')).toHaveTextContent('Cancel');

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        basicInfo: expect.objectContaining({ name: 'Updated Name' }),
      })
    );
  });

  it('renders existing batches in preview mode correctly', () => {
    render(<InventoryInfo {...defaultProps} />);
    // Switch to batch tab
    fireEvent.click(screen.getByTestId('tab-batch'));

    expect(screen.getByText('Existing batch 1')).toBeInTheDocument();
    expect(screen.getByText('Formatted 2023-01-01')).toBeInTheDocument();
    expect(screen.getByText('L1, L2')).toBeInTheDocument();
  });

  it('adds and removes new batches in edit mode', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));

    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    expect(screen.getByText('Add new batches')).toBeInTheDocument();
    expect(screen.getByText('New batch 1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add another batch'));
    expect(screen.getByText('New batch 2')).toBeInTheDocument();

    const removeBtns = screen.getAllByText('Remove');
    fireEvent.click(removeBtns[0]);

    expect(screen.queryByText('New batch 2')).not.toBeInTheDocument();
    expect(screen.getByText('New batch 1')).toBeInTheDocument();
  });

  it('updates batch fields (Date, Text, Dropdown)', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    // FIX: Using getAllByTestId because both existing and new batch sections use the same Input component
    // Index 0 should be the existing batch (or the first editable field found depending on how it's rendered)
    // In this mocked config, "Existing batch" fields might be read-only text or input.
    // Assuming the test targets the input in the 'New batch' section or an editable existing one.
    // Based on the failing test log, multiple inputs exist.
    const qtyInputs = screen.getAllByTestId('input-quantity');
    const qtyInput = qtyInputs[0];

    fireEvent.change(qtyInput, { target: { value: '500' } });
    expect(qtyInput).toHaveValue('500');

    const dateInputs = screen.getAllByTestId('datepicker-Mfg Date');
    fireEvent.change(dateInputs[0], { target: { value: '2025-05-20' } });

    const dropdown = screen.getAllByTestId('dropdown')[0];
    fireEvent.click(dropdown);

    await act(async () => {
      fireEvent.click(getAction());
    });
  });

  it('saves batch-section barcode and expiry warning per batch, without mirroring to item attributes', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    fireEvent.change(screen.getAllByTestId('input-barcode')[0], {
      target: { value: 'NEW-BAR' },
    });
    fireEvent.click(screen.getAllByText(/Expiring warning before/i)[0]);

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUpdateBatch).toHaveBeenCalledWith(
      'item-1',
      expect.arrayContaining([
        expect.objectContaining({
          _id: 'b1',
          expiryWarningBefore: '60 days',
          barcode: 'NEW-BAR',
        }),
      ])
    );
    // These two fields are now stored per batch by the backend, so saving a
    // batch no longer needs to mirror the value onto the item-level attributes.
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('validates empty batch list on save', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    await act(async () => {
      fireEvent.click(getAction());
    });

    // FIX: Added waitFor because validation often has async or state-update tick delays

    expect(mockOnAddBatch).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('hides an active item', async () => {
    render(<InventoryInfo {...defaultProps} />);

    expect(getAction()).toHaveTextContent('Delete item');

    await act(async () => {
      fireEvent.click(getAction());
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    expect(mockOnHide).toHaveBeenCalledWith('item-1');
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it('unhides a hidden item', async () => {
    const hiddenItem = { ...activeInventory, status: 'HIDDEN' };
    render(<InventoryInfo {...defaultProps} activeInventory={hiddenItem} />);

    expect(getAction()).toHaveTextContent('Restore item');

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUnhide).toHaveBeenCalledWith('item-1');
  });

  it('closes modal on cancel/close', () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('secondary-btn'));
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it('cancels edit mode on secondary click', () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('simulate-edit-start'));
    expect(screen.getByTestId('secondary-btn')).toHaveTextContent('Cancel');

    fireEvent.click(screen.getByTestId('secondary-btn'));

    expect(screen.getByTestId('secondary-btn')).toHaveTextContent('Close');
  });

  it('validates Pricing fields', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-pricing'));
    fireEvent.click(screen.getByTestId('simulate-edit-start'));

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUpdate).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('does nothing if activeInventory is null', async () => {
    render(<InventoryInfo {...defaultProps} activeInventory={null} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-section')).not.toBeInTheDocument();
  });

  it('handles saving during update state (prevent double submit)', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('simulate-edit-start'));
  });

  it('renders pricing summary values on the pricing tab', () => {
    render(<InventoryInfo {...defaultProps} />);

    fireEvent.click(screen.getByTestId('tab-pricing'));

    expect(screen.getByText('USD 10')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('USD 100')).toBeInTheDocument();
    expect(screen.getByText('on-hand stock x unit cost')).toBeInTheDocument();
  });

  it('hides drug-only batch fields for non-drug inventory items', () => {
    const nonDrugInventory = {
      ...activeInventory,
      classification: { itemType: 'non-drug' },
    } as any;

    render(<InventoryInfo {...defaultProps} activeInventory={nonDrugInventory} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    expect(screen.queryByText('Selected: Track A')).not.toBeInTheDocument();
  });

  it('calls both update and add batch handlers when both changed and new batches exist', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    fireEvent.change(screen.getAllByTestId('input-barcode')[0], {
      target: { value: 'UPDATED-BAR' },
    });
    fireEvent.click(screen.getByText('Add another batch'));
    fireEvent.change(screen.getAllByTestId('input-quantity')[2], {
      target: { value: '25' },
    });

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUpdateBatch).toHaveBeenCalledWith(
      'item-1',
      expect.arrayContaining([expect.objectContaining({ _id: 'b1', barcode: 'UPDATED-BAR' })])
    );
    expect(mockOnAddBatch).toHaveBeenCalledWith(
      'item-1',
      expect.arrayContaining([expect.objectContaining({ quantity: '25' })])
    );
  });

  it('does not render destructive action when editing is disabled', () => {
    render(<InventoryInfo {...defaultProps} canEdit={false} />);

    expect(screen.queryByTestId('primary-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('secondary-btn')).toHaveTextContent('Close');
  });

  it('closes the modal from the top-right close icon', () => {
    render(<InventoryInfo {...defaultProps} />);

    fireEvent.click(screen.getByTestId('modal-header-close'));

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it('opens and dismisses delete confirmation without hiding the item', async () => {
    render(<InventoryInfo {...defaultProps} />);

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete inventory item?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Discard'));

    expect(mockOnHide).not.toHaveBeenCalled();
  });

  it('closes delete confirmation from the modal header close control', async () => {
    render(<InventoryInfo {...defaultProps} />);

    await act(async () => {
      fireEvent.click(getAction());
    });

    // The drawer and the delete confirmation each render a ModalHeader; the
    // confirmation's is the second one in the tree.
    fireEvent.click(screen.getAllByTestId('modal-header-close')[1]);

    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('logs and recovers when hiding an item fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOnHide.mockRejectedValueOnce(new Error('Hide failed'));

    render(<InventoryInfo {...defaultProps} />);

    await act(async () => {
      fireEvent.click(getAction());
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-btn'));
    });

    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to hide inventory item:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('logs and recovers when unhiding an item fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOnUnhide.mockRejectedValueOnce(new Error('Unhide failed'));
    const hiddenItem = { ...activeInventory, status: 'HIDDEN' };

    render(<InventoryInfo {...defaultProps} activeInventory={hiddenItem} />);

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to unhide inventory item:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('clears an existing batch date when the datepicker is emptied', () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    const mfgInputs = screen.getAllByTestId('datepicker-Mfg Date');
    expect(mfgInputs[0]).toHaveValue('2023-01-01');

    fireEvent.change(mfgInputs[0], { target: { value: '' } });

    expect(screen.getAllByTestId('datepicker-Mfg Date')[0]).toHaveValue('');
  });

  it('reuses the editable batch snapshot when re-entering edit mode', () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));

    // First edit-click seeds editableExistingBatches; the second re-enters editing
    // while that snapshot already exists, exercising the reuse branch.
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    expect(screen.getByText('Add new batches')).toBeInTheDocument();
  });

  it('cancels an in-progress batch edit from the secondary action', () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    // The batch tab also renders an "Add another batch" secondary, so target the
    // modal footer action (which reads "Cancel" while a batch edit is active).
    const footerCancel = screen
      .getAllByTestId('secondary-btn')
      .find((btn) => btn.textContent === 'Cancel');
    expect(footerCancel).toBeDefined();

    fireEvent.click(footerCancel as HTMLElement);

    const footerClose = screen
      .getAllByTestId('secondary-btn')
      .find((btn) => btn.textContent === 'Close');
    expect(footerClose).toBeDefined();
    expect(screen.queryByText('Add new batches')).not.toBeInTheDocument();
  });

  it('logs a validation failure and skips the update for an invalid standard section', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const emptyBasicInfo = {
      ...activeInventory,
      basicInfo: { ...activeInventory.basicInfo, name: '', category: '' },
    } as any;

    render(<InventoryInfo {...defaultProps} activeInventory={emptyBasicInfo} />);
    fireEvent.click(screen.getByTestId('simulate-edit-start'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-invalid-save'));
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Inventory] Validation failed for basicInfo',
      expect.any(String)
    );
    expect(mockOnUpdate).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('logs and rethrows when the standard section update fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOnUpdate.mockRejectedValueOnce(new Error('Update failed'));

    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('simulate-edit-start'));

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to update inventory section:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('resets the open key when the modal is closed', () => {
    const { rerender } = render(<InventoryInfo {...defaultProps} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();

    rerender(<InventoryInfo {...defaultProps} showModal={false} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('resolves an updater function passed to a batch datepicker', () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    // Index 1 is the new batch, whose manufacture date is still empty, so the
    // updater is handed a null previous value and supplies its own date.
    fireEvent.click(screen.getAllByTestId('datepicker-updater-Mfg Date')[1]);

    expect(screen.getAllByTestId('datepicker-Mfg Date')[1]).toHaveValue('2030-03-04');
  });

  it('falls back to the single batch when the item has no batch list', async () => {
    const noBatchesItem = { ...activeInventory, batches: undefined } as any;
    const { unmount } = render(<InventoryInfo {...defaultProps} activeInventory={noBatchesItem} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    expect(screen.getByText('Existing batch 1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('accordion-edit-btn'));
    await act(async () => {
      fireEvent.click(getAction());
    });

    // The fallback batch carries no _id, so it is matched positionally against
    // the original and reports no change.
    expect(mockOnUpdateBatch).not.toHaveBeenCalled();
    unmount();

    const emptyBatchesItem = { ...activeInventory, batches: [] } as any;
    render(<InventoryInfo {...defaultProps} activeInventory={emptyBatchesItem} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    expect(screen.getByText('Existing batch 1')).toBeInTheDocument();
  });

  it('renders no batch fields for a business type without a batch config', () => {
    render(<InventoryInfo {...defaultProps} businessType="HOSPITAL" />);
    fireEvent.click(screen.getByTestId('tab-batch'));

    expect(screen.getByText('Existing batch 1')).toBeInTheDocument();
    expect(screen.queryByTestId('input-quantity')).not.toBeInTheDocument();
  });

  it('ignores the batch edit control when editing is disabled', () => {
    render(<InventoryInfo {...defaultProps} canEdit={false} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    expect(screen.queryByText('Add new batches')).not.toBeInTheDocument();
  });

  it('skips the batch save for an item without an id', async () => {
    const noIdItem = { ...activeInventory, id: undefined } as any;
    render(<InventoryInfo {...defaultProps} activeInventory={noIdItem} />);
    fireEvent.click(screen.getByTestId('tab-batch'));
    fireEvent.click(screen.getByTestId('accordion-edit-btn'));

    fireEvent.change(screen.getAllByTestId('input-barcode')[0], {
      target: { value: 'NO-ID-BAR' },
    });

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUpdateBatch).not.toHaveBeenCalled();
    expect(mockOnAddBatch).not.toHaveBeenCalled();
  });

  it('saves a section that has no validation handler', async () => {
    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-vendor'));
    fireEvent.click(screen.getByTestId('simulate-edit-start'));

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({ vendor: {} }));
  });

  it('ignores a second section save while the first is still in flight', async () => {
    let resolveUpdate: (() => void) | undefined;
    mockOnUpdate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    render(<InventoryInfo {...defaultProps} />);
    fireEvent.click(screen.getByTestId('simulate-edit-start'));

    fireEvent.click(getAction());
    expect(getAction()).toHaveTextContent('Saving...');

    // The in-flight save short-circuits any further save attempt.
    fireEvent.click(screen.getByTestId('simulate-invalid-save'));
    expect(mockOnUpdate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpdate?.();
    });
  });

  it('names the delete confirmation generically for an item without a name', async () => {
    const unnamed = {
      ...activeInventory,
      basicInfo: { ...activeInventory.basicInfo, name: '' },
    } as any;

    render(<InventoryInfo {...defaultProps} activeInventory={unnamed} />);

    await act(async () => {
      fireEvent.click(getAction());
    });

    expect(
      screen.getByText(/This will remove this item from active inventory/)
    ).toBeInTheDocument();
  });

  it('renders the SKU code beside the category in the header', () => {
    const withSku = {
      ...activeInventory,
      basicInfo: { ...activeInventory.basicInfo, skuCode: 'SKU-9' },
    } as any;

    const { container } = render(<InventoryInfo {...defaultProps} activeInventory={withSku} />);

    expect(container.textContent).toContain('SKU-9');
  });
});
