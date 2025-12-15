import React from "react";
import { render, screen } from "@testing-library/react";
import { PermissionGate } from "@/app/components/PermissionGate";
import { usePermissions } from "@/app/hooks/usePermissions";

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: jest.fn(),
}));

const mockUsePermissions = usePermissions as unknown as jest.Mock;

describe("PermissionGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows fallback while loading permissions", () => {
    mockUsePermissions.mockReturnValue({
      isLoading: true,
      can: jest.fn(),
    });

    render(
      <PermissionGate fallback={<div data-testid="fallback">Loading...</div>}>
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("renders fallback when permission check fails", () => {
    mockUsePermissions.mockReturnValue({
      isLoading: false,
      can: jest.fn(() => false),
    });

    render(
      <PermissionGate fallback={<div data-testid="fallback">Nope</div>}>
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("renders children when permissions allow", () => {
    const canMock = jest.fn(() => true);
    mockUsePermissions.mockReturnValue({
      isLoading: false,
      can: canMock,
    });

    render(
      <PermissionGate anyOf={["perm:read" as any]} fallback={<div>Fallback</div>}>
        <div data-testid="child">Allowed</div>
      </PermissionGate>
    );

    expect(canMock).toHaveBeenCalledWith({ anyOf: ["perm:read"] });
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
