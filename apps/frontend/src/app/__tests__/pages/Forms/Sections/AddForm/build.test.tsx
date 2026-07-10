import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import Build from '@/app/features/forms/pages/Forms/Sections/AddForm/Build';
import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import { ensureSingleSignatureAtEnd } from '@/app/lib/forms';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, inname }: any) => (
    <input data-testid={inname || 'form-input'} value={value || ''} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ options, onChange, value, placeholder }: any) => (
    <div>
      <div>{placeholder}</div>
      <div data-testid="multi-select-value">{(value || []).join(',')}</div>
      {(options || []).map((opt: any) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange([...(value || []), opt.value])}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

// The builder now uses the reusable searchable LabelDropdown (defaultOption +
// onSelect(option)) for the medicine picker and the task/medicine card option
// dropdowns. The mock renders each option with role="option" (always visible) and
// tags the medicine picker wrapper with a testid for the existing assertions.
jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ options, onSelect, placeholder }: any) => (
    <div
      data-testid={
        String(placeholder).toLowerCase().includes('medicine') ? 'medicine-dropdown' : undefined
      }
    >
      <div>{placeholder}</div>
      {(options || []).map((opt: any) => (
        <button
          key={opt.value}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper', () => ({
  __esModule: true,
  // Real context so Build's <StructureLockContext.Provider> renders; the stub wrapper
  // below ignores the lock (BuilderWrapper's own lock behaviour is covered in its own test).
  StructureLockContext: jest.requireActual('react').createContext(false),
  default: ({
    field,
    onDelete,
    onMoveUp,
    onMoveDown,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    draggable,
    children,
  }: any) => (
    <section
      aria-label={`${field.type.charAt(0).toUpperCase()}${field.type.slice(1)} field`}
      data-testid={`wrapper-${field.id}`}
      data-draggable={draggable ? 'true' : undefined}
      // Forward Build's drag handlers so reorder/auto-scroll logic is exercisable.
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {onMoveUp ? (
        <button type="button" title="Move up" onClick={onMoveUp}>
          up
        </button>
      ) : null}
      {onMoveDown ? (
        <button type="button" title="Move down" onClick={onMoveDown}>
          down
        </button>
      ) : null}
      <button type="button" aria-label={`delete-${field.id}`} onClick={onDelete}>
        delete
      </button>
      {children}
    </section>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextBuilder', () => ({
  __esModule: true,
  default: ({ field }: any) => <div data-testid={`builder-${field.id}`}>text-builder</div>,
}));

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Input/InputBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div data-testid={`builder-${field.id}`}>input-builder</div>,
  })
);

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Dropdown/DropdownBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div data-testid={`builder-${field.id}`}>dropdown-builder</div>,
  })
);

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Signature/SignatureBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div data-testid={`builder-${field.id}`}>signature-builder</div>,
  })
);

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Boolean/BooleanBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div data-testid={`builder-${field.id}`}>boolean-builder</div>,
  })
);

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/Date/DateBuilder', () => ({
  __esModule: true,
  default: ({ field }: any) => <div data-testid={`builder-${field.id}`}>date-builder</div>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector: any) => selector({ primaryOrgId: undefined })),
}));

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/lib/forms', () => ({
  ...jest.requireActual('@/app/lib/forms'),
  ensureSingleSignatureAtEnd: jest.fn((schema) => schema),
  hasSignatureField: jest.fn((schema) =>
    (schema || []).some((f: any) => f && f.type === 'signature')
  ),
}));

jest.mock('react-icons/io', () => ({
  IoIosAddCircleOutline: ({ onClick }: any) => (
    <button type="button" aria-label="toggle-add-field" onClick={onClick}>
      +
    </button>
  ),
  IoIosWarning: () => <span data-testid="warning-icon">!</span>,
}));

const baseFormData = (overrides: Partial<FormsProps> = {}): FormsProps => ({
  name: 'Test form',
  description: '',
  category: 'Custom',
  usage: 'Internal',
  requiredSigner: '',
  updatedBy: 'user-1',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  schema: [],
  ...overrides,
});

