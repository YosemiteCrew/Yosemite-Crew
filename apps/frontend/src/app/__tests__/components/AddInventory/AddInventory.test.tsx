import React from "react";
import { fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../jest.mocks/testMocks";

const mockSetShowModal = jest.fn();

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-mock">{children}</div>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: { onClick?: () => void }) => (
    <button
      type="button"
      data-testid={onClick ? "close-icon" : "placeholder-icon"}
      onClick={onClick}
    >
      close
    </button>
  ),
}));

import AddInventory from "@/app/components/AddInventory";

describe("<AddInventory />", () => {
  beforeEach(() => {
    mockSetShowModal.mockClear();
  });

  test("renders inside modal container", () => {
    const { container } = render(
      <AddInventory showModal setShowModal={mockSetShowModal} />
    );

    expect(container.querySelector("[data-testid='modal-mock']")).toBeTruthy();
  });

  test("closes modal when close icon clicked", () => {
    render(<AddInventory showModal setShowModal={mockSetShowModal} />);
    fireEvent.click(document.querySelector("[data-testid='close-icon']")!);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
