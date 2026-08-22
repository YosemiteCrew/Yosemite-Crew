import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HospitalizationModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/HospitalizationModal';

// ── Icons ─────────────────────────────────────────────────────────────────────
jest.mock('react-icons/io5', () => ({
  IoAdd: () => <span data-testid="io-add" />,
  IoCheckmarkOutline: () => <span data-testid="io-check" />,
  IoPerson: () => <span data-testid="io-person" />,
}));

// ── Companion terminology (title transform) ────────────────────────────────────
jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => `T:${text}`,
}));

// ── Shared shell / estimate ────────────────────────────────────────────────────
jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell',
  () => ({
    __esModule: true,
    default: ({ children, title, setShowModal }: any) => (
      <div data-testid="modal-shell">
        <span data-testid="modal-title">{title}</span>
        <button type="button" data-testid="shell-close" onClick={() => setShowModal(false)}>
          close
        </button>
        {children}
      </div>
    ),
  })
);

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel',
  () => ({
    __esModule: true,
    default: ({ cost, maxDiscount }: any) => (
      <div data-testid="estimate">{`${cost}|${maxDiscount}`}</div>
    ),
  })
);

// ── Staff field ────────────────────────────────────────────────────────────────
jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField', () => ({
  __esModule: true,
  default: ({ label, name }: any) => (
    <div data-testid="staff-field">{`${label}: ${name ?? 'none'}`}</div>
  ),
}));

// ── Datepicker ─────────────────────────────────────────────────────────────────
jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`datepicker-${props.placeholder}`}>
      <button
        type="button"
        data-testid={`dp-set-${props.placeholder}`}
        onClick={() => props.setCurrentDate?.(new Date('2025-06-10T00:00:00Z'))}
      >
        set
      </button>
      <button
        type="button"
        data-testid={`dp-early-${props.placeholder}`}
        onClick={() => props.setCurrentDate?.(new Date('2025-01-01T00:00:00Z'))}
      >
        early
      </button>
      <button
        type="button"
        data-testid={`dp-late-${props.placeholder}`}
        onClick={() => props.setCurrentDate?.(new Date('2025-12-31T00:00:00Z'))}
      >
        late
      </button>
      <button
        type="button"
        data-testid={`dp-clear-${props.placeholder}`}
        onClick={() => props.setCurrentDate?.(null)}
      >
        clear
      </button>
      <span data-testid={`dp-min-${props.placeholder}`}>
        {props.minDate ? props.minDate.toISOString() : 'none'}
      </span>
    </div>
  ),
}));

// ── Timepicker ─────────────────────────────────────────────────────────────────
jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: (props: any) => (
    <input
      data-testid="timepicker"
      aria-label={props.label}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
    />
  ),
}));

