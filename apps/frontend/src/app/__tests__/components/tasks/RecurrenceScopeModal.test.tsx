import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RecurrenceScopeModal from '@/app/features/tasks/components/RecurrenceScopeModal';

// CenterModal renders children inline; keep it a passthrough so we can query content.
jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title }: any) => <h2>{title}</h2>,
}));
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('RecurrenceScopeModal', () => {
  const setShowModal = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('defaults to THIS and confirms with the selected scope', () => {
    const onConfirm = jest.fn();
    render(
      <RecurrenceScopeModal
        showModal
        setShowModal={setShowModal}
        action="edit"
        taskName="Massage paws"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Edit recurring task')).toBeInTheDocument();
    // Default scope is "This task only".
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onConfirm).toHaveBeenCalledWith('THIS');
  });

  it('confirms with the chosen "this and following" scope', () => {
    const onConfirm = jest.fn();
    render(
      <RecurrenceScopeModal
        showModal
        setShowModal={setShowModal}
        action="delete"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Delete recurring task')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('This and following tasks'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });

  it('confirms with the "all" scope', () => {
    const onConfirm = jest.fn();
    render(
      <RecurrenceScopeModal
        showModal
        setShowModal={setShowModal}
        action="edit"
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByLabelText('All tasks in the series'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onConfirm).toHaveBeenCalledWith('ALL');
  });
});
