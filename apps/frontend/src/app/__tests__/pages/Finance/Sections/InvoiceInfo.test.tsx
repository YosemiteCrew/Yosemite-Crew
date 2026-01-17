import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InvoiceInfo from "@/app/pages/Finance/Sections/InvoiceInfo";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <div>{text}</div>,
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

describe("InvoiceInfo", () => {
  it("renders modal and closes", () => {
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo
        showModal
        setShowModal={setShowModal}
        activeInvoice={{ metadata: {} } as any}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("View invoice")).toBeInTheDocument();

    const closeButtons = screen.getAllByText("close");
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
