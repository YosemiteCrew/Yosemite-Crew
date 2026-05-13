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
});
