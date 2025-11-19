import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../jest.mocks/testMocks";

const mockSetShowModal = jest.fn();

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-mock">{children}</div>
  ),
}));

jest.mock("@/app/components/Labels/SubLabels", () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div>
      {labels.map((label: any) => (
        <button
          key={label.key}
          data-testid={`label-${label.key}`}
          onClick={() => setActiveLabel(label.key)}
        >
          {label.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/AddCompanion/Forms/Parent", () => ({
  __esModule: true,
  default: () => <div data-testid="parent-form">Parent form</div>,
}));

jest.mock("@/app/components/AddCompanion/Forms/Companion", () => ({
  __esModule: true,
  default: () => <div data-testid="companion-form">Companion form</div>,
}));

jest.mock("@/app/components/AddCompanion/Forms/Allergies", () => ({
  __esModule: true,
  default: () => <div data-testid="allergies-form">Allergies form</div>,
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

import AddCompanion from "@/app/components/AddCompanion";

describe("<AddCompanion />", () => {
  beforeEach(() => {
    mockSetShowModal.mockClear();
  });

  test("renders Parent form by default", () => {
    render(<AddCompanion showModal setShowModal={mockSetShowModal} />);
    expect(screen.getByTestId("parent-form")).toBeInTheDocument();
  });

  test("switches between forms using SubLabels", () => {
    render(<AddCompanion showModal setShowModal={mockSetShowModal} />);

    fireEvent.click(screen.getByTestId("label-companion"));
    expect(screen.getByTestId("companion-form")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("label-allergies"));
    expect(screen.getByTestId("allergies-form")).toBeInTheDocument();
  });

  test("closes modal when close icon is clicked", () => {
    render(<AddCompanion showModal setShowModal={mockSetShowModal} />);

    fireEvent.click(screen.getByTestId("close-icon"));
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
