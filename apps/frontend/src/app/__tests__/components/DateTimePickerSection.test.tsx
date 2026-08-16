import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import DateTimePickerSection from '@/app/features/appointments/components/DateTimePickerSection';

jest.mock('@/app/ui/inputs/Slotpicker', () => ({
  __esModule: true,
  default: () => <div data-testid="slotpicker" />,
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({
    inname,
    inlabel,
    value,
    onFocus,
    onClick,
    onChange,
    error,
    className,
    readonly,
    tabIndex,
  }: any) => (
    <div>
      <input
        aria-label={inlabel}
        data-testid={`input-${inname}`}
        value={value}
        onFocus={onFocus}
        onClick={onClick}
        onChange={onChange}
        readOnly={readonly}
        tabIndex={tabIndex}
        className={className}
      />
      {error ? <span data-testid={`error-${inname}`}>{error}</span> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, defaultOption, error, options, onSelect }: any) => (
    <div data-testid="lead-dropdown">
      <span data-testid="lead-placeholder">{placeholder}</span>
      <span data-testid="lead-default">{defaultOption ?? 'none'}</span>
      <span data-testid="lead-error">{error ?? 'none'}</span>
      <span data-testid="lead-options">{options.map((o: any) => o.label).join(',')}</span>
      <button type="button" onClick={() => onSelect(options[0])}>
        Pick lead
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value, options, onChange }: any) => (
    <div data-testid="support-dropdown">
      <span data-testid="support-placeholder">{placeholder}</span>
      <span data-testid="support-value">{value.join(',') || 'empty'}</span>
      <button type="button" onClick={() => onChange([options[0].value])}>
        Pick support
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getFormattedDate: () => '01 Mar 2026',
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  formatUtcTimeToLocalLabel: (value: string) => `local(${value})`,
}));

const leadOptions = [
  { label: 'Dr. A', value: 'lead-1' },
  { label: 'Dr. B', value: 'lead-2' },
];
const teamOptions = [
  { label: 'Nurse Joy', value: 'staff-1' },
  { label: 'Nurse Sam', value: 'staff-2' },
];

const baseProps = {
  selectedDate: new Date('2026-03-01T00:00:00Z'),
  setSelectedDate: jest.fn(),
  selectedSlot: { startTime: '10:00:00', endTime: '10:30:00' } as any,
  setSelectedSlot: jest.fn(),
  timeSlots: [] as any[],
  leadOptions,
  onLeadSelect: jest.fn(),
};

