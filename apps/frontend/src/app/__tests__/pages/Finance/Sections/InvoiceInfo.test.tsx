import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InvoiceInfo from "@/app/pages/Finance/Sections/InvoiceInfo";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

describe("InvoiceInfo", () => {
  it("renders invoice details and handles close", () => {
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo
        showModal
        setShowModal={setShowModal}
        activeInvoice={{ metadata: { pet: "Buddy" } } as any}
      />
    );

    expect(screen.getByText("View invoice")).toBeInTheDocument();
    expect(screen.getByText("Appointments details")).toBeInTheDocument();
    expect(screen.getByText("Payment details")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
