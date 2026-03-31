import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Build from '@/app/features/forms/pages/Forms/Sections/AddForm/Build';
import { FormsProps } from '@/app/features/forms/types/forms';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: () => <div>multi-select</div>,
}));

jest.mock('@/app/ui/inputs/Dropdown/Dropdown', () => ({
  __esModule: true,
  default: () => <div>dropdown</div>,
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextBuilder', () => ({
  __esModule: true,
  default: ({ field }: any) => <div>{`text-${field.id}`}</div>,
}));

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Input/InputBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div>{`input-${field.id}`}</div>,
  })
);

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Dropdown/DropdownBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div>{`dropdown-${field.id}`}</div>,
  })
);

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Signature/SignatureBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div>{`signature-${field.id}`}</div>,
  })
);

jest.mock(
  '@/app/features/forms/pages/Forms/Sections/AddForm/components/Boolean/BooleanBuilder',
  () => ({
    __esModule: true,
    default: ({ field }: any) => <div>{`boolean-${field.id}`}</div>,
  })
);

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/Date/DateBuilder', () => ({
  __esModule: true,
  default: ({ field }: any) => <div>{`date-${field.id}`}</div>,
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper', () => ({
  __esModule: true,
  default: ({ field, children, onDelete }: any) => (
    <div data-testid={`wrapper-${field.id}`}>
      <button type="button" onClick={onDelete}>
        {`delete-${field.id}`}
      </button>
      {children}
    </div>
  ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: 'org-1' }),
}));

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn().mockResolvedValue({ items: [] }),
}));

jest.mock('react-icons/io', () => ({
  IoIosAddCircleOutline: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      add-field-toggle
    </button>
  ),
  IoIosWarning: () => <span>warning</span>,
}));

const baseFormData: FormsProps = {
  name: 'Test Form',
  category: 'Prescription',
  requiredSigner: '',
  schema: [],
} as any;

const serviceOptions = [{ label: 'Vaccination', value: 'svc-1' }];

const BuildHarness = ({
  initialFormData = baseFormData,
  onNext = jest.fn(),
  registerValidator,
}: {
  initialFormData?: FormsProps;
  onNext?: jest.Mock;
  registerValidator?: (fn: () => boolean) => void;
}) => {
  const [formData, setFormData] = React.useState<FormsProps>(initialFormData);
  return (
    <Build
      formData={formData}
      setFormData={setFormData}
      onNext={onNext}
      serviceOptions={serviceOptions}
      registerValidator={registerValidator}
    />
  );
};

describe('Build form section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: jest.fn(() => 'fixed-id') },
      configurable: true,
    });
  });

  it('calls onNext when next button is clicked', () => {
    const onNext = jest.fn();
    render(<BuildHarness onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('registers validator and blocks empty schema submit', () => {
    let validateFn: (() => boolean) | undefined;
    render(
      <BuildHarness
        registerValidator={(fn) => {
          validateFn = fn;
        }}
      />
    );

    expect(validateFn).toBeDefined();
    let isValid = true;
    act(() => {
      isValid = validateFn!();
    });
    expect(isValid).toBe(false);
    expect(screen.getByText('Add at least one field to continue.')).toBeInTheDocument();
  });

  it('hides signature option when signer is not selected', () => {
    render(<BuildHarness />);

    fireEvent.click(screen.getAllByRole('button', { name: 'add-field-toggle' })[0]);
    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('adds a signature field when signer is configured', () => {
    render(
      <BuildHarness
        initialFormData={{
          ...baseFormData,
          requiredSigner: 'VET',
        }}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'add-field-toggle' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Signature' }));

    expect(screen.getByTestId('wrapper-signature')).toBeInTheDocument();
    expect(screen.getByText('signature-signature')).toBeInTheDocument();
  });

  it('blocks deleting signature while signer is selected', () => {
    render(
      <BuildHarness
        initialFormData={{
          ...baseFormData,
          requiredSigner: 'VET',
          schema: [{ id: 'sig-1', type: 'signature', label: 'Signature' } as any],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete-sig-1' }));
    expect(
      screen.getByText("Cannot remove signature while 'Signed by' is selected.")
    ).toBeInTheDocument();
    expect(screen.getByTestId('wrapper-sig-1')).toBeInTheDocument();
  });
});
