import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '@/app/ui/overlays/Modal';

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
