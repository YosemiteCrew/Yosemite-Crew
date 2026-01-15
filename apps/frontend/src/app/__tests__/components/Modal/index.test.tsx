import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Modal from "@/app/components/Modal";

describe("Modal", () => {
  it("closes when overlay is clicked", () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();

    render(
      <Modal showModal setShowModal={setShowModal} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.click(screen.getByLabelText("Close modal"));

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when clicking outside the modal", () => {
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
});
