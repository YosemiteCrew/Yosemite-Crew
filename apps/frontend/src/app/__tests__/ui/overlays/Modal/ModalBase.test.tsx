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
        aria-label="Test modal"
        {...props}
      >
        <div>Modal content</div>
      </ModalBase>
    );

    return { setShowModal, onClose };
  };

  it('renders content with dialog role', () => {
    renderModal();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on outside click (mousedown outside container)', () => {
    const { setShowModal, onClose } = renderModal();

    fireEvent.mouseDown(document.body);

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when canClose returns false', () => {
    const { setShowModal, onClose } = renderModal({ canClose: () => false });

    fireEvent.mouseDown(document.body);
    expect(setShowModal).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on escape key', () => {
    const { setShowModal, onClose } = renderModal();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on escape when canClose returns false', () => {
    const { setShowModal, onClose } = renderModal({ canClose: () => false });

    fireEvent.keyDown(document, { key: 'Escape' });
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

    ignored.remove();
  });
});
