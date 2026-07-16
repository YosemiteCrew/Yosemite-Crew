import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '@/app/ui/overlays/Modal';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';

jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

const mockIsPhone = useIsPhone as jest.Mock;

beforeEach(() => {
  mockIsPhone.mockReturnValue(false);
});

describe('Modal', () => {
  it('renders content inside a dialog', () => {
    const setShowModal = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal}>
        <div>Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('closes when clicking outside the modal', () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.mouseDown(document.body);

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking a portaled dropdown option', () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    const dropdownPortal = document.createElement('div');
    dropdownPortal.setAttribute('data-portal-dropdown', '');
    document.body.appendChild(dropdownPortal);

    fireEvent.mouseDown(dropdownPortal);

    expect(setShowModal).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    dropdownPortal.remove();
  });

  it('does not close when clicking a portaled datepicker', () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    const datepickerPortal = document.createElement('div');
    datepickerPortal.className = 'react-datepicker-popper';
    document.body.appendChild(datepickerPortal);

    fireEvent.mouseDown(datepickerPortal);

    expect(setShowModal).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    datepickerPortal.remove();
  });

  it('closes on escape key', () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('defaults to the right-side drawer layout (opt-in unchanged)', () => {
    render(
      <Modal showModal setShowModal={jest.fn()}>
        <div>Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    // Drawer positioning classes — proves the default caller path is untouched.
    expect(dialog.className).toContain('right-0');
    expect(dialog.className).toContain('sm:w-[530px]');
    expect(dialog.className).not.toContain('left-1/2');
  });

  it('renders a centered panel when variant="centered" (md width by default)', () => {
    render(
      <Modal showModal setShowModal={jest.fn()} variant="centered">
        <div>Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('left-1/2');
    expect(dialog.className).toContain('-translate-x-1/2');
    expect(dialog.className).toContain('rounded-[20px]');
    // md is the default centered width.
    expect(dialog.className).toContain('sm:w-[640px]');
    expect(dialog.className).not.toContain('right-0');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it.each([
    ['sm', 'sm:w-[480px]'],
    ['md', 'sm:w-[640px]'],
    ['lg', 'sm:w-[840px]'],
  ] as const)('maps centered size "%s" to its recipe width', (size, widthClass) => {
    render(
      <Modal showModal setShowModal={jest.fn()} variant="centered" size={size}>
        <div>Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog').className).toContain(widthClass);
  });

  it('closes the centered variant on escape', () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} onClose={onClose} variant="centered">
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('hides the drawer panel when showModal is false', () => {
    render(
      <Modal showModal={false} setShowModal={jest.fn()}>
        <div>Content</div>
      </Modal>
    );

    // Closed <dialog> drops its `open` attribute, so it leaves the a11y tree
    // (no role="dialog"). The panel element is still portaled to the body —
    // query it by its stable class and assert it slides off-screen.
    const dialog = document.querySelector('.yc-modal-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain('translate-x-[120%]');
  });

  it('hides the centered panel when showModal is false', () => {
    render(
      <Modal showModal={false} setShowModal={jest.fn()} variant="centered">
        <div>Content</div>
      </Modal>
    );

    const dialog = document.querySelector('.yc-modal-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain('opacity-0');
  });

  it('does not close the centered variant when clicking a portaled dropdown option', () => {
    const setShowModal = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} variant="centered">
        <div>Content</div>
      </Modal>
    );

    const dropdownPortal = document.createElement('div');
    dropdownPortal.setAttribute('data-portal-dropdown', '');
    document.body.appendChild(dropdownPortal);

    fireEvent.mouseDown(dropdownPortal);

    expect(setShowModal).not.toHaveBeenCalled();

    dropdownPortal.remove();
  });
});

describe('Modal on a phone', () => {
  beforeEach(() => {
    mockIsPhone.mockReturnValue(true);
  });

  it('re-forms variant="centered" into a bottom sheet with a grabber', () => {
    render(
      <Modal showModal setShowModal={jest.fn()} variant="centered">
        <div>Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('yc-phone-sheet', 'yc-modal-sheet');
    // No desktop panel geometry survives onto the phone form.
    expect(dialog.className).not.toContain('left-1/2');
    expect(dialog.className).not.toContain('sm:w-[640px]');
    expect(document.querySelector('.yc-phone-sheet-grabber')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('leaves the sheet title row to the caller so headers never double up', () => {
    render(
      <Modal showModal setShowModal={jest.fn()} variant="centered">
        <div>Content</div>
      </Modal>
    );

    expect(document.querySelector('.yc-phone-sheet-head')).not.toBeInTheDocument();
  });

  it('re-forms the default drawer into a full-screen panel', () => {
    render(
      <Modal showModal setShowModal={jest.fn()}>
        <div>Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('yc-modal-fullscreen');
    // The 530px right-side drawer must not reach a phone.
    expect(dialog.className).not.toContain('right-0');
    expect(dialog.className).not.toContain('sm:w-[530px]');
    // Full-screen is not a sheet: no grabber, no top radius.
    expect(document.querySelector('.yc-phone-sheet-grabber')).not.toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it.each([
    ['centered', 'yc-modal-sheet-closed'],
    ['drawer', 'yc-modal-fullscreen-closed'],
  ] as const)('slides the %s phone form off-screen when closed', (variant, closedClass) => {
    render(
      <Modal showModal={false} setShowModal={jest.fn()} variant={variant}>
        <div>Content</div>
      </Modal>
    );

    // ModalBase keeps the panel mounted and inert while closed.
    const dialog = document.querySelector('.yc-modal-dialog');
    expect(dialog).toHaveClass(closedClass);
    expect(dialog).toHaveAttribute('inert');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['centered', 'drawer'] as const)(
    'keeps escape and outside-click closing the %s phone form',
    (variant) => {
      const setShowModal = jest.fn();
      const onClose = jest.fn();

      const { unmount } = render(
        <Modal showModal setShowModal={setShowModal} onClose={onClose} variant={variant}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(setShowModal).toHaveBeenCalledWith(false);
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.mouseDown(document.body);
      expect(onClose).toHaveBeenCalledTimes(2);

      unmount();
    }
  );

  it.each(['centered', 'drawer'] as const)(
    'keeps ignored outside-click targets from closing the %s phone form',
    (variant) => {
      const setShowModal = jest.fn();

      render(
        <Modal showModal setShowModal={setShowModal} variant={variant}>
          <div>Content</div>
        </Modal>
      );

      const dropdownPortal = document.createElement('div');
      dropdownPortal.setAttribute('data-portal-dropdown', '');
      document.body.appendChild(dropdownPortal);

      fireEvent.mouseDown(dropdownPortal);

      expect(setShowModal).not.toHaveBeenCalled();

      dropdownPortal.remove();
    }
  );

  it.each(['centered', 'drawer'] as const)('honours canClose on the %s phone form', (variant) => {
    const setShowModal = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} canClose={() => false} variant={variant}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(setShowModal).not.toHaveBeenCalled();
  });
});
