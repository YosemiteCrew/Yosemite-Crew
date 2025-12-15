import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrgInvites from "@/app/components/DataTable/OrgInvites";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/services/teamService";
import { Invite } from "@/app/types/team";

// --- Mocks ---

// Mock Navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock Service
jest.mock("@/app/services/teamService", () => ({
  acceptInvite: jest.fn(),
}));

// Mock GenericTable
jest.mock("@/app/components/GenericTable/GenericTable", () => {
  return ({ data, columns }: any) => (
    <div data-testid="generic-table">
      <div data-testid="table-headers">
        {columns.map((col: any) => (
          <span key={col.key}>{col.label}</span>
        ))}
      </div>
      <div data-testid="table-body">
        {data.map((item: any, i: number) => (
          <div key={i+"invites-key"} data-testid={`row-${i}`}>
            {columns.map((col: any) => (
              <div key={col.key} data-testid={`cell-${col.key}`}>
                {col.render ? col.render(item) : item[col.key]} {" "}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// Mock InviteCard
jest.mock("../../../components/Cards/InviteCard/InviteCard", () => {
  return ({ invite, handleAccept, handleReject }: any) => (
    <div data-testid={`invite-card-${invite._id}`}>
            <span>{invite.organisationName}</span>     {" "}
      <button
        data-testid={`card-accept-${invite._id}`}
        onClick={() => handleAccept(invite)}
      >
                Accept      {" "}
      </button>
           {" "}
      <button
        data-testid={`card-reject-${invite._id}`}
        onClick={() => handleReject(invite)}
      >
                Reject      {" "}
      </button>
         {" "}
    </div>
  );
});

// Mock Icons
jest.mock("react-icons/fa", () => ({
  FaCheckCircle: () => <span data-testid="icon-check" />,
}));
jest.mock("react-icons/io", () => ({
  IoIosCloseCircle: () => <span data-testid="icon-close" />,
}));

// --- Test Data ---

// Fixed: Added missing required properties for Invite type
const mockInvites: Invite[] = [
  {
    _id: "inv-1",
    organisationName: "Tech Corp",
    organisationType: "Medical",
    organisationId: "org-1",
    role: "Admin",
    employmentType: "FULL_TIME", // To test split/join logic
    email: "test@example.com",
    status: "Pending", // Missing fields added
    invitedByUserId: "user-1",
    departmentId: "dept-1",
    inviteeEmail: "test@example.com",
    token: "token-123",
    createdAt: "2023-01-01",
    updatedAt: "2023-01-01",
    __v: 0,
  } as unknown as Invite,
  {
    _id: "inv-2",
    organisationName: "Health Plus",
    organisationType: "Clinic",
    organisationId: "org-2",
    role: "Doctor",
    employmentType: "PART_TIME",
    email: "doc@example.com",
    status: "Pending", // Missing fields added
    invitedByUserId: "user-2",
    departmentId: "dept-2",
    inviteeEmail: "doc@example.com",
    token: "token-456",
    createdAt: "2023-01-02",
    updatedAt: "2023-01-02",
    __v: 0,
  } as unknown as Invite,
];

describe("OrgInvites Component", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  }); // --- 1. Rendering (Desktop Table) ---

  it("renders the table headers correctly", () => {
    render(<OrgInvites invites={mockInvites} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Employee type")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders table row data correctly", () => {
    render(<OrgInvites invites={mockInvites} />); // FIX: Use queryAllByText to tolerate multiple elements (table row + card)
    expect(screen.queryAllByText("Tech Corp").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Health Plus").length).toBeGreaterThan(0);
  }); // --- 2. Rendering (Mobile Cards) ---

  it("renders mobile cards", () => {
    render(<OrgInvites invites={mockInvites} />);

    expect(screen.getByTestId("invite-card-inv-1")).toBeInTheDocument();
    expect(screen.getByTestId("invite-card-inv-2")).toBeInTheDocument();
  }); // --- 3. Interaction: Accept Invite ---

  it("handles successful invite acceptance (Table Button)", async () => {
    (acceptInvite as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<OrgInvites invites={mockInvites} />); // Find accept buttons (rendered via icon mock in GenericTable mock)

    const acceptButtons = screen.getAllByTestId("icon-check"); // Click the first one (Tech Corp)
    fireEvent.click(acceptButtons[0].closest("button")!);

    expect(acceptInvite).toHaveBeenCalledWith(mockInvites[0]);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/team-onboarding?orgId=org-1");
    });
  });

  it("handles successful invite acceptance (Card Button)", async () => {
    (acceptInvite as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<OrgInvites invites={mockInvites} />);

    const cardAcceptBtn = screen.getByTestId("card-accept-inv-1");
    fireEvent.click(cardAcceptBtn);

    expect(acceptInvite).toHaveBeenCalledWith(mockInvites[0]);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/team-onboarding?orgId=org-1");
    });
  });

  it("handles error during acceptance", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (acceptInvite as jest.Mock).mockRejectedValueOnce(
      new Error("Network Error")
    );

    render(<OrgInvites invites={mockInvites} />);

    const acceptButtons = screen.getAllByTestId("icon-check");
    fireEvent.click(acceptButtons[0].closest("button")!);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    expect(mockPush).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  }); // --- 4. Interaction: Reject Invite ---

  it("handles reject click without crashing (placeholder function)", () => {
    render(<OrgInvites invites={mockInvites} />); // Find reject buttons

    const rejectButtons = screen.getAllByTestId("icon-close"); // Click first reject button
    fireEvent.click(rejectButtons[0].closest("button")!); // Since the function is empty in source: const handleReject = (invite: Invite) => {};
    // We assert nothing happens (no navigation, no api call), essentially covering the line.

    expect(acceptInvite).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles reject click from Card view", () => {
    render(<OrgInvites invites={mockInvites} />);

    const cardRejectBtn = screen.getByTestId("card-reject-inv-1");
    fireEvent.click(cardRejectBtn); // Verify no side effects

    expect(acceptInvite).not.toHaveBeenCalled();
  });
});
