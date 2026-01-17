import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddSpeciality from "@/app/pages/Organization/Sections/Specialities/AddSpeciality";

const createBulkMock = jest.fn();

jest.mock("@/app/services/specialityService", () => ({
  createBulkSpecialityServices: (...args: any[]) => createBulkMock(...args),
}));

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

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children, onDeleteClick }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={onDeleteClick}>delete</button>
      {children}
    </div>
  ),
}));

jest.mock("@/app/pages/Organization/Sections/Specialities/SpecialityCard", () => ({
  __esModule: true,
  default: () => <div>speciality-card</div>,
}));

jest.mock("@/app/components/Inputs/SpecialitySearch/SpecialitySearchWeb", () => ({
  __esModule: true,
  default: ({ setSpecialities }: any) => (
    <button
      type="button"
      onClick={() => setSpecialities([{ name: "Derm" }])}
    >
      add-speciality
    </button>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("AddSpeciality", () => {
  it("submits selected specialities", async () => {
    const setShowModal = jest.fn();
    createBulkMock.mockResolvedValue(undefined);

    render(
      <AddSpeciality
        showModal
        setShowModal={setShowModal}
        specialities={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "add-speciality" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createBulkMock).toHaveBeenCalledWith([{ name: "Derm" }]);
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
