import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';

describe('ModalBase', () => {
  const renderModal = (props?: Partial<React.ComponentProps<typeof ModalBase>>) => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <ModalBase
        showModal
        setShowModal={setShowModal}
        onClose={onClose}
        overlayClassName="overlay"
        containerClassName="container"
        {...props}
      >
        <div>Modal content</div>
      </ModalBase>
    );

    return { setShowModal, onClose };
  };

  it('renders content and closes from overlay click', () => {
    const { setShowModal, onClose } = renderModal();

    expect(screen.getByText('Modal content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when canClose returns false', () => {
    const { setShowModal, onClose } = renderModal({ canClose: () => false });

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(setShowModal).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on outside click and respects ignoreOutsideClick', () => {
    const { setShowModal, onClose } = renderModal({
      ignoreOutsideClick: (target) => target?.getAttribute('data-ignore') === 'yes',
    });

    const ignored = document.createElement('div');
    ignored.setAttribute('data-ignore', 'yes');
    document.body.appendChild(ignored);

    fireEvent.mouseDown(ignored);
    expect(setShowModal).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
