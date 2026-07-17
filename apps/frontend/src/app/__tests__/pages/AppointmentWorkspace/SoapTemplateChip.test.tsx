import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoapTemplateChip, {
  type SoapTemplateOption,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapTemplateChip';

const TEMPLATES: SoapTemplateOption[] = [
  { id: 't1', name: 'Annual wellness', subtitle: 'Clinic default' },
  { id: 't2', name: 'Dermatology work-up' },
  { id: 't3', name: 'Dental + anaesthesia' },
];

const renderChip = (props: Partial<React.ComponentProps<typeof SoapTemplateChip>> = {}) =>
  render(
    <SoapTemplateChip templates={TEMPLATES} onSelect={props.onSelect ?? jest.fn()} {...props} />
  );

describe('SoapTemplateChip', () => {
  it('shows the active template name on the closed chip', () => {
    renderChip({ activeName: 'Annual wellness' });
    expect(screen.getByRole('button', { name: /Template: Annual wellness/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search SOAP templates')).not.toBeInTheDocument();
  });

  it('falls back to "None" when no template is active', () => {
    renderChip();
    expect(screen.getByRole('button', { name: /Template: None/ })).toBeInTheDocument();
  });

  it('opens the popover and lists every template', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    expect(screen.getByPlaceholderText('Search SOAP templates')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annual wellness/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dermatology work-up/ })).toBeInTheDocument();
  });

  it('filters the list by the search query', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    fireEvent.change(screen.getByLabelText('Search SOAP templates'), {
      target: { value: 'dent' },
    });
    expect(screen.getByRole('button', { name: /Dental \+ anaesthesia/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annual wellness/ })).not.toBeInTheDocument();
  });

  it('shows an empty message when nothing matches', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    fireEvent.change(screen.getByLabelText('Search SOAP templates'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No SOAP templates match this search.')).toBeInTheDocument();
  });

  it('marks the active template with aria-pressed', () => {
    renderChip({ activeName: 'Annual wellness' });
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    // The trigger also contains "Annual wellness"; scope to the pressed option row.
    expect(
      screen.getByRole('button', { name: /Annual wellness/, pressed: true })
    ).toBeInTheDocument();
  });

  it('selects a template and closes', () => {
    const onSelect = jest.fn();
    renderChip({ onSelect });
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    fireEvent.click(screen.getByRole('button', { name: /Dermatology work-up/ }));
    expect(onSelect).toHaveBeenCalledWith('t2');
    expect(screen.queryByPlaceholderText('Search SOAP templates')).not.toBeInTheDocument();
  });

  it('renders and fires the Manage templates action', () => {
    const onManage = jest.fn();
    renderChip({ onManage });
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage templates' }));
    expect(onManage).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText('Search SOAP templates')).not.toBeInTheDocument();
  });

  it('closes when clicking outside the chip', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: /Template:/ }));
    expect(screen.getByPlaceholderText('Search SOAP templates')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('Search SOAP templates')).not.toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    renderChip({ disabled: true });
    const chip = screen.getByRole('button', { name: /Template:/ });
    expect(chip).toBeDisabled();
  });
});
