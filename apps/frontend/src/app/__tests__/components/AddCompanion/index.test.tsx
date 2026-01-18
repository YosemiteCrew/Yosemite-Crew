import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddCompanion from "@/app/components/AddCompanion";

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

jest.mock("@/app/components/Labels/Labels", () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div>
      {labels.map((label: any) => (
        <button
          key={label.key}
          type="button"
          onClick={() => setActiveLabel(label.key)}
        >
          {label.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/AddCompanion/Sections/Parent", () => ({
  __esModule: true,
  default: () => <div>parent-section</div>,
}));

jest.mock("@/app/components/AddCompanion/Sections/Companion", () => ({
  __esModule: true,
  default: () => <div>companion-section</div>,
}));

describe("AddCompanion", () => {
  it("renders modal and switches sections", () => {
    render(<AddCompanion showModal setShowModal={jest.fn()} />);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("parent-section")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Companion information" })
    );
    expect(screen.getByText("companion-section")).toBeInTheDocument();
  });

  it("closes modal when close icon is clicked", () => {
    const setShowModal = jest.fn();
    render(<AddCompanion showModal setShowModal={setShowModal} />);

    fireEvent.click(screen.getAllByText("close")[1]);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
