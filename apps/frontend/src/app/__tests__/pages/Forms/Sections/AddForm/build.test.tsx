import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import Build from '@/app/features/forms/pages/Forms/Sections/AddForm/Build';
import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import { ensureSingleSignatureAtEnd } from '@/app/lib/forms';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, inname }: any) => (
    <input data-testid={inname || 'form-input'} value={value || ''} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ value, onChange, inname }: any) => (
    <textarea data-testid={inname || 'form-desc'} value={value || ''} onChange={onChange} />
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

// The builder uses the reusable searchable LabelDropdown (defaultOption + onSelect(option))
// for the medicine picker and the task/medicine card option dropdowns. The mock renders each
// option with role="option" and tags the medicine picker wrapper with a testid.
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
  // Real context so Build's <StructureLockContext.Provider> renders; the stub wrapper ignores
  // the lock (BuilderWrapper's own lock behaviour is covered in its own test). Used only for
  // NESTED fields inside a selected group.
  StructureLockContext: jest.requireActual('react').createContext(false),
  default: ({ field, onDelete, children }: any) => (
    <section aria-label={`${field.type.charAt(0).toUpperCase()}${field.type.slice(1)} field`}>
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

// Adding a field is now a single click on a left-palette tile (no dropdown toggle).
const addFromPalette = (optionLabel: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: optionLabel })[0]);
};

