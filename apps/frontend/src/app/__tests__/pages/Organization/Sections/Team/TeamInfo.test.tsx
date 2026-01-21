import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import TeamInfo from "@/app/pages/Organization/Sections/Team/TeamInfo";

const updateMemberMock = jest.fn();
const removeMemberMock = jest.fn();
const getProfileMock = jest.fn();

jest.mock("@/app/services/teamService", () => ({
  getProfileForUserForPrimaryOrg: (...args: any[]) => getProfileMock(...args),
  removeMember: (...args: any[]) => removeMemberMock(...args),
  updateMember: (...args: any[]) => updateMemberMock(...args),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [{ _id: "spec-1", name: "Surgery" }],
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock("react-icons/md", () => ({
  MdDeleteForever: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      delete
    </button>
  ),
}));

jest.mock("@/app/components/Availability/Availability", () => () => (
  <div data-testid="availability" />
));

jest.mock("@/app/pages/Organization/Sections/Team/PermissionsEditor", () => () => (
  <div data-testid="permissions-editor" />
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const accordionCalls: any[] = [];

jest.mock("@/app/components/Accordion/EditableAccordion", () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid={`accordion-${props.title}`} />;
});

jest.mock("@/app/components/Accordion/Accordion", () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div>{props.children}</div>
  </div>
));

describe("TeamInfo modal", () => {
  const activeTeam: any = {
    _id: "team-1",
    name: "Alex",
    role: "MEMBER",
    practionerId: "user-1",
    speciality: [{ _id: "spec-1" }],
    effectivePermissions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
    getProfileMock.mockResolvedValue({
      profile: {
        personalDetails: { employmentType: "FULL_TIME" },
      },
      baseAvailability: [],
    });
  });

  it("loads profile and updates member role", async () => {
    render(
      <TeamInfo
        showModal
        setShowModal={jest.fn()}
        activeTeam={activeTeam}
        canEditTeam
      />
    );

    await waitFor(() => {
      expect(getProfileMock).toHaveBeenCalledWith("user-1");
    });

    const orgAccordion = accordionCalls.find(
      (item) => item.title === "Org details"
    );
    await orgAccordion.onSave({ role: "ADMIN" });

    expect(updateMemberMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" })
    );
  });

  it("deletes member when delete icon is clicked", () => {
    render(
      <TeamInfo
        showModal
        setShowModal={jest.fn()}
        activeTeam={activeTeam}
        canEditTeam
      />
    );

    fireEvent.click(screen.getByText("delete"));
    expect(removeMemberMock).toHaveBeenCalledWith(activeTeam);
  });
});
