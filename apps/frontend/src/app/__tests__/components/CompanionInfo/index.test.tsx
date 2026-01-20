/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionInfo from "@/app/components/CompanionInfo";

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
  default: ({ labels, setActiveLabel, setActiveSubLabel }: any) => (
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
      <button type="button" onClick={() => setActiveSubLabel("documents")}
      >
        Documents
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/CompanionInfo/Sections", () => ({
  Companion: () => <div>companion-section</div>,
  Parent: () => <div>parent-section</div>,
  Core: () => <div>core-section</div>,
  History: () => <div>history-section</div>,
  Documents: () => <div>documents-section</div>,
  AddAppointment: () => <div>add-appointment</div>,
  AddTask: () => <div>add-task</div>,
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: () => "https://example.com/pet.png",
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("CompanionInfo", () => {
  it("renders modal and switches sub-section", () => {
    const setShowModal = jest.fn();
    const companion: any = {
      companion: { name: "Buddy", breed: "Lab", type: "dog", photoUrl: "" },
    };

    render(
      <CompanionInfo
        showModal
        setShowModal={setShowModal}
        activeCompanion={companion}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Records" }));
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(screen.getByText("documents-section")).toBeInTheDocument();
  });
});
