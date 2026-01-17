import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpecialityInfo from "@/app/pages/Organization/Sections/Specialities/SpecialityInfo";

const deleteSpecialityMock = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock("@/app/services/specialityService", () => ({
  deleteSpeciality: (...args: any[]) => deleteSpecialityMock(...args),
  updateService: jest.fn(),
  updateSpeciality: jest.fn(),
}));

jest.mock("@/app/services/serviceService", () => ({
  deleteService: jest.fn(),
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

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearchEdit", () => ({
  __esModule: true,
  default: () => <div>service-search</div>,
}));

jest.mock("react-icons/md", () => ({
  MdDeleteForever: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      delete
    </button>
  ),
}));

describe("SpecialityInfo", () => {
  it("deletes speciality", () => {
    const setShowModal = jest.fn();
    const speciality: any = {
      _id: "s1",
      organisationId: "org1",
      name: "Derm",
      services: [],
    };

    render(
      <SpecialityInfo
        showModal
        setShowModal={setShowModal}
        activeSpeciality={speciality}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(deleteSpecialityMock).toHaveBeenCalledWith({
      _id: "s1",
      organisationId: "org1",
      name: "Derm",
    });
  });
});
