import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TeamInfo from "@/app/pages/Organization/Sections/Team/TeamInfo";
import { Team } from "@/app/types/team";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
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

jest.mock("@/app/components/Availability/Availability", () => ({
  __esModule: true,
  default: () => <div data-testid="availability" />,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, onSave }: any) => (
    <div>
      <div>{title}</div>
      {onSave && (
        <button type="button" onClick={() => onSave({ role: "ADMIN" })}>
          Save-{title}
        </button>
      )}
    </div>
  ),
}));

jest.mock("@/app/pages/Organization/Sections/Team/PermissionsEditor", () => ({
  __esModule: true,
  default: () => <div data-testid="permissions" />,
}));

const getProfileMock = jest.fn();
const removeMemberMock = jest.fn();
const updateMemberMock = jest.fn();

jest.mock("@/app/services/teamService", () => ({
  getProfileForUserForPrimaryOrg: (...args: any[]) => getProfileMock(...args),
  removeMember: (...args: any[]) => removeMemberMock(...args),
  updateMember: (...args: any[]) => updateMemberMock(...args),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [{ _id: "spec-1", name: "General" }],
}));

jest.mock("@/app/utils/team", () => ({
  allowDelete: () => true,
}));

jest.mock("react-icons/md", () => ({
  MdDeleteForever: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Delete
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

jest.mock("@/app/components/Availability/utils", () => ({
  daysOfWeek: ["Monday"],
  DEFAULT_INTERVAL: { start: "09:00", end: "10:00" },
  convertFromGetApi: () => ({ Monday: { enabled: true, intervals: [] } }),
  convertAvailability: () => ({
    Monday: [{ start: "09:00", end: "10:00" }],
  }),
  hasAtLeastOneAvailability: () => true,
}));

describe("TeamInfo", () => {
  const setShowModal = jest.fn();
  const teamMember: Team = {
    _id: "team-1",
    name: "Alex",
    practionerId: "user-1",
    role: "OWNER",
    speciality: [{ _id: "spec-1", name: "General" } as any],
    effectivePermissions: [],
    organisationId: "",
    status: "Available",
    extraPerissions: []
  } as Team;

  beforeEach(() => {
    jest.clearAllMocks();
    getProfileMock.mockResolvedValue({
      profile: {
        personalDetails: { employmentType: "full_time" },
      },
      baseAvailability: [],
    });
  });

  it("loads profile data and renders sections", async () => {
    render(
      <TeamInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTeam={teamMember}
      />
    );

    await waitFor(() => {
      expect(getProfileMock).toHaveBeenCalledWith("user-1");
    });

    expect(screen.getByText("View team")).toBeInTheDocument();
    expect(screen.getByText("Org details")).toBeInTheDocument();
    expect(screen.getByText("Personal details")).toBeInTheDocument();
    expect(screen.getByTestId("permissions")).toBeInTheDocument();
  });

  it("removes member when delete is clicked", async () => {
    removeMemberMock.mockResolvedValue(undefined);

    render(
      <TeamInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTeam={teamMember}
      />
    );

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(removeMemberMock).toHaveBeenCalledWith(teamMember);
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it("updates member role on save", async () => {
    updateMemberMock.mockResolvedValue(undefined);

    render(
      <TeamInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTeam={teamMember}
      />
    );

    fireEvent.click(screen.getByText("Save-Org details"));

    await waitFor(() => {
      expect(updateMemberMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: "ADMIN" })
      );
    });
  });
});
