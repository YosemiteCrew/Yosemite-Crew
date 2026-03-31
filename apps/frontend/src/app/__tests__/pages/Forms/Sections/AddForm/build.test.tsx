import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import Build from '@/app/features/forms/pages/Forms/Sections/AddForm/Build';
import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import { ensureSingleSignatureAtEnd } from '@/app/lib/forms';

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

jest.mock('@/app/ui/inputs/Dropdown/Dropdown', () => ({
  __esModule: true,
  default: ({ options, onChange }: any) => (
    <select
      data-testid="medicine-dropdown"
      defaultValue=""
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select</option>
      {(options || []).map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper', () => ({
  __esModule: true,
  default: ({ field, onDelete, onMoveUp, onMoveDown, children }: any) => (
    <section aria-label={`${field.type.charAt(0).toUpperCase()}${field.type.slice(1)} field`}>
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

  it('uses ensureSingleSignatureAtEnd for Prescription forms', () => {
    renderBuild(baseFormData({ category: 'Prescription', requiredSigner: 'CLIENT' }));

    selectAddOption('Signature');

    expect(ensureSingleSignatureAtEnd).toHaveBeenCalledTimes(1);
    expect(readSchema().some((field) => field.type === 'signature')).toBe(true);
  });

  it('adds a service group with a generated checkbox field', () => {
    renderBuild(baseFormData());

    selectAddOption('Services');

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
});
