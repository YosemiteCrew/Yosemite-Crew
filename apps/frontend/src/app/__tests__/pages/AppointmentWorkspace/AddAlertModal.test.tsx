import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddAlertModal from '@/app/features/appointments/pages/AppointmentWorkspace/components/AddAlertModal';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close header
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, inlabel, onChange }: any) => (
    <input aria-label={inlabel} value={value} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ value: 'high', label: 'High' })}>
      pick severity
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('AddAlertModal', () => {
  const setup = (open = true) => {
    const onClose = jest.fn();
    const onAdd = jest.fn();
    render(
      <AddAlertModal open={open} companionName="Gigi Hadid" onClose={onClose} onAdd={onAdd} />
    );
    return { onClose, onAdd };
  };

  it('renders nothing when closed', () => {
    setup(false);
    expect(screen.queryByText('Add alert')).not.toBeInTheDocument();
  });

  it('disables the add button until a label is entered', () => {
    setup();
    const addButton = screen.getByRole('button', { name: 'Add alert' });
    expect(addButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/alert \(e\.g\./i), {
      target: { value: 'Needs muzzle' },
    });
    expect(addButton).not.toBeDisabled();
  });

  it('adds the alert with the chosen severity and closes', () => {
    const { onAdd, onClose } = setup();
    fireEvent.change(screen.getByLabelText(/alert \(e\.g\./i), {
      target: { value: '  Diabetic  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'pick severity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add alert' }));
    expect(onAdd).toHaveBeenCalledWith({ label: 'Diabetic', severity: 'high' });
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels without adding', () => {
    const { onAdd, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
