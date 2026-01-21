import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrgInvites from "@/app/components/DataTable/OrgInvites";
import { Invite } from "@/app/types/team";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const acceptInviteMock = jest.fn();
const rejectInviteMock = jest.fn();

jest.mock("@/app/services/teamService", () => ({
  acceptInvite: (...args: any[]) => acceptInviteMock(...args),
  rejectInvite: (...args: any[]) => rejectInviteMock(...args),
}));

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, idx: number) => (
        <div key={item._id ?? idx}>
          {columns.map((col: any) => (
            <div key={String(col.key)}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const inviteCardSpy = jest.fn();

jest.mock("@/app/components/Cards/InviteCard/InviteCard", () => ({
  __esModule: true,
  default: (props: any) => {
    inviteCardSpy(props);
    return <div data-testid="invite-card" />;
  },
}));

describe("OrgInvites", () => {
  const invites: Invite[] = [
    {
      _id: "invite-1",
      organisationId: "org-1",
      organisationName: "Yosemite Vet",
      organisationType: "HOSPITAL",
      role: "SUPERVISOR",
      employmentType: "FULL_TIME",
      name: "Invite 1",
      invitedByUserId: "",
      inviteeEmail: "",
      departmentId: "",
      token: "",
      status: "ACCEPTED",
      expiresAt: "",
      updatedAt: "",
      createdAt: ""
    } as Invite,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders table and cards with invites", () => {
    render(<OrgInvites invites={invites} setInvites={jest.fn()} />);

    expect(screen.getByTestId("generic-table")).toBeInTheDocument();
    expect(screen.getByTestId("invite-card")).toBeInTheDocument();
    expect(inviteCardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ invite: invites[0] })
    );
  });

  it("accepts an invite and redirects", async () => {
    acceptInviteMock.mockResolvedValue(undefined);

    render(<OrgInvites invites={invites} setInvites={jest.fn()} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(acceptInviteMock).toHaveBeenCalledWith(invites[0]);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/team-onboarding?orgId=org-1");
    });
  });

  it("rejects an invite and updates state", async () => {
    rejectInviteMock.mockResolvedValue(undefined);
    const setInvites = jest.fn();

    render(<OrgInvites invites={invites} setInvites={setInvites} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);

    expect(rejectInviteMock).toHaveBeenCalledWith(invites[0]);
    await waitFor(() => {
      expect(setInvites).toHaveBeenCalledTimes(1);
    });

    const updater = setInvites.mock.calls[0][0];
    const next = updater(invites);
    expect(next).toEqual([]);
  });

  it("shows empty state when no invites", () => {
    render(<OrgInvites invites={[]} setInvites={jest.fn()} />);

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