describe('Build form (single-screen builder)', () => {
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

  it('renders the palette, canvas and settings columns', () => {
    renderBuild(baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField] }));

    expect(screen.getByText('Add a field')).toBeInTheDocument();
    expect(screen.getByText('Field settings')).toBeInTheDocument();
    expect(screen.getByText('Drop a field here')).toBeInTheDocument();
    // Existing field renders as a compact canvas row; the first field is auto-selected so its
    // builder shows in the right settings panel.
    expect(screen.getByTestId('canvas-row-f-1')).toBeInTheDocument();
    expect(screen.getByTestId('builder-f-1')).toBeInTheDocument();
  });

  it('adds a short text field from the palette and auto-selects it', () => {
    renderBuild(baseFormData());

    addFromPalette('Short Text');

    const schema = readSchema();
    expect(schema).toHaveLength(1);
    expect(schema[0].type).toBe('input');
    expect(schema[0].id).toBe('field-1');
    // Newly added field is selected → its builder renders in the settings panel.
    expect(screen.getByTestId('builder-field-1')).toBeInTheDocument();
  });

  it('creates each simple field type from the palette', () => {
    renderBuild(baseFormData());

    ['Select List', 'Single Choice', 'Multiple Choice', 'Yes / No', 'Date', 'Tasks'].forEach(
      (label) => addFromPalette(label)
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

  it('hides the signature palette tile when signed-by is not selected', () => {
    renderBuild(baseFormData({ requiredSigner: '' }));

    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('treats an undefined signer as not signature-eligible', () => {
    renderBuild(baseFormData({ requiredSigner: undefined }));

    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('allows one signature field and blocks duplicate signatures', () => {
    renderBuild(baseFormData({ requiredSigner: 'CLIENT' }));

    addFromPalette('Signature');
    expect(readSchema().filter((field) => field.type === 'signature')).toHaveLength(1);

    addFromPalette('Signature');
    expect(readSchema().filter((field) => field.type === 'signature')).toHaveLength(1);
    expect(screen.getByText('Only one signature field is allowed per form.')).toBeInTheDocument();
  });

  it('hides the signature tile for SOAP templates', () => {
    renderBuild(baseFormData({ category: 'SOAP', requiredSigner: 'CLIENT' }));

    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('uses ensureSingleSignatureAtEnd for Prescription forms', () => {
    renderBuild(baseFormData({ category: 'Prescription', requiredSigner: 'CLIENT' }));

    addFromPalette('Signature');

    expect(ensureSingleSignatureAtEnd).toHaveBeenCalledTimes(1);
    expect(readSchema().some((field) => field.type === 'signature')).toBe(true);
  });

  it('adds a service group with a generated checkbox field', () => {
    renderBuild(baseFormData());

    addFromPalette('Services / Packages');

    const schema = readSchema();
    expect(schema).toHaveLength(1);
    expect(schema[0].type).toBe('group');
    expect((schema[0] as any).meta?.serviceGroup).toBe(true);
    expect((schema[0] as any).fields?.some((f: FormField) => f.type === 'checkbox')).toBe(true);
  });

  it('updates selected services inside service-group metadata and checkbox options', () => {
    renderBuild(baseFormData());

    addFromPalette('Services / Packages');
    // Service group is auto-selected → its GroupBuilder (with the service multiselect) is in the
    // settings panel. Picking a service updates the group.
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

  it('adds medications inside treatment_plan group when it exists', () => {
    const treatmentPlan: FormField = {
      id: 'treatment_plan',
      type: 'group',
      label: 'Treatment plan',
      fields: [],
    } as FormField;

    renderBuild(baseFormData({ schema: [treatmentPlan] }));

    addFromPalette('Medications');

    const schema = readSchema();
    expect(schema).toHaveLength(1);
    const updatedTreatment = schema[0] as FormField & { fields?: FormField[] };
    expect(updatedTreatment.fields).toHaveLength(1);
    expect(updatedTreatment.fields?.[0].label).toBe('Medication 1');
    expect((updatedTreatment.fields?.[0] as any).meta?.medicationGroup).toBe(true);
  });

  describe('canvas row actions (select / delete / move / duplicate / reorder)', () => {
    const dragData = () => ({ effectAllowed: '', dropEffect: '', setData: jest.fn() });

    it('prevents deleting signature when signer is required', () => {
      const signatureField: FormField = {
        id: 'sig-1',
        type: 'signature',
        label: 'Signature',
      } as FormField;

      renderBuild(baseFormData({ requiredSigner: 'CLIENT', schema: [signatureField] }));

      // Auto-selected → its row exposes the delete control.
      const row = screen.getByTestId('canvas-row-sig-1');
      fireEvent.click(within(row).getByRole('button', { name: 'delete-sig-1' }));

      expect(readSchema()).toHaveLength(1);
      expect(
        screen.getByText("Cannot remove signature while 'Signed by' is selected.")
      ).toBeInTheDocument();
    });

    it('deletes a non-signature field from the schema', () => {
      renderBuild(
        baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField] })
      );

      fireEvent.click(screen.getByRole('button', { name: 'delete-f-1' }));

      expect(readSchema()).toHaveLength(0);
    });

    it('does not expose a delete control while the structure is locked', () => {
      renderBuild(
        baseFormData({
          templateSource: 'YC_LIBRARY',
          schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField],
        })
      );

      expect(screen.queryByRole('button', { name: 'delete-f-1' })).not.toBeInTheDocument();
      expect(readSchema()).toHaveLength(1);
    });

    it('duplicates the selected field with a fresh id', () => {
      renderBuild(
        baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField] })
      );

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate A' }));

      const schema = readSchema();
      expect(schema).toHaveLength(2);
      expect(schema[1].id).not.toBe('f-1');
      expect(schema[1].label).toBe('A');
    });

    it('moves a field down, and no-ops past the bottom boundary', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'First' } as FormField,
            { id: 'f-2', type: 'number', label: 'Second' } as FormField,
          ],
        })
      );

      // f-1 is auto-selected; move it down.
      fireEvent.click(within(screen.getByTestId('canvas-row-f-1')).getByTitle('Move down'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-2', 'f-1']);

      // Select the now-last row and move down again → guard no-ops.
      fireEvent.click(screen.getByTestId('canvas-row-f-1'));
      fireEvent.click(within(screen.getByTestId('canvas-row-f-1')).getByTitle('Move down'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-2', 'f-1']);
    });

    it('moves a field up, and no-ops past the top boundary', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'First' } as FormField,
            { id: 'f-2', type: 'number', label: 'Second' } as FormField,
          ],
        })
      );

      fireEvent.click(screen.getByTestId('canvas-row-f-2'));
      fireEvent.click(within(screen.getByTestId('canvas-row-f-2')).getByTitle('Move up'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-2', 'f-1']);

      // f-2 is now at the top; moving up again computes a negative index and bails.
      fireEvent.click(within(screen.getByTestId('canvas-row-f-2')).getByTitle('Move up'));
      expect(readSchema().map((field) => field.id)).toEqual(['f-2', 'f-1']);
    });

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
      fireEvent.dragStart(screen.getByTestId('canvas-row-f-3'), { dataTransfer });
      fireEvent.dragOver(screen.getByTestId('canvas-row-f-1'), { dataTransfer });
      fireEvent.drop(screen.getByTestId('canvas-row-f-1'), { dataTransfer });

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
      fireEvent.dragOver(screen.getByTestId('canvas-row-f-2'), { dataTransfer });
      fireEvent.drop(screen.getByTestId('canvas-row-f-2'), { dataTransfer });

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
      fireEvent.dragStart(screen.getByTestId('canvas-row-f-1'), { dataTransfer });
      fireEvent.dragEnd(screen.getByTestId('canvas-row-f-1'));
      fireEvent.drop(screen.getByTestId('canvas-row-f-2'), { dataTransfer, clientY: 40 });

      expect(readSchema().map((field) => field.id)).toEqual(['f-1', 'f-2']);
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
      fireEvent.dragStart(screen.getByTestId('canvas-row-f-1'), { dataTransfer });
      fireEvent.drop(screen.getByTestId('canvas-row-f-1'), { dataTransfer });

      expect(readSchema().map((field) => field.id)).toEqual(['f-1', 'f-2']);
    });

    it('selects a field with the keyboard', () => {
      renderBuild(
        baseFormData({
          schema: [
            { id: 'f-1', type: 'input', label: 'A' } as FormField,
            { id: 'f-2', type: 'number', label: 'B' } as FormField,
          ],
        })
      );

      // f-1 is auto-selected → builder-f-1 shown. Keyboard-select f-2.
      expect(screen.getByTestId('builder-f-1')).toBeInTheDocument();
      fireEvent.keyDown(screen.getByTestId('canvas-row-f-2'), { key: 'Enter' });
      expect(screen.getByTestId('builder-f-2')).toBeInTheDocument();
    });

    it('runs the drag auto-scroll machinery when a scroll container is present', () => {
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
        fireEvent.dragStart(screen.getByTestId('canvas-row-f-1'), { dataTransfer });
        fireEvent.dragOver(screen.getByTestId('canvas-row-f-2'), { dataTransfer });
        fireEvent.drop(screen.getByTestId('canvas-row-f-2'), { dataTransfer });

        fireEvent.dragStart(screen.getByTestId('canvas-row-f-1'), { dataTransfer });
        fireEvent.dragOver(screen.getByTestId('canvas-row-f-2'), { dataTransfer });
        fireEvent.dragEnd(screen.getByTestId('canvas-row-f-2'));

        expect(screen.getByTestId('canvas-row-f-1')).toBeInTheDocument();
      } finally {
        if (original) {
          Object.defineProperty(document, 'scrollingElement', original);
        } else {
          delete (document as unknown as { scrollingElement?: unknown }).scrollingElement;
        }
      }
    });
  });

  describe('field settings panel', () => {
    it('toggles Required and Show in summary PDF for the selected field', () => {
      renderBuild(
        baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField] })
      );

      fireEvent.click(screen.getByRole('switch', { name: 'Required' }));
      expect(readSchema()[0].required).toBe(true);

      // Defaults to on (undefined !== false) → toggling turns it off.
      fireEvent.click(screen.getByRole('switch', { name: 'Show in summary PDF' }));
      expect((readSchema()[0] as any).meta?.showInSummaryPdf).toBe(false);
    });

    it('shows a placeholder when no field is selected', () => {
      renderBuild(baseFormData());

      expect(
        screen.getByText(/Select a field in the canvas to edit its settings/i)
      ).toBeInTheDocument();
    });

    it('lists linked services and opens the picker to link more', () => {
      renderBuild(
        baseFormData({
          services: ['svc-1'],
          schema: [{ id: 'f-1', type: 'input', label: 'A' } as FormField],
        })
      );

      expect(screen.getByText('Checkup')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Link another service/i }));
      // Picker appears; choosing another service updates the form's linked services.
      fireEvent.click(screen.getByText('Vaccination'));
      // The row still renders (service link state lives on the form).
      expect(screen.getByTestId('canvas-row-f-1')).toBeInTheDocument();
    });
  });

  describe('YC-default structure lock', () => {
    const medicationGroup: FormField = {
      id: 'med-group',
      type: 'group',
      label: 'Medications',
      meta: { medicationGroup: true } as any,
      fields: [],
    };

    it('hides the palette and the drop target when the template is YC-default', () => {
      renderBuild(
        baseFormData({
          templateSource: 'YC_LIBRARY',
          category: 'SOAP',
          schema: [medicationGroup],
        })
      );

      // Palette tiles are gone (no top-level add), and there are no add-field dropdowns.
      expect(screen.queryAllByRole('button', { name: 'toggle-add-field' })).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Short Text' })).not.toBeInTheDocument();
      expect(screen.queryByText('Drop a field here')).not.toBeInTheDocument();
      expect(screen.getByText(/locked structure/i)).toBeInTheDocument();
      // Medicine picker stays available (choosing prefilled medicines is content, not structure).
      expect(screen.getByTestId('medicine-dropdown')).toBeInTheDocument();
    });

    it('shows the palette for custom (non-YC-default) templates', () => {
      renderBuild(
        baseFormData({
          templateSource: 'ORG_TEMPLATE',
          category: 'SOAP',
          schema: [medicationGroup],
        })
      );

      expect(screen.getByRole('button', { name: 'Short Text' })).toBeInTheDocument();
      expect(screen.getByText('Drop a field here')).toBeInTheDocument();
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

  describe('generic group editing (in the settings panel)', () => {
    it('renders every nested field kind inside a selected generic group and removes a nested field', () => {
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

      // group is auto-selected → its GroupBuilder renders in the settings panel.
      expect(screen.getByTestId('builder-n-1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add task block/i })).toBeInTheDocument();
      expect(screen.getByTestId('medicine-dropdown')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'delete-n-1' }));
      expect(screen.queryByTestId('builder-n-1')).not.toBeInTheDocument();
    });

    it('adds a nested field inside a selected generic group via its own add dropdown', () => {
      const group: FormField = {
        id: 'grp-1',
        type: 'group',
        label: 'Section',
        fields: [],
      } as FormField;

      renderBuild(baseFormData({ schema: [group] }));

      // Open the group's nested add dropdown (the only toggle-add-field control), then pick the
      // nested "Short Text" option (the last matching button — the palette tile is the first).
      fireEvent.click(screen.getByRole('button', { name: 'toggle-add-field' }));
      const shortTextButtons = screen.getAllByRole('button', { name: 'Short Text' });
      fireEvent.click(shortTextButtons[shortTextButtons.length - 1]);

      const schema = readSchema();
      const updatedGroup = schema[0] as FormField & { fields?: FormField[] };
      expect(updatedGroup.fields).toHaveLength(1);
      expect(updatedGroup.fields?.[0].type).toBe('input');
    });

    it('closes the nested add-field menu when clicking outside it', () => {
      const group: FormField = {
        id: 'grp-1',
        type: 'group',
        label: 'Section',
        fields: [],
      } as FormField;

      renderBuild(baseFormData({ schema: [group] }));

      // Palette always shows one "Short Text" tile; opening the nested dropdown adds a second.
      expect(screen.getAllByRole('button', { name: 'Short Text' })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'toggle-add-field' }));
      expect(screen.getAllByRole('button', { name: 'Short Text' })).toHaveLength(2);

      fireEvent.mouseDown(document.body);
      expect(screen.getAllByRole('button', { name: 'Short Text' })).toHaveLength(1);
    });

    it('edits the group name of a selected generic group', () => {
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
  });

  describe('service group seeding effect', () => {
    it('re-seeds service groups already present in the schema on mount', () => {
      const serviceGroup: FormField = {
        id: 'svc-group',
        type: 'group',
        label: 'Services',
        meta: { serviceGroup: true } as any,
        fields: [],
      } as FormField;

      renderBuild(baseFormData({ schema: [serviceGroup] }));

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

      const schema = readSchema();
      const seeded = schema[0] as FormField & { fields?: FormField[] };
      expect(seeded.fields ?? []).toHaveLength(0);
    });
  });

  describe('medication and task builders (in the settings panel)', () => {
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

      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    it('adds, edits, duplicates and removes task blocks in a task group', () => {
      const taskField = (
        key: string,
        type: string,
        extra: Record<string, unknown> = {}
      ): FormField =>
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

      expect(screen.getByText('Task 1')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('tb-1-title'), { target: { value: 'Record vitals' } });
      expect(
        (readSchema()[0] as any).fields[0].fields.find((f: any) => f.meta?.taskBlockKey === 'name')
          .defaultValue
      ).toBe('Record vitals');

      fireEvent.click(screen.getByRole('option', { name: 'CategoryCare' }));
      expect(
        (readSchema()[0] as any).fields[0].fields.find(
          (f: any) => f.meta?.taskBlockKey === 'category'
        ).defaultValue
      ).toBe('CARE');

      fireEvent.click(screen.getByRole('button', { name: /Add another task/i }));
      expect((readSchema()[0] as any).fields).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate task 1' }));
      expect((readSchema()[0] as any).fields).toHaveLength(3);

      fireEvent.click(screen.getByRole('button', { name: 'Remove task 1' }));
      expect((readSchema()[0] as any).fields).toHaveLength(2);
    });
  });
});
