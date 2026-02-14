import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import UserLabels from "@/app/features/appointments/components/Calendar/common/UserLabels";
import { Team } from "@/app/features/organization/types/team";

const useAuthStoreMock = jest.fn();

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

describe("UserLabels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders team labels with current date details", () => {
    useAuthStoreMock.mockReturnValue({
      attributes: { sub: "user-1" },
    });

    const team: Team[] = [
      {
        _id: "t1",
        name: "Alex",
        practionerId: "user-1",
        organisationId: "org-1",
        role: "ADMIN",
        speciality: [],
        status: "Available",
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
      {
        _id: "t2",
        name: "Sam",
        practionerId: "user-2",
        organisationId: "org-1",
        role: "TECHNICIAN",
        speciality: [],
        status: "Available",
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
    ];

    const currentDate = new Date(2025, 0, 6, 12);

    render(<UserLabels team={team} currentDate={currentDate} />);

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getAllByText("Mon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
  });

  it("highlights the current user", () => {
    useAuthStoreMock.mockReturnValue({
      attributes: { email: "user-2" },
    });

    const team: Team[] = [
      {
        _id: "t1",
        name: "Alex",
        practionerId: "user-1",
        organisationId: "org-1",
        role: "ADMIN",
        speciality: [],
        status: "Available",
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
      {
        _id: "t2",
        name: "Sam",
        practionerId: "user-2",
        organisationId: "org-1",
        role: "TECHNICIAN",
        speciality: [],
        status: "Available",
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
    ];

    const currentDate = new Date(2025, 0, 7, 12);

    render(<UserLabels team={team} currentDate={currentDate} />);

    expect(screen.getByText("Sam")).toHaveClass("text-text-brand");
    expect(screen.getByText("Alex")).toHaveClass("text-text-secondary");
  });
});
