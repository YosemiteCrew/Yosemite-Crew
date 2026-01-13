import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CompanionInfo from "@/app/components/CompanionInfo";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src, ...rest }: any) => <img alt={alt} src={src} {...rest} />,
}));

jest.mock("@/app/components/Modal", () => {
  return function MockModal({ showModal, children }: any) {
    return showModal ? <div data-testid="modal">{children}</div> : null;
  };
});

jest.mock("@/app/components/Labels/Labels", () => {
  return function MockLabels({ setActiveLabel, setActiveSubLabel }: any) {
    return (
      <div>
        <button type="button" onClick={() => setActiveLabel("records")}>Records</button>
        <button type="button" onClick={() => setActiveSubLabel("documents")}>Documents</button>
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

jest.mock("@/app/components/CompanionInfo/Sections", () => ({
  Companion: ({ companion }: any) => (
    <div>Companion Section: {companion?.companion?.name}</div>
  ),
  Parent: () => <div>Parent Section</div>,
  Core: () => <div>Core Section</div>,
  History: () => <div>History Section</div>,
  Documents: () => <div>Documents Section</div>,
  AddAppointment: () => <div>Add Appointment Section</div>,
  AddTask: () => <div>Add Task Section</div>,
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: () => true,
}));

describe("CompanionInfo Component", () => {
  const mockCompanion = {
    companion: {
      name: "Rex",
      breed: "Husky",
      photoUrl: "https://example.com/pet.png",
    },
  } as any;

  it("renders default companion info section", () => {
    render(
      <CompanionInfo
        showModal
        setShowModal={jest.fn()}
        activeCompanion={mockCompanion}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Companion Section: Rex")).toBeInTheDocument();
  });

  it("switches content when labels change", () => {
    render(
      <CompanionInfo
        showModal
        setShowModal={jest.fn()}
        activeCompanion={mockCompanion}
      />
    );

    fireEvent.click(screen.getByText("Records"));
    fireEvent.click(screen.getByText("Documents"));

    expect(screen.getByText("Documents Section")).toBeInTheDocument();
  });

  it("closes modal when close button is clicked", () => {
    const setShowModal = jest.fn();
    render(
      <CompanionInfo
        showModal
        setShowModal={setShowModal}
        activeCompanion={mockCompanion}
      />
    );

    fireEvent.click(screen.getByText("Close"));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
