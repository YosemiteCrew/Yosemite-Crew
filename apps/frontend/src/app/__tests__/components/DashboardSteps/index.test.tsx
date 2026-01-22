import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DashboardSteps from "@/app/components/DashboardSteps";

const usePrimaryOrgMock = jest.fn();
const useSubscriptionMock = jest.fn();
const useServicesMock = jest.fn();
const useTeamMock = jest.fn();

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock("@/app/hooks/useBilling", () => ({
  useSubscriptionForPrimaryOrg: () => useSubscriptionMock(),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useServicesForPrimaryOrgSpecialities: () => useServicesMock(),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, isDisabled }: any) => (
    <button type="button" disabled={isDisabled}>
      {text}
    </button>
  ),
}));

describe("DashboardSteps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders steps with computed button text", () => {
    usePrimaryOrgMock.mockReturnValue({ _id: "org1", isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: "acct_1",
      connectChargesEnabled: false,
    });
    useServicesMock.mockReturnValue([]);
    useTeamMock.mockReturnValue([{ _id: "u1" }]);

    render(<DashboardSteps />);

    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(screen.getByText("0 of 3 done")).toBeInTheDocument();
    expect(screen.getByText("Add services")).toBeInTheDocument();
    expect(screen.getByText("Invite team")).toBeInTheDocument();
    expect(screen.getByText("Continue setup")).toBeInTheDocument();
  });

  it("returns null when all steps are completed", () => {
    usePrimaryOrgMock.mockReturnValue({ _id: "org1", isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: "acct_1",
      connectChargesEnabled: true,
    });
    useServicesMock.mockReturnValue([{ id: "svc" }]);
    useTeamMock.mockReturnValue([{ _id: "u1" }, { _id: "u2" }]);

    const { container } = render(<DashboardSteps />);
    expect(container.firstChild).toBeNull();
  });
});
