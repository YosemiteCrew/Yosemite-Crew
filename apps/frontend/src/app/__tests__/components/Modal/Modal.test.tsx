import React from "react";
import { fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import Modal from "@/app/components/Modal";

describe("<Modal />", () => {
  test("applies translate classes based on showModal prop", () => {
    const { rerender, container } = render(
      <Modal showModal setShowModal={jest.fn()}>
        content
      </Modal>
    );
    const modal = container.firstChild as HTMLElement;
    expect(modal.className).toContain("translate-x-0");

    rerender(
      <Modal showModal={false} setShowModal={jest.fn()}>
        content
      </Modal>
    );
    expect(modal.className).toContain("translate-x-full");
  });

  test("closes when clicking outside but not when clicking inside", () => {
    const setShowModal = jest.fn();
    const { container } = render(
      <Modal showModal setShowModal={setShowModal}>
        <div data-testid="modal-content">Modal content</div>
      </Modal>
    );

    const modal = container.firstChild as HTMLElement;
    fireEvent.mouseDown(modal);
    expect(setShowModal).not.toHaveBeenCalled();

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    fireEvent.mouseDown(outside);
    expect(setShowModal).toHaveBeenCalledWith(false);
    outside.remove();
  });
});
