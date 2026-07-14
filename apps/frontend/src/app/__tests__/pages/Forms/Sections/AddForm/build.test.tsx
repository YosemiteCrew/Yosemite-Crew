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
  default: ({
    field,
    onDelete,
    onMoveUp,
    onMoveDown,
    children,
    draggable,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }: any) => (
    <section
      aria-label={`${field.type.charAt(0).toUpperCase()}${field.type.slice(1)} field`}
      data-field-id={field.id}
      draggable={draggable}
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

let stepRef: React.RefObject<{ validate: () => boolean } | null>;

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
          ref={stepRef}
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
    stepRef = React.createRef<{ validate: () => boolean }>();
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

    expect(stepRef.current).not.toBeNull();
    let result = true;
    act(() => {
      result = Boolean(stepRef.current?.validate());
    });
    expect(result).toBe(false);
    expect(screen.getByText('Add at least one field to continue.')).toBeInTheDocument();
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

    it('edits, duplicates and removes task blocks', async () => {
      const taskGroup: FormField = {
        id: 'task_blocks',
        type: 'group',
        label: 'Schedule tasks',
        meta: { taskGroup: true } as any,
        fields: [],
      } as FormField;

      renderBuild(baseFormData({ category: 'Task Template', schema: [taskGroup] }));

      fireEvent.click(screen.getByRole('button', { name: /Add task block/i }));

      let schema = readSchema();
      let taskGroupState = schema[0] as FormField & { fields?: FormField[] };
      let block = taskGroupState.fields?.[0] as FormField & {
        id: string;
        fields?: FormField[];
      };

      fireEvent.change(screen.getByTestId(`${block.id}-title`), {
        target: { value: 'Record vitals' },
      });
      fireEvent.click(screen.getByRole('option', { name: 'Care' }));
      fireEvent.click(screen.getByRole('option', { name: 'Every 12 hours' }));
      fireEvent.click(screen.getByRole('option', { name: '15 minutes before' }));
      fireEvent.change(screen.getByTestId(`${block.id}-instructions`), {
        target: { value: 'Check twice a day' },
      });
      fireEvent.change(screen.getByTestId(`${block.id}-duration`), {
        target: { value: '5' },
      });

      schema = readSchema();
      taskGroupState = schema[0] as FormField & { fields?: FormField[] };
      block = taskGroupState.fields?.[0] as FormField & {
        id: string;
        fields?: FormField[];
      };
      const byKey = (key: string) =>
        (block.fields ?? []).find((f: any) => f.meta?.taskBlockKey === key) as any;
      expect(byKey('name').defaultValue).toBe('Record vitals');
      expect(byKey('category').defaultValue).toBe('CARE');
      expect(byKey('recurrence.type').defaultValue).toBe('EVERY_12_HOURS');
      expect(byKey('reminderOffsetMinutes').defaultValue).toBe('15');
      expect(byKey('additionalNotes').defaultValue).toBe('Check twice a day');
      expect(byKey('durationDays').defaultValue).toBe('5');

      // Duplicate the task block
      fireEvent.click(screen.getByRole('button', { name: /Duplicate task 1/i }));
      schema = readSchema();
      taskGroupState = schema[0] as FormField & { fields?: FormField[] };
      expect(taskGroupState.fields).toHaveLength(2);

      // Remove the first task block
      fireEvent.click(screen.getAllByRole('button', { name: /Remove task/i })[0]);
      schema = readSchema();
      taskGroupState = schema[0] as FormField & { fields?: FormField[] };
      expect(taskGroupState.fields).toHaveLength(1);
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

  describe('field factories and validation', () => {
    it('creates every remaining field type from the add menu', () => {
      renderBuild(baseFormData());

      const expectations: Array<[string, string]> = [
        ['Long Text', 'textarea'],
        ['Rich Text', 'richtext'],
        ['Number', 'number'],
        ['Select List', 'dropdown'],
        ['Single Choice', 'radio'],
        ['Multiple Choice', 'checkbox'],
        ['Yes / No', 'boolean'],
        ['Date', 'date'],
        ['Field Group', 'group'],
        ['Tasks', 'group'],
      ];
      expectations.forEach(([label]) => selectAddOption(label));

      const schema = readSchema();
      expect(schema.map((f) => f.type)).toEqual(expectations.map(([, type]) => type));
      expect((schema[9] as any).meta?.taskGroup).toBe(true);
      const dropdown = schema[3] as any;
      expect(dropdown.options).toHaveLength(2);
      expect(dropdown.multiple).toBe(false);
      const radio = schema[4] as any;
      expect(radio.options[0].value).toBe('option_a');
      const checkbox = schema[5] as any;
      expect(checkbox.multiple).toBe(true);
    });

    it('adds a standalone medication group when there is no treatment plan', () => {
      renderBuild(baseFormData());

      selectAddOption('Medications');

      const schema = readSchema();
      expect((schema[0] as any).meta?.medicationGroup).toBe(true);
      expect((schema[0] as any).fields?.[0]?.meta?.template).toBe(true);
    });

    it('passes validation when schema has at least one field', () => {
      renderBuild(
        baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'First' } as FormField] })
      );

      let result = false;
      act(() => {
        result = Boolean(stepRef.current?.validate());
      });
      expect(result).toBe(true);
      expect(screen.queryByTestId('warning-icon')).not.toBeInTheDocument();
    });

    it('deletes a regular field and clears any previous build error', () => {
      renderBuild(
        baseFormData({ schema: [{ id: 'f-1', type: 'input', label: 'First' } as FormField] })
      );

      fireEvent.click(screen.getByRole('button', { name: 'delete-f-1' }));
      expect(readSchema()).toHaveLength(0);
    });

    it('closes the add-field dropdown on outside click', () => {
      renderBuild(baseFormData());

      fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[0]);
      expect(screen.getAllByRole('button', { name: 'Long Text' }).length).toBeGreaterThan(0);

      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('button', { name: 'Long Text' })).not.toBeInTheDocument();
    });

    it('moves a field up using the move controls', () => {
      const first: FormField = { id: 'f-1', type: 'input', label: 'First' } as FormField;
      const second: FormField = { id: 'f-2', type: 'number', label: 'Second' } as FormField;

      renderBuild(baseFormData({ schema: [first, second] }));

      const secondSection = screen.getByLabelText('Number field');
      fireEvent.click(within(secondSection).getByTitle('Move up'));

      expect(readSchema().map((f) => f.id)).toEqual(['f-2', 'f-1']);
    });
  });

  describe('group builder', () => {
    it('renames a group, adds and removes nested fields', () => {
      const group: FormField = {
        id: 'g1',
        type: 'group',
        label: 'My group',
        fields: [{ id: 'n1', type: 'input', label: 'Nested' } as FormField],
      } as FormField;

      renderBuild(baseFormData({ schema: [group] }));

      fireEvent.change(screen.getByTestId('group-g1-label'), { target: { value: 'Renamed' } });
      expect((readSchema()[0] as any).label).toBe('Renamed');

      // Second toggle is the group's own nested add-field dropdown.
      fireEvent.click(screen.getAllByRole('button', { name: 'toggle-add-field' })[1]);
      fireEvent.click(screen.getAllByRole('button', { name: 'Number' })[0]);
      expect((readSchema()[0] as any).fields).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: 'delete-n1' }));
      expect((readSchema()[0] as any).fields.map((f: any) => f.id)).not.toContain('n1');
    });

    it('renders nested medication, task, and regular groups and updates a nested group label', () => {
      const group: FormField = {
        id: 'g1',
        type: 'group',
        label: 'Outer',
        fields: [
          { id: 'med1', type: 'group', label: 'Meds', meta: { medicationGroup: true }, fields: [] },
          { id: 'task1', type: 'group', label: 'Tasks', meta: { taskGroup: true }, fields: [] },
          { id: 'inner1', type: 'group', label: 'Inner', fields: [] },
        ] as FormField[],
      } as FormField;

      renderBuild(baseFormData({ schema: [group] }));

      expect(screen.getByTestId('medicine-dropdown')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add task block/i })).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('group-inner1-label'), {
        target: { value: 'Inner renamed' },
      });
      const outer = readSchema()[0] as any;
      expect(outer.fields.find((f: any) => f.id === 'inner1').label).toBe('Inner renamed');

      fireEvent.click(screen.getByRole('button', { name: 'delete-med1' }));
      expect((readSchema()[0] as any).fields.map((f: any) => f.id)).not.toContain('med1');
    });

    it('renames a service group nested in the schema and updates its services', () => {
      const serviceGroup: FormField = {
        id: 'sg1',
        type: 'group',
        label: 'Bundle',
        meta: { serviceGroup: true },
        fields: [],
      } as FormField;

      renderBuild(baseFormData({ schema: [serviceGroup] }));

      fireEvent.change(screen.getByTestId('group-sg1-label'), {
        target: { value: 'Care bundle' },
      });
      expect((readSchema()[0] as any).label).toBe('Care bundle');
    });
  });

  describe('medication group builder', () => {
    const medicineGroupField = (): FormField =>
      ({
        id: 'mg-1',
        type: 'group',
        label: 'Medication',
        meta: { medicationGroup: true },
        fields: [
          {
            id: 'med-a_group',
            type: 'group',
            label: 'Amoxil',
            meta: { medicineId: 'med-a', medicineName: 'Amoxil' },
            fields: [
              {
                id: 'f-name',
                type: 'input',
                label: 'Name',
                defaultValue: 'Amoxil',
                meta: { prescriptionField: 'medicineName' },
              },
              {
                id: 'f-brand',
                type: 'input',
                label: 'Brand',
                defaultValue: 'BrandX',
                meta: { prescriptionField: 'brand' },
              },
              {
                id: 'f-strength',
                type: 'input',
                label: 'Strength',
                defaultValue: '250',
                meta: { prescriptionField: 'strength' },
              },
              {
                id: 'f-strength-unit',
                type: 'input',
                label: 'Strength unit',
                defaultValue: 'mg',
                meta: { prescriptionField: 'strengthUnit' },
              },
              {
                id: 'f-sku',
                type: 'input',
                label: 'SKU',
                defaultValue: 'SKU-9',
                meta: { prescriptionField: 'sku' },
              },
              {
                id: 'f-route',
                type: 'input',
                label: 'Route',
                defaultValue: '',
                meta: { prescriptionField: 'route' },
              },
              {
                id: 'f-duration',
                type: 'number',
                label: 'Duration',
                defaultValue: '',
                meta: { prescriptionField: 'durationDays' },
              },
              {
                id: 'f-qty',
                type: 'number',
                label: 'Quantity',
                defaultValue: '',
                meta: { prescriptionField: 'qty' },
              },
              {
                id: 'f-refill',
                type: 'number',
                label: 'Refills',
                defaultValue: '',
                meta: { prescriptionField: 'refill' },
              },
              {
                id: 'f-instructions',
                type: 'textarea',
                label: 'Instructions',
                defaultValue: '',
                meta: { prescriptionField: 'instructions' },
              },
            ],
          },
        ] as unknown as FormField[],
      }) as FormField;

    const readMedicineField = (key: string): any => {
      const medGroup = (readSchema()[0] as any).fields[0];
      return medGroup.fields.find((f: any) => f.meta?.prescriptionField === key);
    };

    it('renders the medicine card summary and edits prescription values', () => {
      renderBuild(baseFormData({ schema: [medicineGroupField()] }));

      expect(screen.getByText('Amoxil')).toBeInTheDocument();
      expect(screen.getByText(/BrandX • 250 mg • SKU SKU-9/)).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('med-a_group-duration'), { target: { value: '7' } });
      expect(readMedicineField('durationDays').defaultValue).toBe('7');

      fireEvent.change(screen.getByTestId('med-a_group-qty'), { target: { value: '14' } });
      expect(readMedicineField('qty').defaultValue).toBe('14');

      fireEvent.change(screen.getByTestId('med-a_group-refill'), { target: { value: '2' } });
      expect(readMedicineField('refill').defaultValue).toBe('2');

      fireEvent.change(screen.getByTestId('med-a_group-instructions'), {
        target: { value: 'With food' },
      });
      expect(readMedicineField('instructions').defaultValue).toBe('With food');
    });

    it('sets route and frequency from the card dropdowns', () => {
      renderBuild(baseFormData({ schema: [medicineGroupField()] }));

      // Options render flat; route options come first, then frequency options.
      const options = screen.getAllByRole('option');
      fireEvent.click(options[0]);
      expect(readMedicineField('route').defaultValue).toBeTruthy();
    });

    it('removes a medicine from the group', () => {
      renderBuild(baseFormData({ schema: [medicineGroupField()] }));

      fireEvent.click(screen.getByRole('button', { name: /Remove Amoxil/i }));
      expect((readSchema()[0] as any).fields).toHaveLength(0);
    });

    it('renames the medication group', () => {
      renderBuild(baseFormData({ schema: [medicineGroupField()] }));

      fireEvent.change(screen.getByTestId('group-mg-1-label'), {
        target: { value: 'Discharge meds' },
      });
      expect((readSchema()[0] as any).label).toBe('Discharge meds');
    });

    it('ignores non-group entries inside the medication group and logs fetch errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
        selector({ primaryOrgId: 'org-1' })
      );
      (fetchInventoryItems as jest.Mock).mockRejectedValue(new Error('network down'));

      const group: FormField = {
        id: 'mg-1',
        type: 'group',
        label: 'Medication',
        meta: { medicationGroup: true },
        fields: [{ id: 'stray', type: 'input', label: 'Stray' } as FormField],
      } as FormField;

      renderBuild(baseFormData({ schema: [group] }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load medicines:', expect.any(Error));
      });
      consoleSpy.mockRestore();
    });
  });

  describe('task block card option fallbacks', () => {
    it('falls back to the shared option vocabularies when block fields have no options', () => {
      const blockId = 'tb-1';
      const taskGroup: FormField = {
        id: 'task_blocks',
        type: 'group',
        label: 'Tasks',
        meta: { taskGroup: true },
        fields: [
          {
            id: blockId,
            type: 'group',
            label: 'Task 1',
            meta: { taskBlock: true, taskBlockId: blockId },
            fields: [
              {
                id: `${blockId}_name`,
                type: 'input',
                label: 'Task title',
                meta: { taskBlockKey: 'name' },
              },
              {
                id: `${blockId}_category`,
                type: 'dropdown',
                label: 'Category',
                options: [],
                meta: { taskBlockKey: 'category' },
              },
              {
                id: `${blockId}_recurrence`,
                type: 'dropdown',
                label: 'Repeat',
                options: [],
                meta: { taskBlockKey: 'recurrence.type' },
              },
              {
                id: `${blockId}_reminder`,
                type: 'dropdown',
                label: 'Reminder (optional)',
                options: [],
                meta: { taskBlockKey: 'reminderOffsetMinutes' },
              },
            ],
          },
        ] as FormField[],
      } as FormField;

      renderBuild(baseFormData({ category: 'Task Template', schema: [taskGroup] }));

      fireEvent.click(screen.getByRole('option', { name: 'Medication' }));
      const block = (readSchema()[0] as any).fields[0];
      const category = block.fields.find((f: any) => f.meta?.taskBlockKey === 'category');
      expect(category.defaultValue).toBe('MEDICATION');
    });
  });

  describe('drag and drop reordering', () => {
    let rafCallbacks: FrameRequestCallback[];

    beforeEach(() => {
      rafCallbacks = [];
      jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
      // jsdom has no scrollingElement; point it at documentElement.
      Object.defineProperty(document, 'scrollingElement', {
        value: document.documentElement,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(document, 'scrollingElement', { value: null, configurable: true });
    });

    const dragSchema = (): FormField[] => [
      { id: 'a', type: 'input', label: 'A' } as FormField,
      { id: 'b', type: 'number', label: 'B' } as FormField,
      { id: 'c', type: 'date', label: 'C' } as FormField,
    ];

    const dataTransfer = () => ({ effectAllowed: '', dropEffect: '', setData: jest.fn() });

    // jsdom has no DragEvent, and fireEvent's fallback drops clientY. Build a real
    // MouseEvent (drag events share its interface) and attach dataTransfer manually.
    const fireDrag = (el: Element, type: string, clientY = 0) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer() });
      act(() => {
        el.dispatchEvent(event);
      });
    };

    it('reorders a field by dragging it onto a later field', () => {
      renderBuild(baseFormData({ schema: dragSchema() }));

      const [aSection, cSection] = [
        screen.getByLabelText('Input field'),
        screen.getByLabelText('Date field'),
      ];

      fireDrag(aSection, 'dragstart');
      fireDrag(cSection, 'dragover');
      fireDrag(cSection, 'drop');

      expect(readSchema().map((f) => f.id)).toEqual(['b', 'a', 'c']);
    });

    it('drops after the target when the pointer is below its midpoint and guards out-of-range drops', () => {
      renderBuild(baseFormData({ schema: dragSchema() }));

      const cSection = screen.getByLabelText('Date field');
      const bSection = screen.getByLabelText('Number field');

      // dragIndex null → dragOver/drop are no-ops
      fireDrag(cSection, 'dragover');
      fireDrag(cSection, 'drop');
      expect(readSchema().map((f) => f.id)).toEqual(['a', 'b', 'c']);

      // isAfter (clientY > midpoint of zero-rect) → destination index+1 = 3, out of range → no-op
      fireDrag(bSection, 'dragstart');
      fireDrag(cSection, 'drop', 10);
      expect(readSchema().map((f) => f.id)).toEqual(['a', 'b', 'c']);
    });

    it('dropping a field onto itself keeps the order', () => {
      renderBuild(baseFormData({ schema: dragSchema() }));

      const aSection = screen.getByLabelText('Input field');
      fireDrag(aSection, 'dragstart');
      fireDrag(aSection, 'drop');

      expect(readSchema().map((f) => f.id)).toEqual(['a', 'b', 'c']);
    });

    it('auto-scrolls near the viewport bottom and stops on drag end', () => {
      renderBuild(baseFormData({ schema: dragSchema() }));

      const scrollable = document.scrollingElement as HTMLElement;
      Object.defineProperty(scrollable, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });

      const aSection = screen.getByLabelText('Input field');
      const bSection = screen.getByLabelText('Number field');

      fireDrag(aSection, 'dragstart');
      fireDrag(bSection, 'dragover', globalThis.innerHeight - 5);

      expect(rafCallbacks.length).toBeGreaterThan(0);
      act(() => {
        rafCallbacks.shift()?.(0);
      });
      expect(scrollable.scrollTop).toBeGreaterThan(0);

      fireEvent.dragEnd(aSection);
      act(() => {
        rafCallbacks.shift()?.(0);
      });
      expect(readSchema().map((f) => f.id)).toEqual(['a', 'b', 'c']);
    });

    it('auto-scrolls upward when dragging near the top with scroll offset', () => {
      renderBuild(baseFormData({ schema: dragSchema() }));

      const scrollable = document.scrollingElement as HTMLElement;
      Object.defineProperty(scrollable, 'scrollTop', {
        value: 500,
        writable: true,
        configurable: true,
      });

      const aSection = screen.getByLabelText('Input field');
      const bSection = screen.getByLabelText('Number field');

      fireDrag(aSection, 'dragstart');
      fireDrag(bSection, 'dragover', 5);

      act(() => {
        rafCallbacks.shift()?.(0);
      });
      expect(scrollable.scrollTop).toBeLessThan(500);

      fireDrag(bSection, 'drop');
    });

    it('uses the builder container as scroll target when it overflows', () => {
      const { container } = renderBuild(baseFormData({ schema: dragSchema() }));

      const builderDiv = container.querySelector('.justify-between') as HTMLElement;
      Object.defineProperty(builderDiv, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(builderDiv, 'clientHeight', { value: 100, configurable: true });
      Object.defineProperty(builderDiv, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });

      const aSection = screen.getByLabelText('Input field');
      const bSection = screen.getByLabelText('Number field');

      fireDrag(aSection, 'dragstart');
      fireDrag(bSection, 'dragover', 50);
      fireDrag(aSection, 'dragend');

      expect(readSchema().map((f) => f.id)).toEqual(['a', 'b', 'c']);
    });
  });
});
