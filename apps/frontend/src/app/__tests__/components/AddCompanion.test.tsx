import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (
    <div data-testid="modal" data-open={showModal}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Labels/SubLabels", () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div data-testid="sub-labels">
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
  default: () => <div data-testid="section-parent">Parent</div>,
}));

jest.mock("@/app/components/AddCompanion/Sections/Companion", () => ({
  __esModule: true,
  default: () => <div data-testid="section-companion">Companion</div>,
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: (props: any) => (
    <button data-testid="close-icon" {...props} />
  ),
}));

import AddCompanion from "@/app/components/AddCompanion";

describe("<AddCompanion />", () => {
  test("renders default section and switches via labels", () => {
    render(<AddCompanion showModal={true} setShowModal={jest.fn()} />);

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("section-parent")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Companion information"));
    expect(screen.getByTestId("section-companion")).toBeInTheDocument();

  });

  test("closes modal when close icon clicked", () => {
    const setShowModal = jest.fn();
    render(<AddCompanion showModal={false} setShowModal={setShowModal} />);

    const closeButtons = screen.getAllByTestId("close-icon");
    fireEvent.click(closeButtons[1]);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