// ── LabelDropdown (Room / Unit / Assigned Support) ─────────────────────────────
jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid={`label-dropdown-${props.placeholder}`}
      data-default-option={props.defaultOption ?? ''}
    >
      {(props.options ?? []).map((opt: any) => (
        <button
          key={opt.value}
          type="button"
          data-testid={`ld-${props.placeholder}-${opt.value}`}
          onClick={() => props.onSelect?.(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

// ── MultiSelectDropdown (service / package) ────────────────────────────────────
jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="multi-select">
      {(props.options ?? []).map((opt: any) => (
        <button
          key={opt.value}
          type="button"
          data-testid={`pkg-${opt.value}`}
          onClick={() => props.onChange?.([...(props.value ?? []), opt.value])}
        >
          {`${opt.label}:${opt.badge}`}
        </button>
      ))}
      <span data-testid="selected-pkgs">{JSON.stringify(props.value)}</span>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/ButtonEffects.css', () => ({}), { virtual: true });

// ── Test fixtures ──────────────────────────────────────────────────────────────
type Props = React.ComponentProps<typeof HospitalizationModal>;

const makeProps = (overrides: Partial<Props> = {}): Props => ({
  showModal: true,
  setShowModal: jest.fn(),
  leadName: 'Dr. Lead',
  supportName: 'Nurse Joy',
  supportOptions: [
    { label: 'Nurse Joy', value: 's1' },
    { label: 'Dr. Aux', value: 's2' },
  ],
  roomOptions: [
    { label: 'Room 1', value: 'r1' },
    { label: 'Room 2', value: 'r2' },
    { label: 'Room 3', value: 'r3' },
    { label: 'Room 4', value: 'r4' },
  ],
  unitOptions: [{ label: 'Default Unit', value: 'ud' }],
  unitOptionsByRoomId: {
    r1: [
      { label: 'Unit 1', value: 'u1' },
      { label: 'Unit 2', value: 'u2' },
    ],
    r2: [
      { label: 'Unit 1', value: 'u1' },
      { label: 'Unit 9', value: 'u9' },
    ],
    r3: [],
    r4: [{ label: 'Unit X', value: 'ux' }],
  },
  servicePackages: [
    { id: 'p1', kind: 'PACKAGE', name: 'Wellness', cost: 100, maxDiscount: 10 },
    { id: 'p2', kind: 'SERVICE', name: 'X-Ray', cost: 0, maxDiscount: 0 },
  ],
  defaultRoomId: 'r1',
  defaultUnitId: 'u1',
  onConvert: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const convertButton = () => screen.getByRole('button', { name: /Convert to Inpatient/i });

describe('HospitalizationModal', () => {
  it('renders nothing when showModal is false', () => {
    const { container } = render(<HospitalizationModal {...makeProps({ showModal: false })} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();
  });

  it('renders the shell with terminology-applied title and default field state', () => {
    render(<HospitalizationModal {...makeProps()} />);

    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('T:Hospitalizing Patient');
    expect(screen.getByTestId('staff-field')).toHaveTextContent('Assigned lead: Dr. Lead');
    // No packages selected → zeroed estimate.
    expect(screen.getByTestId('estimate')).toHaveTextContent('0|0');
    // Support defaulted from the matching supportName.
    expect(screen.getByTestId('label-dropdown-Assigned Support')).toHaveAttribute(
      'data-default-option',
      's1'
    );
    // Discharge picker receives the admission date as its min bound.
    expect(screen.getByTestId('dp-min-Date of discharge (tentative)')).not.toHaveTextContent(
      'none'
    );
  });

  it('leaves support unset when no supportOption matches supportName', () => {
    render(<HospitalizationModal {...makeProps({ supportName: 'Nobody' })} />);
    expect(screen.getByTestId('label-dropdown-Assigned Support')).toHaveAttribute(
      'data-default-option',
      ''
    );
  });

  it('recomputes the estimate and labels package badges when packages are selected', () => {
    render(<HospitalizationModal {...makeProps()} />);

    expect(screen.getByTestId('pkg-p1')).toHaveTextContent('Wellness:Package');
    expect(screen.getByTestId('pkg-p2')).toHaveTextContent('X-Ray:Service');

    fireEvent.click(screen.getByTestId('pkg-p1'));
    expect(screen.getByTestId('estimate')).toHaveTextContent('100|10');

    // Adding a zero-cost service keeps the totals (exercises the Number(..) || 0 fallback).
    fireEvent.click(screen.getByTestId('pkg-p2'));
    expect(screen.getByTestId('estimate')).toHaveTextContent('100|10');
    expect(screen.getByTestId('selected-pkgs')).toHaveTextContent('["p1","p2"]');
  });

  it('uses the base unitOptions when no room is selected', () => {
    render(
      <HospitalizationModal
        {...makeProps({ defaultRoomId: undefined, defaultUnitId: undefined })}
      />
    );
    expect(screen.getByTestId('ld-Unit-ud')).toBeInTheDocument();
  });

  it('falls back to base unitOptions when there is no room-to-unit mapping', () => {
    render(
      <HospitalizationModal
        {...makeProps({ unitOptionsByRoomId: undefined, defaultRoomId: 'r1' })}
      />
    );
    // activeUnitOptions resolves to unitOptions via the ?? fallback.
    expect(screen.getByTestId('ld-Unit-ud')).toBeInTheDocument();
  });

  it('renders room-scoped units when a room mapping exists', () => {
    render(<HospitalizationModal {...makeProps()} />);
    expect(screen.getByTestId('ld-Unit-u1')).toBeInTheDocument();
    expect(screen.getByTestId('ld-Unit-u2')).toBeInTheDocument();
  });

  it('clears the unit when the newly selected room has no units', () => {
    render(<HospitalizationModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('ld-Room-r3')); // r3 -> []
    // No unit options remain and the selected unit is cleared.
    expect(screen.queryByTestId('ld-Unit-u1')).not.toBeInTheDocument();
    expect(screen.getByTestId('label-dropdown-Unit')).toHaveAttribute('data-default-option', '');
  });

  it('keeps a still-valid unit and otherwise selects the first room unit', () => {
    render(<HospitalizationModal {...makeProps()} />);

    // r2 still contains u1 → unit is preserved.
    fireEvent.click(screen.getByTestId('ld-Room-r2'));
    expect(screen.getByTestId('label-dropdown-Unit')).toHaveAttribute('data-default-option', 'u1');

    // r4 does not contain u1 → falls back to the first unit (ux).
    fireEvent.click(screen.getByTestId('ld-Room-r4'));
    expect(screen.getByTestId('label-dropdown-Unit')).toHaveAttribute('data-default-option', 'ux');
  });

  it('shows room/unit validation errors after submitting an incomplete form', async () => {
    const onConvert = jest.fn();
    render(
      <HospitalizationModal
        {...makeProps({
          onConvert,
          unitOptionsByRoomId: undefined,
          defaultRoomId: undefined,
          defaultUnitId: undefined,
        })}
      />
    );

    fireEvent.click(convertButton());
    await flush();

    expect(screen.getByText('Room is required.')).toBeInTheDocument();
    expect(screen.getByText('Unit is required.')).toBeInTheDocument();
    expect(onConvert).not.toHaveBeenCalled();
  });

  it('flags missing admission date and blank admission time', async () => {
    const onConvert = jest.fn();
    render(<HospitalizationModal {...makeProps({ onConvert })} />);

    fireEvent.click(screen.getByTestId('dp-clear-Date of admission'));
    fireEvent.change(screen.getByTestId('timepicker'), { target: { value: '   ' } });

    fireEvent.click(convertButton());
    await flush();

    expect(screen.getByText('Admission date is required.')).toBeInTheDocument();
    expect(screen.getByText('Admission time is required.')).toBeInTheDocument();
    expect(onConvert).not.toHaveBeenCalled();
  });

  it('flags a discharge date that precedes the admission date', async () => {
    const onConvert = jest.fn();
    render(<HospitalizationModal {...makeProps({ onConvert })} />);

    fireEvent.click(screen.getByTestId('dp-late-Date of admission')); // 2025-12-31
    fireEvent.click(screen.getByTestId('dp-early-Date of discharge (tentative)')); // 2025-01-01

    fireEvent.click(convertButton());
    await flush();

    expect(screen.getByText('Tentative discharge cannot be before admission.')).toBeInTheDocument();
    expect(onConvert).not.toHaveBeenCalled();
  });

  // The notify-channel checkboxes were removed: nothing downstream accepts a notify
  // channel (no field in packages/types, apps/backend, or the Prisma schema), and the
  // onConvert handler in AppointmentWorkspace dropped the payload field on the floor,
  // so the user's choice was silently discarded on convert. Do not re-add the control
  // without a real backend field to persist it to.
  it('does not render notify-channel checkboxes', () => {
    render(<HospitalizationModal {...makeProps()} />);

    expect(screen.queryByRole('checkbox', { name: /notify/i })).not.toBeInTheDocument();
  });

  it('updates the ripple css variables on pointer interactions', () => {
    render(<HospitalizationModal {...makeProps()} />);
    const btn = convertButton();
    fireEvent.pointerDown(btn, { clientX: 5, clientY: 8 });
    fireEvent.pointerMove(btn, { clientX: 12, clientY: 16 });
    expect(btn.style.getPropertyValue('--yc-button-x')).not.toBe('');
    expect(btn.style.getPropertyValue('--yc-button-y')).not.toBe('');
  });

  it('converts successfully and closes the modal', async () => {
    const onConvert = jest.fn().mockResolvedValue(true);
    const setShowModal = jest.fn();
    render(<HospitalizationModal {...makeProps({ onConvert, setShowModal })} />);

    await act(async () => {
      fireEvent.click(convertButton());
    });
    await flush();

    expect(onConvert).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r1',
        unitId: 'u1',
        supportStaffId: 's1',
        servicePackageIds: [],
      })
    );
    // The payload carries no notify field — nothing downstream can persist one.
    expect(onConvert.mock.calls[0][0]).not.toHaveProperty('notifyChannels');
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('submits a null discharge date when the discharge is cleared', async () => {
    const onConvert = jest.fn().mockResolvedValue(true);
    render(<HospitalizationModal {...makeProps({ onConvert })} />);

    fireEvent.click(screen.getByTestId('dp-clear-Date of discharge (tentative)'));

    await act(async () => {
      fireEvent.click(convertButton());
    });
    await flush();

    expect(onConvert).toHaveBeenCalledWith(expect.objectContaining({ dischargeDate: null }));
  });

  it('keeps the modal open when onConvert resolves false', async () => {
    const onConvert = jest.fn().mockResolvedValue(false);
    const setShowModal = jest.fn();
    render(<HospitalizationModal {...makeProps({ onConvert, setShowModal })} />);

    await act(async () => {
      fireEvent.click(convertButton());
    });
    await flush();

    expect(onConvert).toHaveBeenCalled();
    expect(setShowModal).not.toHaveBeenCalled();
  });

  // NOTE: a rejecting onConvert is deliberately not tested here. handleConvert wraps
  // the call in try/finally with no catch, so a rejection escapes as an unhandled
  // rejection rather than being surfaced to the user. That is a real (pre-existing)
  // error-handling gap, but fixing it means deciding how to report the failure, which
  // is out of scope for a coverage change. The finally{} reset is already covered by
  // the success and falsy-return cases above.

  it('resets field state when the modal is reopened', async () => {
    const props = makeProps();
    const { rerender } = render(<HospitalizationModal {...props} />);

    // Mutate state: pick a package and switch rooms.
    fireEvent.click(screen.getByTestId('pkg-p1'));
    fireEvent.click(screen.getByTestId('ld-Room-r2'));
    expect(screen.getByTestId('estimate')).toHaveTextContent('100|10');

    // Close then reopen — the show-modal transition resets the fields.
    rerender(<HospitalizationModal {...props} showModal={false} />);
    rerender(<HospitalizationModal {...props} showModal />);

    expect(screen.getByTestId('estimate')).toHaveTextContent('0|0');
    expect(screen.getByTestId('label-dropdown-Room')).toHaveAttribute('data-default-option', 'r1');
    expect(screen.getByTestId('label-dropdown-Unit')).toHaveAttribute('data-default-option', 'u1');
    expect(screen.getByTestId('selected-pkgs')).toHaveTextContent('[]');
  });

  it('closes via the shell close control', () => {
    const setShowModal = jest.fn();
    render(<HospitalizationModal {...makeProps({ setShowModal })} />);
    fireEvent.click(screen.getByTestId('shell-close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('adopts defaults that arrive after the modal is already open', async () => {
    // Room, unit and support defaults are loaded asynchronously. Only the open
    // transition adopted them, so a modal opened before the load finished kept
    // undefined selections and blocked the conversion on errors the user could
    // not clear.
    const { rerender } = render(
      <HospitalizationModal
        {...makeProps({ defaultRoomId: undefined, defaultUnitId: undefined })}
      />
    );
    await flush();

    rerender(<HospitalizationModal {...makeProps({ defaultRoomId: 'r1', defaultUnitId: 'u1' })} />);
    await flush();

    expect(screen.getByTestId('label-dropdown-Room')).toHaveAttribute('data-default-option', 'r1');
    expect(screen.getByTestId('label-dropdown-Unit')).toHaveAttribute('data-default-option', 'u1');
  });
});
