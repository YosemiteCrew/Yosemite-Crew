import React from "react";
import { render, screen } from "@testing-library/react";
import Organization from "@/app/pages/Organization";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

const usePrimaryOrgMock = jest.fn();

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock("@/app/pages/Organization/Sections/index", () => ({
  Profile: () => <div data-testid="profile" />,
  Specialities: () => <div data-testid="specialities" />,
  Rooms: () => <div data-testid="rooms" />,
  Team: () => <div data-testid="team" />,
  Payment: () => <div data-testid="payment" />,
  Documents: () => <div data-testid="documents" />,
  DeleteOrg: () => <div data-testid="delete-org" />,
}));

describe("Organization page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders verified org sections", () => {
    usePrimaryOrgMock.mockReturnValue({ id: "org-1", isVerified: true });

    render(<Organization />);

    expect(screen.getByTestId("profile")).toBeInTheDocument();
    expect(screen.getByTestId("specialities")).toBeInTheDocument();
    expect(screen.getByTestId("team")).toBeInTheDocument();
    expect(screen.getByTestId("rooms")).toBeInTheDocument();
    expect(screen.getByTestId("payment")).toBeInTheDocument();
    expect(screen.getByTestId("documents")).toBeInTheDocument();
    expect(screen.getByTestId("delete-org")).toBeInTheDocument();
  });

  it("hides gated sections for unverified org", () => {
    usePrimaryOrgMock.mockReturnValue({ id: "org-2", isVerified: false });

    render(<Organization />);

    expect(screen.getByTestId("profile")).toBeInTheDocument();
    expect(screen.getByTestId("specialities")).toBeInTheDocument();
    expect(screen.queryByTestId("team")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rooms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("payment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("documents")).not.toBeInTheDocument();
    expect(screen.getByTestId("delete-org")).toBeInTheDocument();
  });
});
