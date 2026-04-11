import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChangeStatusModal from '@/app/ui/overlays/Modal/ChangeStatusModal';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ onClose, title }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ options, defaultOption, onSelect }: any) => (
    <div>
      <div data-testid="selected-status">{String(defaultOption)}</div>
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onSelect(option)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

describe('ChangeStatusModal', () => {
  const notifyMock = jest.fn();
  const setShowModal = jest.fn();
  const onSave = jest.fn();

  const baseProps = {
    showModal: true,
    setShowModal,
    currentStatus: 'PENDING',
    defaultStatus: 'PENDING',
    preferredStatus: null,
    statusOptions: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
    placeholder: 'Status',
    canTransition: (from: string, to: string) =>
      from === to || (from === 'PENDING' && to === 'COMPLETED'),
    getInvalidMessage: () => 'invalid transition',
    onSave,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    onSave.mockResolvedValue(undefined);
  });

  it('uses preferred status when allowed and present in options', () => {
    render(<ChangeStatusModal {...baseProps} preferredStatus="COMPLETED" />);

    expect(screen.getByTestId('selected-status')).toHaveTextContent('COMPLETED');
  });

  it('closes immediately when status did not change', async () => {
    render(<ChangeStatusModal {...baseProps} />);

    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => expect(setShowModal).toHaveBeenCalledWith(false));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows warning for invalid transition', async () => {
    render(<ChangeStatusModal {...baseProps} canTransition={() => false} />);

    fireEvent.click(screen.getByText('Completed'));
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Status update blocked' })
      );
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders validation error and skips save', async () => {
    render(<ChangeStatusModal {...baseProps} validateBeforeSave={() => 'need reason'} />);

    fireEvent.click(screen.getByText('Completed'));
    fireEvent.click(screen.getByText('Update'));

    expect(await screen.findByText('need reason')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows fallback error message on save failure', async () => {
    onSave.mockRejectedValue('not-an-error');
    render(<ChangeStatusModal {...baseProps} />);

    fireEvent.click(screen.getByText('Completed'));
    fireEvent.click(screen.getByText('Update'));

    expect(
      await screen.findByText('Unable to update status. Please try again.')
    ).toBeInTheDocument();
  });

  it('cancels and closes from header button', () => {
    render(<ChangeStatusModal {...baseProps} preferredStatus="COMPLETED" />);

    fireEvent.click(screen.getByText('close'));

    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