let capturedValidator: (() => boolean) | undefined;

const renderBuild = (
  initialFormData: FormsProps,
  serviceOptions: Array<{ label: string; value: string }> = [
    { label: 'Checkup', value: 'svc-1' },
    { label: 'Vaccination', value: 'svc-2' },
  ]
) => {
  const Wrapper = () => {
    const [formData, setFormData] = React.useState<FormsProps>(initialFormData);

    return (
      <>
        <Build
          formData={formData}
          setFormData={setFormData}
          onNext={jest.fn()}
          serviceOptions={serviceOptions}
          registerValidator={(fn) => {
            capturedValidator = fn;
          }}
        />
        <pre data-testid="schema-state">{JSON.stringify(formData.schema)}</pre>
      </>
    );
  };

  return render(<Wrapper />);
};

const readSchema = (): FormField[] =>
  JSON.parse(screen.getByTestId('schema-state').textContent || '[]') as FormField[];

const selectAddOption = (optionLabel: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: optionLabel })[0]);
};

describe('Build form step', () => {
  beforeEach(() => {
    capturedValidator = undefined;
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: undefined })
    );
    (fetchInventoryItems as jest.Mock).mockResolvedValue([]);

    let counter = 0;
    jest.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
      counter += 1;
      return `field-${counter}`;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers validator and fails validation when no fields are present', () => {
    renderBuild(baseFormData());

    expect(capturedValidator).toBeDefined();
    let result = true;
    act(() => {
      result = Boolean(capturedValidator?.());
    });
    expect(result).toBe(false);
    expect(screen.getByText('Add at least one field to continue.')).toBeInTheDocument();
  });

  it('passes validation once at least one field exists', () => {
    renderBuild(baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField] }));

    let result = false;
    act(() => {
      result = Boolean(capturedValidator?.());
    });
    expect(result).toBe(true);
    expect(screen.queryByText('Add at least one field to continue.')).not.toBeInTheDocument();
  });

  it('adds a short text field to schema', () => {
    renderBuild(baseFormData());

    selectAddOption('Short Text');

    const schema = readSchema();
    expect(schema).toHaveLength(1);
    expect(schema[0].type).toBe('input');
    expect(schema[0].id).toBe('field-1');
  });

  it('hides signature option when signed-by is not selected', () => {
    renderBuild(baseFormData({ requiredSigner: '' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[0]);
    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('allows one signature field and blocks duplicate signatures', () => {
    renderBuild(baseFormData({ requiredSigner: 'CLIENT' }));

    selectAddOption('Signature');
    expect(readSchema().filter((field) => field.type === 'signature')).toHaveLength(1);

    selectAddOption('Signature');
    expect(readSchema().filter((field) => field.type === 'signature')).toHaveLength(1);
    expect(screen.getByText('Only one signature field is allowed per form.')).toBeInTheDocument();
  });

  it('hides signature fields for SOAP templates', () => {
    renderBuild(baseFormData({ category: 'SOAP', requiredSigner: 'CLIENT' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[0]);

    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('uses ensureSingleSignatureAtEnd for Prescription forms', () => {
    renderBuild(baseFormData({ category: 'Prescription', requiredSigner: 'CLIENT' }));

    selectAddOption('Signature');

    expect(ensureSingleSignatureAtEnd).toHaveBeenCalledTimes(1);
    expect(readSchema().some((field) => field.type === 'signature')).toBe(true);
  });

  it('adds a service group with a generated checkbox field', () => {
    renderBuild(baseFormData());

    selectAddOption('Services / Packages');

    const schema = readSchema();
    expect(schema).toHaveLength(1);
    expect(schema[0].type).toBe('group');
    expect((schema[0] as any).meta?.serviceGroup).toBe(true);
    expect((schema[0] as any).fields?.some((f: FormField) => f.type === 'checkbox')).toBe(true);
  });

  it('adds medications inside treatment_plan group when it exists', () => {
    const treatmentPlan: FormField = {
      id: 'treatment_plan',
      type: 'group',
      label: 'Treatment plan',
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [treatmentPlan] }));

    selectAddOption('Medications');

    const schema = readSchema();
    expect(schema).toHaveLength(1);
    const updatedTreatment = schema[0] as FormField & { fields?: FormField[] };
    expect(updatedTreatment.fields).toHaveLength(1);
    expect(updatedTreatment.fields?.[0].label).toBe('Medication 1');
    expect((updatedTreatment.fields?.[0] as any).meta?.medicationGroup).toBe(true);
  });

  it('prevents deleting signature when signer is required', () => {
    const signatureField: FormField = {
      id: 'sig-1',
      type: 'signature',
      label: 'Signature',
    } as FormField;

    renderBuild(baseFormData({ requiredSigner: 'CLIENT', schema: [signatureField] }));

    const signatureSection = screen.getByLabelText('Signature field');
    fireEvent.click(within(signatureSection).getByRole('button', { name: 'delete-sig-1' }));

    expect(readSchema()).toHaveLength(1);
    expect(
      screen.getByText("Cannot remove signature while 'Signed by' is selected.")
    ).toBeInTheDocument();
  });

  it('moves fields down using move controls', () => {
    const first: FormField = { id: 'f-1', type: 'input', label: 'First' } as FormField;
    const second: FormField = { id: 'f-2', type: 'number', label: 'Second' } as FormField;

    renderBuild(baseFormData({ schema: [first, second] }));

    const firstSection = screen.getByLabelText('Input field');
    fireEvent.click(within(firstSection).getByTitle('Move down'));

    const schema = readSchema();
    expect(schema[0].id).toBe('f-2');
    expect(schema[1].id).toBe('f-1');
  });

  it('updates selected services inside service-group metadata and checkbox options', () => {
    renderBuild(baseFormData());

    selectAddOption('Services / Packages');
    fireEvent.click(screen.getByText('Checkup'));

    const schema = readSchema();
    const serviceGroup = schema[0] as FormField & {
      fields?: FormField[];
      meta?: Record<string, any>;
    };
    expect(serviceGroup.meta?.serviceIds).toEqual(['svc-1']);
    const checkbox = (serviceGroup.fields || []).find((field) => field.type === 'checkbox') as any;
    expect(checkbox?.options).toEqual([{ label: 'Checkup', value: 'svc-1' }]);
  });

  it('loads inventory medicines and adds medicine group fields when selected', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (fetchInventoryItems as jest.Mock).mockResolvedValue([
      {
        _id: 'med-1',
        name: 'Amoxicillin',
        itemType: 'DRUG',
        strength: '250 mg',
        dosageForm: 'Tablet',
        routeOfAdministration: 'Oral',
        sellingPrice: 25,
      },
    ]);

    const medicationGroup: FormField = {
      id: 'mg-1',
      type: 'group',
      label: 'Medication',
      meta: { medicationGroup: true } as any,
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [medicationGroup] }));

    await waitFor(() => {
      expect(fetchInventoryItems).toHaveBeenCalledWith('org-1');
    });

    const medicineOption = await screen.findByRole('option', {
      name: 'Amoxicillin (250 mg • Oral)',
    });
    fireEvent.click(medicineOption);

    await waitFor(() => {
      const schema = readSchema();
      const updated = schema[0] as any;
      expect(updated.fields).toHaveLength(1);
      expect(updated.fields[0].label).toBe('Amoxicillin');
      // Full prescription row shape sourced from inventoryToPrescriptionItem:
      // name, brand, genericName, sku, strength, strengthUnit, form, dosage,
      // route, frequency, duration, durationUnit, qty, refill, remark,
      // fulfillment, inventoryBatchId, priceCents, controlledSubstance,
      // prescriptionRequired, drugSchedule
      expect(updated.fields[0].fields).toHaveLength(21);
      expect(updated.fields[0].fields[0].defaultValue).toBe('Amoxicillin');
      expect(updated.fields[0].fields[4].defaultValue).toBe('250 mg');
      expect(updated.fields[0].fields[8].defaultValue).toBe('Oral');
    });
  });

  it('keeps Drug inventory items available in the medicine picker', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (fetchInventoryItems as jest.Mock).mockResolvedValue([
      {
        _id: 'drug-1',
        name: 'Prednisone',
        itemType: 'Drug',
        strength: '10 mg',
        dosageForm: 'Tablet',
        routeOfAdministration: 'Oral',
        sellingPrice: 12,
      },
      {
        _id: 'supply-1',
        name: 'Gauze',
        itemType: 'NON_MEDICAL',
        category: 'Consumable',
        sellingPrice: 2,
      },
    ]);

    const medicationGroup: FormField = {
      id: 'mg-1',
      type: 'group',
      label: 'Medication',
      meta: { medicationGroup: true } as any,
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [medicationGroup] }));

    await waitFor(() => {
      expect(screen.getByText(/Prednisone/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Gauze/)).not.toBeInTheDocument();
    expect(fetchInventoryItems).toHaveBeenCalledWith('org-1');
  });

  describe('YC-default structure lock', () => {
    const medicationGroup: FormField = {
      id: 'med-group',
      type: 'group',
      label: 'Medications',
      meta: { medicationGroup: true } as any,
      fields: [],
    };

    it('hides every structure-add control when the template is YC-default', () => {
      renderBuild(
        baseFormData({
          templateSource: 'YC_LIBRARY',
          category: 'SOAP',
          schema: [medicationGroup],
        })
      );

      // Top-level + nested add dropdowns and the bottom Add Field button are hidden.
      expect(screen.queryAllByRole('button', { name: 'toggle-add-field' })).toHaveLength(0);
      expect(screen.queryByText('Add Field')).not.toBeInTheDocument();
      // The medication picker stays available even when locked — choosing which medicines the
      // template prefills is content, not structure.
      expect(screen.getByTestId('medicine-dropdown')).toBeInTheDocument();
    });

    it('shows structure-add controls for custom (non-YC-default) templates', () => {
      renderBuild(
        baseFormData({
          templateSource: 'ORG_TEMPLATE',
          category: 'SOAP',
          schema: [medicationGroup],
        })
      );

      expect(screen.getAllByRole('button', { name: 'toggle-add-field' }).length).toBeGreaterThan(0);
      expect(screen.getByText('Add Field')).toBeInTheDocument();
      expect(screen.getByTestId('medicine-dropdown')).toBeInTheDocument();
    });

    it('lets YC-default task templates add schedule task blocks as content', () => {
      const taskGroup: FormField = {
        id: 'task_blocks',
        type: 'group',
        label: 'Schedule tasks',
        meta: { taskGroup: true } as any,
        fields: [],
      } as FormField;

      renderBuild(
        baseFormData({
          templateSource: 'YC_LIBRARY',
          category: 'Task Template',
          schema: [taskGroup],
        })
      );

      fireEvent.click(screen.getByRole('button', { name: /Add task block/i }));

      const schema = readSchema();
      const updatedTaskGroup = schema[0] as FormField & { fields?: FormField[] };
      const taskBlock = updatedTaskGroup.fields?.[0] as FormField & { fields?: FormField[] };
      expect(taskBlock.meta?.taskBlock).toBe(true);
      expect(taskBlock.fields?.map((field) => field.meta?.taskBlockKey)).toEqual([
        'name',
        'category',
        'additionalNotes',
        'recurrence.type',
        'reminderOffsetMinutes',
        'durationDays',
      ]);
    });
  });

  describe('reorder, delete and move controls', () => {
    const dragData = () => ({ effectAllowed: '', dropEffect: '', setData: jest.fn() });

    it('reorders a field when it is dragged onto an earlier row', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'number', label: 'B' } as FormField,
            { id: 'f-3', type: 'input', label: 'C' } as FormField,
          ],
        })
      );

      const dataTransfer = dragData();
      // Drag the last row and drop it onto the first: jsdom drop events carry no clientY,
      // so `isAfter` is false and the row lands at the target index (0) — a deterministic move.
      fireEvent.dragStart(screen.getByTestId('wrapper-f-3'), { dataTransfer });
      // dragOver runs the auto-scroll path (scrollable resolution + velocity + rAF loop).
      fireEvent.dragOver(screen.getByTestId('wrapper-f-1'), { dataTransfer });
      fireEvent.drop(screen.getByTestId('wrapper-f-1'), { dataTransfer });

      expect(readSchema().map((field) => field.id)).toEqual(['f-3', 'f-1', 'f-2']);
    });

    it('ignores drag-over and drop while nothing is being dragged', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'input', label: 'B' } as FormField,
          ],
        })
      );

      const dataTransfer = dragData();
      fireEvent.dragOver(screen.getByTestId('wrapper-f-2'), { dataTransfer });
      fireEvent.drop(screen.getByTestId('wrapper-f-2'), { dataTransfer });

      expect(readSchema().map((field) => field.id)).toEqual(['f-1', 'f-2']);
    });

    it('clears drag state on drag end', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'input', label: 'B' } as FormField,
          ],
        })
      );

      const dataTransfer = dragData();
      fireEvent.dragStart(screen.getByTestId('wrapper-f-1'), { dataTransfer });
      fireEvent.dragEnd(screen.getByTestId('wrapper-f-1'));
      // A drop after drag-end is a no-op because the drag index was reset.
      fireEvent.drop(screen.getByTestId('wrapper-f-2'), { dataTransfer, clientY: 40 });

      expect(readSchema().map((field) => field.id)).toEqual(['f-1', 'f-2']);
    });

    it('deletes a non-signature field from the schema', () => {
      renderBuild(
        baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField] })
      );

      fireEvent.click(screen.getByRole('button', { name: 'delete-f-1' }));

      expect(readSchema()).toHaveLength(0);
    });

    it('ignores delete requests while the structure is locked', () => {
      renderBuild(
        baseFormData({
          templateSource: 'YC_LIBRARY',
          schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField],
        })
      );

      fireEvent.click(screen.getByRole('button', { name: 'delete-f-1' }));

      expect(readSchema()).toHaveLength(1);
    });

    it('moves a field up and no-ops at the top boundary', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'number', label: 'B' } as FormField,
          ],
        })
      );

      fireEvent.click(within(screen.getByLabelText('Number field')).getByTitle('Move up'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-2', 'f-1']);

      // f-2 is now at the top; moving up again computes a negative index and bails.
      fireEvent.click(within(screen.getByLabelText('Number field')).getByTitle('Move up'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-2', 'f-1']);
    });

    it('no-ops when moving the last field down past the boundary', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'number', label: 'B' } as FormField,
          ],
        })
      );

      fireEvent.click(within(screen.getByLabelText('Number field')).getByTitle('Move down'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-1', 'f-2']);
    });

    it('runs the drag auto-scroll machinery when a scroll container is present', () => {
      // jsdom leaves document.scrollingElement null, which short-circuits the auto-scroll
      // path; provide a stand-in so handleDragOver resolves a scrollable and schedules a frame.
      const scroller = document.createElement('div');
      const original = Object.getOwnPropertyDescriptor(document, 'scrollingElement');
      Object.defineProperty(document, 'scrollingElement', {
        configurable: true,
        get: () => scroller,
      });

      try {
        renderBuild(
          baseFormData({
            schema: [
              { id: 'f-1', type: 'input', label: 'A' } as FormField,
              { id: 'f-2', type: 'input', label: 'B' } as FormField,
            ],
          })
        );

        const dataTransfer = dragData();
        // First drag ends in a drop → handleDrop cancels the pending animation frame.
        fireEvent.dragStart(screen.getByTestId('wrapper-f-1'), { dataTransfer });
        fireEvent.dragOver(screen.getByTestId('wrapper-f-2'), { dataTransfer });
        fireEvent.drop(screen.getByTestId('wrapper-f-2'), { dataTransfer });

        // Second drag ends without a drop → handleDragEnd cancels the pending frame instead.
        fireEvent.dragStart(screen.getByTestId('wrapper-f-1'), { dataTransfer });
        fireEvent.dragOver(screen.getByTestId('wrapper-f-2'), { dataTransfer });
        fireEvent.dragEnd(screen.getByTestId('wrapper-f-2'));

        expect(screen.getByTestId('wrapper-f-1')).toBeInTheDocument();
      } finally {
        if (original) {
          Object.defineProperty(document, 'scrollingElement', original);
        } else {
          delete (document as unknown as { scrollingElement?: unknown }).scrollingElement;
        }
      }
    });

    it('is a no-op when a field is dropped onto itself', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'input', label: 'B' } as FormField,
          ],
        })
      );

      const dataTransfer = dragData();
      // Dropping onto the same row makes from === to → reorderField early-returns.
      fireEvent.dragStart(screen.getByTestId('wrapper-f-1'), { dataTransfer });
      fireEvent.drop(screen.getByTestId('wrapper-f-1'), { dataTransfer });

      expect(readSchema().map((field) => field.id)).toEqual(['f-1', 'f-2']);
    });
  });

  it('creates each simple field type from the add menu', () => {
    renderBuild(baseFormData());

    ['Select List', 'Single Choice', 'Multiple Choice', 'Yes / No', 'Date', 'Tasks'].forEach(
      (label) => selectAddOption(label)
    );

    expect(readSchema().map((field) => field.type)).toEqual([
      'dropdown',
      'radio',
      'checkbox',
      'boolean',
      'date',
      'group',
    ]);
  });

  it('closes the add-field menu when clicking outside it', () => {
    renderBuild(baseFormData());

    fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[0]);
    expect(screen.getByRole('button', { name: 'Short Text' })).toBeInTheDocument();

    // useOutsideClick: a mousedown outside the open dropdown closes it.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'Short Text' })).not.toBeInTheDocument();
  });

  it('falls back to default option sets for task-block dropdowns without options', () => {
    const leaf = (key: string, type: string): FormField =>
      ({
        id: `tbx_${key}`,
        type,
        label: key,
        meta: { taskBlockKey: key },
      }) as unknown as FormField;

    const taskGroup: FormField = {
      id: 'task_blocks',
      type: 'group',
      label: 'Tasks',
      meta: { taskGroup: true } as any,
      fields: [
        {
          id: 'tbx',
          type: 'group',
          label: 'Task 1',
          meta: { taskBlock: true } as any,
          fields: [
            leaf('name', 'input'),
            leaf('category', 'dropdown'),
            leaf('additionalNotes', 'textarea'),
            leaf('recurrence.type', 'dropdown'),
            leaf('reminderOffsetMinutes', 'dropdown'),
            leaf('durationDays', 'number'),
          ],
        } as unknown as FormField,
      ],
    } as FormField;

    renderBuild(baseFormData({ schema: [taskGroup] }));

    // The category/repeat/reminder dropdowns have no options → each ternary falls back
    // to its TASK_*_FIELD_OPTIONS constant.
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('treats an undefined signer as not signature-eligible', () => {
    renderBuild(baseFormData({ requiredSigner: undefined }));

    fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[0]);
    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('re-seeds service groups already present in the schema on mount', () => {
    const serviceGroup: FormField = {
      id: 'svc-group',
      type: 'group',
      label: 'Services',
      meta: { serviceGroup: true } as any,
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [serviceGroup] }));

    // ensureServiceCheckbox seeds a checkbox child via the mount effect.
    const schema = readSchema();
    const seeded = schema[0] as FormField & { fields?: FormField[] };
    expect(seeded.fields?.some((field) => field.type === 'checkbox')).toBe(true);
  });

  it('skips the service-seed effect when there are no service options', () => {
    const serviceGroup: FormField = {
      id: 'svc-group',
      type: 'group',
      label: 'Services',
      meta: { serviceGroup: true } as any,
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [serviceGroup] }), []);

    // No service options → the seeding effect early-returns, group stays childless.
    const schema = readSchema();
    const seeded = schema[0] as FormField & { fields?: FormField[] };
    expect(seeded.fields ?? []).toHaveLength(0);
  });

  it('renders every nested field kind inside a generic group and removes a nested field', () => {
    const group: FormField = {
      id: 'grp-1',
      type: 'group',
      label: 'Section',
      fields: [
        { id: 'n-1', type: 'input', label: 'Nested input' } as FormField,
        { id: 'sub-1', type: 'group', label: 'Sub', fields: [] } as FormField,
        {
          id: 'med-n',
          type: 'group',
          label: 'Meds',
          meta: { medicationGroup: true } as any,
          fields: [],
        } as FormField,
        {
          id: 'task-n',
          type: 'group',
          label: 'Tasks',
          meta: { taskGroup: true } as any,
          fields: [],
        } as FormField,
      ],
    } as FormField;

    renderBuild(baseFormData({ schema: [group] }));

    // FieldBuilder (nested input), TaskGroupBuilder and MedicationGroupBuilder all render.
    expect(screen.getByTestId('builder-n-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add task block/i })).toBeInTheDocument();
    expect(screen.getByTestId('medicine-dropdown')).toBeInTheDocument();

    // Deleting the nested input runs removeNestedField on the group.
    fireEvent.click(screen.getByRole('button', { name: 'delete-n-1' }));
    expect(screen.queryByTestId('builder-n-1')).not.toBeInTheDocument();
  });

  it('adds a nested field inside a generic group via its own add dropdown', () => {
    const group: FormField = {
      id: 'grp-1',
      type: 'group',
      label: 'Section',
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [group] }));

    // The group renders its own add dropdown (second toggle-add-field button).
    const toggles = screen.getAllByRole('button', { name: 'toggle-add-field' });
    fireEvent.click(toggles[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Short Text' })[0]);

    const schema = readSchema();
    const updatedGroup = schema[0] as FormField & { fields?: FormField[] };
    expect(updatedGroup.fields).toHaveLength(1);
    expect(updatedGroup.fields?.[0].type).toBe('input');
  });

  it('edits the group name of a generic group', () => {
    const group: FormField = {
      id: 'grp-1',
      type: 'group',
      label: 'Section',
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [group] }));

    fireEvent.change(screen.getByTestId('group-grp-1-label'), { target: { value: 'Vitals' } });

    const schema = readSchema();
    expect(schema[0].label).toBe('Vitals');
  });

  it('edits a medicine card field, writing back into the prescription leaf field', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (fetchInventoryItems as jest.Mock).mockResolvedValue([
      {
        _id: 'med-1',
        name: 'Amoxicillin',
        itemType: 'DRUG',
        strength: '250 mg',
        dosageForm: 'Tablet',
        routeOfAdministration: 'Oral',
        sellingPrice: 25,
      },
    ]);

    renderBuild(
      baseFormData({
        schema: [
          {
            id: 'mg-1',
            type: 'group',
            label: 'Medication',
            meta: { medicationGroup: true } as any,
            fields: [],
          } as FormField,
        ],
      })
    );

    fireEvent.click(await screen.findByRole('option', { name: 'Amoxicillin (250 mg • Oral)' }));

    // The added medicine renders a MedicineCard whose Duration input writes 'durationDays'.
    const durationInput = await screen.findByTestId('mg-1_med_1_group-duration');
    fireEvent.change(durationInput, { target: { value: '7' } });

    await waitFor(() => {
      const medGroup = readSchema()[0] as any;
      const durationLeaf = medGroup.fields[0].fields.find(
        (f: any) => f.meta?.prescriptionField === 'durationDays'
      );
      expect(durationLeaf.defaultValue).toBe('7');
    });
  });

  it('adds, edits, duplicates and removes task blocks in a task group', () => {
    const taskField = (key: string, type: string, extra: Record<string, unknown> = {}): FormField =>
      ({
        id: `tb_${key}`,
        type,
        label: key,
        meta: { taskBlockKey: key },
        ...extra,
      }) as unknown as FormField;

    const block: FormField = {
      id: 'tb-1',
      type: 'group',
      label: 'Task 1',
      meta: { taskBlock: true, taskBlockId: 'tb-1' } as any,
      fields: [
        taskField('name', 'input', { defaultValue: 'Vitals' }),
        taskField('category', 'dropdown', {
          defaultValue: 'CARE',
          options: [{ label: 'CategoryCare', value: 'CARE' }],
        }),
        taskField('additionalNotes', 'textarea'),
        taskField('recurrence.type', 'dropdown', {
          defaultValue: 'EVERY_6_HOURS',
          options: [{ label: 'Repeat6h', value: 'EVERY_6_HOURS' }],
        }),
        taskField('reminderOffsetMinutes', 'dropdown', {
          defaultValue: '5',
          options: [{ label: 'Remind5', value: '5' }],
        }),
        taskField('durationDays', 'number', { defaultValue: '3' }),
      ],
    } as FormField;

    const taskGroup: FormField = {
      id: 'task_blocks',
      type: 'group',
      label: 'Tasks',
      meta: { taskGroup: true } as any,
      fields: [block],
    } as FormField;

    renderBuild(baseFormData({ schema: [taskGroup] }));

    // Existing block renders as a TaskBlockCard with header actions.
    expect(screen.getByText('Task 1')).toBeInTheDocument();

    // Edit the title → setKeyValue('name') rewrites the leaf defaultValue.
    fireEvent.change(screen.getByTestId('tb-1-title'), { target: { value: 'Record vitals' } });
    expect(
      (readSchema()[0] as any).fields[0].fields.find((f: any) => f.meta?.taskBlockKey === 'name')
        .defaultValue
    ).toBe('Record vitals');

    // Pick a category option → setKeyValue('category').
    fireEvent.click(screen.getByRole('option', { name: 'CategoryCare' }));
    expect(
      (readSchema()[0] as any).fields[0].fields.find(
        (f: any) => f.meta?.taskBlockKey === 'category'
      ).defaultValue
    ).toBe('CARE');

    // "Add another task" is shown because a block already exists (blocks.length > 0).
    fireEvent.click(screen.getByRole('button', { name: /Add another task/i }));
    expect((readSchema()[0] as any).fields).toHaveLength(2);

    // Duplicate then remove the first task block.
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate task 1' }));
    expect((readSchema()[0] as any).fields).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Remove task 1' }));
    expect((readSchema()[0] as any).fields).toHaveLength(2);
  });

  it('removes a medicine from a medication group', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (fetchInventoryItems as jest.Mock).mockResolvedValue([
      {
        _id: 'med-1',
        name: 'Amoxicillin',
        itemType: 'DRUG',
        strength: '250 mg',
        dosageForm: 'Tablet',
        routeOfAdministration: 'Oral',
        sellingPrice: 25,
      },
    ]);

    renderBuild(
      baseFormData({
        schema: [
          {
            id: 'mg-1',
            type: 'group',
            label: 'Medication',
            meta: { medicationGroup: true } as any,
            fields: [],
          } as FormField,
        ],
      })
    );

    fireEvent.click(await screen.findByRole('option', { name: 'Amoxicillin (250 mg • Oral)' }));
    await waitFor(() => expect((readSchema()[0] as any).fields).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Amoxicillin' }));
    await waitFor(() => expect((readSchema()[0] as any).fields).toHaveLength(0));
  });
});
