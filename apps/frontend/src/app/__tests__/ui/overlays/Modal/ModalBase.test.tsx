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

  it('renders hidden state styles when showModal is false', () => {
    renderModal({ showModal: false });

    // inert hides the div from the a11y tree and prevents focus when closed;
    // use { hidden: true } to still assert it stays mounted for CSS transitions.
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('container');
    expect(dialog).toHaveAttribute('inert');
    // Modal stays mounted so CSS transitions can play;
    // interaction is blocked via pointer-events-none and inert
    expect(dialog).toHaveClass('pointer-events-none');
    expect(dialog).toHaveTextContent('Modal content');
  });

  it('closes on outside click (mousedown outside container)', () => {
    const { setShowModal, onClose } = renderModal();

    fireEvent.mouseDown(document.body);

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when the click lands inside another modal', () => {
    const { setShowModal, onClose } = renderModal();

    // Modals portal to document.body, so one opened from inside another is a
    // DOM sibling. Clicking it must not read as an outside click here.
    const sibling = document.createElement('dialog');
    sibling.className = 'yc-modal-dialog';
    const inner = document.createElement('button');
    sibling.appendChild(inner);
    document.body.appendChild(sibling);

    fireEvent.mouseDown(inner);
    expect(setShowModal).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    sibling.remove();
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

  describe('body scroll lock', () => {
    const renderLockable = (showModal: boolean) =>
      render(
        <ModalBase
          showModal={showModal}
          setShowModal={jest.fn()}
          overlayClassName="overlay"
          containerClassName="container"
          aria-label="Test modal"
        >
          <div>Modal content</div>
        </ModalBase>
      );

    afterEach(() => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.documentElement.style.overflow = '';
    });

    it('locks body scroll while open', () => {
      renderLockable(true);

      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');
    });

    it('releases the lock when closed', () => {
      const { rerender } = renderLockable(true);

      rerender(
        <ModalBase
          showModal={false}
          setShowModal={jest.fn()}
          overlayClassName="overlay"
          containerClassName="container"
          aria-label="Test modal"
        >
          <div>Modal content</div>
        </ModalBase>
      );

      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
    });

    it('releases the lock when unmounted while still open', () => {
      const { unmount } = renderLockable(true);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      // Without cleanup the page stays unscrollable with no modal to close.
      expect(document.body.style.overflow).toBe('');
      expect(document.body.style.paddingRight).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
    });
  });
});
