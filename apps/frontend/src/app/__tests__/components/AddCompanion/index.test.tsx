import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AddCompanion from "@/app/components/AddCompanion";

jest.mock("@/app/components/Modal", () => {
  return function MockModal({ showModal, children }: any) {
    return showModal ? <div data-testid="modal">{children}</div> : null;
  };
});

jest.mock("@/app/components/Labels/SubLabels", () => {
  return function MockSubLabels({ labels }: any) {
    return (
      <div data-testid="sublabels">
        {labels.map((label: any) => (
          <span key={label.key}>{label.name}</span>
        ))}
      </div>
    );
  };
});

jest.mock("@/app/components/Icons/Close", () => {
  return function MockClose({ onClick }: any) {
    return (
      <button type="button" onClick={onClick}>
        Close
      </button>
    );
  };
});

jest.mock("@/app/components/AddCompanion/Sections/Parent", () => {
  return function MockParent({ setActiveLabel }: any) {
    return (
      <div>
        <span>Parent Section</span>
        <button type="button" onClick={() => setActiveLabel("companion")}>
          Next
        </button>
      </div>
    );
  };
});

jest.mock("@/app/components/AddCompanion/Sections/Companion", () => {
  return function MockCompanion() {
    return <div>Companion Section</div>;
  };
});

describe("AddCompanion Component", () => {
  it("renders modal content and parent section by default", () => {
    render(<AddCompanion showModal setShowModal={jest.fn()} />);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Add Companion")).toBeInTheDocument();
    expect(screen.getByText("Parent Section")).toBeInTheDocument();
  });

  it("closes the modal when Close icon is clicked", () => {
    const setShowModal = jest.fn();
    render(<AddCompanion showModal setShowModal={setShowModal} />);

    fireEvent.click(screen.getByText("Close"));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it("switches to the companion section when requested", () => {
    render(<AddCompanion showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Companion Section")).toBeInTheDocument();
  });
});
