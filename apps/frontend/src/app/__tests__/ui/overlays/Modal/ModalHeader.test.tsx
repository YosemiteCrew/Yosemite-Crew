import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

describe('ModalHeader', () => {
  it('renders title and triggers onClose from actionable close icon', () => {
    const onClose = jest.fn();
    render(<ModalHeader title="Confirm action" onClose={onClose} />);

    expect(screen.getByText('Confirm action')).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'close' });
    expect(closeButtons).toHaveLength(2);

    fireEvent.click(closeButtons[1]);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
