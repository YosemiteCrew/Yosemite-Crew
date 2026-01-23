import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import SpecialityInfo from "@/app/pages/Organization/Sections/Specialities/SpecialityInfo";

const deleteSpecialityMock = jest.fn();
const updateSpecialityMock = jest.fn();
const updateServiceMock = jest.fn();
const deleteServiceMock = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [{ _id: "team-1", name: "Alex" }],
}));

jest.mock("@/app/services/specialityService", () => ({
  deleteSpeciality: (...args: any[]) => deleteSpecialityMock(...args),
  updateSpeciality: (...args: any[]) => updateSpecialityMock(...args),
  updateService: (...args: any[]) => updateServiceMock(...args),
}));

jest.mock("@/app/services/serviceService", () => ({
  deleteService: (...args: any[]) => deleteServiceMock(...args),
}));

jest.mock("react-icons/md", () => ({
  MdDeleteForever: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      delete
    </button>
  ),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: () => <div />,
}));

const accordionCalls: any[] = [];

jest.mock("@/app/components/Accordion/EditableAccordion", () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid="editable-accordion" />;
});

jest.mock("@/app/components/Accordion/Accordion", () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div>{props.children}</div>
  </div>
));

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearchEdit", () => () => (
  <div data-testid="service-search" />
));

describe("SpecialityInfo modal", () => {
  const activeSpeciality: any = {
    _id: "spec-1",
    organisationId: "org-1",
    name: "Surgery",
    headUserId: "team-1",
    headName: "Alex",
    teamMemberIds: ["team-1"],
    services: [
      {
        _id: "service-1",
        name: "Consult",
        description: "Desc",
        durationMinutes: 30,
        cost: 50,
        maxDiscount: 5,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
  });

  it("deletes speciality and updates core details", async () => {
    render(
      <SpecialityInfo
        showModal
        setShowModal={jest.fn()}
        activeSpeciality={activeSpeciality}
        canEditSpecialities
      />
    );

    fireEvent.click(screen.getByText("delete"));
    await accordionCalls[0].onSave({
      name: "Updated",
      headName: "team-1",
    });

    expect(updateSpecialityMock).toHaveBeenCalled();
    expect(deleteSpecialityMock).toHaveBeenCalled();
  });
});
