import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import AppointmentDetailsSection from '@/app/features/appointments/components/AppointmentDetailsSection';

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <section data-testid="appointment-accordion">
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, error }: any) => (
    <div>
      <div>{placeholder}</div>
      {error ? <div>{error}</div> : null}
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onSelect(option)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ value, onChange, onFocus, onBlur, error }: any) => (
    <div>
      {error ? <div>{error}</div> : null}
      <textarea
        aria-label="concern"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('AppointmentDetailsSection', () => {
  const props = {
    specialitiesOptions: [{ label: 'Surgery', value: 'surgery' }],
    servicesOptions: [{ label: 'Consult', value: 'consult' }],
    onSpecialitySelect: jest.fn(),
    onServiceSelect: jest.fn(),
    concern: 'Initial concern',
    onConcernChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and handles selections/input', () => {
    const onConcernFocus = jest.fn();
    const onConcernBlur = jest.fn();

    render(
      <AppointmentDetailsSection
        {...props}
        specialityError="Select speciality"
        serviceError="Select service"
        concernError="Add concern"
        onConcernFocus={onConcernFocus}
        onConcernBlur={onConcernBlur}
      />
    );

    expect(screen.getByTestId('appointment-accordion')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Surgery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consult' }));

    const concernInput = screen.getByLabelText('concern');
    fireEvent.change(concernInput, { target: { value: 'Updated concern' } });
    fireEvent.focus(concernInput);
    fireEvent.blur(concernInput);

    expect(props.onSpecialitySelect).toHaveBeenCalledWith({ label: 'Surgery', value: 'surgery' });
    expect(props.onServiceSelect).toHaveBeenCalledWith({ label: 'Consult', value: 'consult' });
    expect(props.onConcernChange).toHaveBeenCalledWith('Updated concern');
    expect(onConcernFocus).toHaveBeenCalled();
    expect(onConcernBlur).toHaveBeenCalled();
  });

  it('renders next button only when onNext is provided', () => {
    const onNext = jest.fn();
    const { rerender } = render(<AppointmentDetailsSection {...props} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalled();

    rerender(<AppointmentDetailsSection {...props} />);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
