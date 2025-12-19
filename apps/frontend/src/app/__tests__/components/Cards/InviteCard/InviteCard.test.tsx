import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InviteCard from "@/app/components/Cards/InviteCard/InviteCard";
import { Invite } from "@/app/types/team";

// --- Test Data ---

const mockInvite: Invite = {
  _id: "inv-1",
  organisationName: "Tech Corp",
  organisationType: "Software",
  role: "Developer",
  employmentType: "FULL_TIME", // To test .split('_').join(' ') logic
  status: "PENDING",
  email: "test@example.com",
} as any;

describe("InviteCard Component", () => {
  const mockHandleAccept = jest.fn();
  const mockHandleReject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders invite information correctly", () => {
    render(
      <InviteCard
        invite={mockInvite}
        handleAccept={mockHandleAccept}
        handleReject={mockHandleReject}
      />
    );

    // Organization Name
    expect(screen.getByText("Tech Corp")).toBeInTheDocument();

    // Type
    expect(screen.getByText("Type :")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();

    // Role
    expect(screen.getByText("Role :")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
  });

  it("formats employment type correctly (replaces underscores with spaces)", () => {
    render(
      <InviteCard
        invite={mockInvite} // employmentType: "FULL_TIME"
        handleAccept={mockHandleAccept}
        handleReject={mockHandleReject}
      />
    );

    expect(screen.getByText("Employee type :")).toBeInTheDocument();
    // "FULL_TIME" -> "FULL TIME"
    expect(screen.getByText("FULL TIME")).toBeInTheDocument();
  });

  // --- 2. Interactions ---

  it("calls handleAccept when Accept button is clicked", () => {
    render(
      <InviteCard
        invite={mockInvite}
        handleAccept={mockHandleAccept}
        handleReject={mockHandleReject}
      />
    );

    const acceptBtn = screen.getByText("Accept");
    fireEvent.click(acceptBtn);

    expect(mockHandleAccept).toHaveBeenCalledTimes(1);
    expect(mockHandleAccept).toHaveBeenCalledWith(mockInvite);
  });

  it("calls handleReject when Decline button is clicked", () => {
    render(
      <InviteCard
        invite={mockInvite}
        handleAccept={mockHandleAccept}
        handleReject={mockHandleReject}
      />
    );

    const declineBtn = screen.getByText("Decline");
    fireEvent.click(declineBtn);

    expect(mockHandleReject).toHaveBeenCalledTimes(1);
    expect(mockHandleReject).toHaveBeenCalledWith(mockInvite);
  });
});