describe('DateTimePickerSection', () => {
  it('renders the slot picker, date, time, lead and support controls with default props', () => {
    render(
      <DateTimePickerSection
        {...baseProps}
        teamOptions={teamOptions}
        onSupportStaffChange={jest.fn()}
      />
    );

    // hideDateSlotPicker defaults to false -> the slot picker shows.
    expect(screen.getByTestId('slotpicker')).toBeInTheDocument();
    expect(screen.getByTestId('input-date')).toHaveValue('01 Mar 2026');
    expect(screen.getByTestId('input-time')).toHaveValue('local(10:00:00)');
    // showSupportStaff defaults to true.
    expect(screen.getByTestId('support-dropdown')).toBeInTheDocument();
    // supportStaffIds is undefined -> falls back to an empty array.
    expect(screen.getByTestId('support-value')).toHaveTextContent('empty');
  });

  // The date is only ever set via the Slotpicker, so the field is display-only on
  // every path — including the default one, where it previously accepted keystrokes
  // that were silently discarded by a no-op onChange.
  it.each([
    ['the slot picker is shown', false],
    ['the slot picker is hidden', true],
  ])('locks the date input when %s', (_label, hideDateSlotPicker) => {
    render(<DateTimePickerSection {...baseProps} hideDateSlotPicker={hideDateSlotPicker} />);

    const dateInput = screen.getByTestId('input-date') as HTMLInputElement;
    expect(dateInput).toHaveAttribute('readonly');
    expect(dateInput).toHaveAttribute('tabindex', '-1');
    expect(dateInput).toHaveClass('cursor-default');

    // The locked date input refuses focus and swallows clicks.
    const blurSpy = jest.spyOn(dateInput, 'blur');
    fireEvent.focus(dateInput);
    expect(blurSpy).toHaveBeenCalled();

    const clickEvent = createBubbledClick();
    dateInput.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('does not let typing change the displayed date on the default path', async () => {
    render(<DateTimePickerSection {...baseProps} />);

    const dateInput = screen.getByTestId('input-date') as HTMLInputElement;
    await userEvent.type(dateInput, '25 Dec 2027');

    // The real effect: the value is unchanged, and the parent was never asked to change it.
    expect(dateInput).toHaveValue('01 Mar 2026');
    expect(baseProps.setSelectedDate).not.toHaveBeenCalled();
  });

  it('hides the slot picker when hideDateSlotPicker is set', () => {
    render(<DateTimePickerSection {...baseProps} hideDateSlotPicker />);

    expect(screen.queryByTestId('slotpicker')).not.toBeInTheDocument();
  });

  it('always locks the time input', () => {
    render(<DateTimePickerSection {...baseProps} />);

    const timeInput = screen.getByTestId('input-time') as HTMLInputElement;
    expect(timeInput).toHaveAttribute('readonly');
    expect(timeInput).toHaveAttribute('tabindex', '-1');

    const blurSpy = jest.spyOn(timeInput, 'blur');
    fireEvent.focus(timeInput);
    expect(blurSpy).toHaveBeenCalled();

    const clickEvent = createBubbledClick();
    timeInput.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('renders an empty time when no slot is selected', () => {
    render(<DateTimePickerSection {...baseProps} selectedSlot={null} />);
    expect(screen.getByTestId('input-time')).toHaveValue('');
  });

  it('renders an empty time when the selected slot has no start time', () => {
    render(<DateTimePickerSection {...baseProps} selectedSlot={{ endTime: '10:30:00' } as any} />);
    expect(screen.getByTestId('input-time')).toHaveValue('');
  });

  it('surfaces slot and lead errors', () => {
    render(
      <DateTimePickerSection {...baseProps} slotError="Pick a slot" leadError="Pick a lead" />
    );

    expect(screen.getByTestId('error-time')).toHaveTextContent('Pick a slot');
    expect(screen.getByTestId('lead-error')).toHaveTextContent('Pick a lead');
  });

  it('renders skeletons instead of the time and lead inputs while slots load', () => {
    const { container } = render(<DateTimePickerSection {...baseProps} isLoadingSlot />);

    expect(screen.queryByTestId('input-time')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lead-dropdown')).not.toBeInTheDocument();
    // The date input is unaffected by the loading state.
    expect(screen.getByTestId('input-date')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
  });

  it('passes the selected lead through and reports selections', () => {
    const onLeadSelect = jest.fn();
    render(<DateTimePickerSection {...baseProps} leadId="lead-2" onLeadSelect={onLeadSelect} />);

    expect(screen.getByTestId('lead-default')).toHaveTextContent('lead-2');
    expect(screen.getByTestId('lead-options')).toHaveTextContent('Dr. A,Dr. B');

    fireEvent.click(screen.getByText('Pick lead'));
    expect(onLeadSelect).toHaveBeenCalledWith(leadOptions[0]);
  });

  it('renders the current support staff and reports changes', () => {
    const onSupportStaffChange = jest.fn();
    render(
      <DateTimePickerSection
        {...baseProps}
        supportStaffIds={['staff-2']}
        teamOptions={teamOptions}
        onSupportStaffChange={onSupportStaffChange}
      />
    );

    expect(screen.getByTestId('support-value')).toHaveTextContent('staff-2');

    fireEvent.click(screen.getByText('Pick support'));
    expect(onSupportStaffChange).toHaveBeenCalledWith(['staff-1']);
  });

  it('hides the support dropdown when showSupportStaff is false', () => {
    render(
      <DateTimePickerSection
        {...baseProps}
        showSupportStaff={false}
        teamOptions={teamOptions}
        onSupportStaffChange={jest.fn()}
      />
    );

    expect(screen.queryByTestId('support-dropdown')).not.toBeInTheDocument();
  });

  it('hides the support dropdown when team options are missing', () => {
    render(<DateTimePickerSection {...baseProps} onSupportStaffChange={jest.fn()} />);
    expect(screen.queryByTestId('support-dropdown')).not.toBeInTheDocument();
  });

  it('hides the support dropdown when no change handler is supplied', () => {
    render(<DateTimePickerSection {...baseProps} teamOptions={teamOptions} />);
    expect(screen.queryByTestId('support-dropdown')).not.toBeInTheDocument();
  });
});

function createBubbledClick() {
  return new MouseEvent('click', { bubbles: true, cancelable: true });
}
