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
