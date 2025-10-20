import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProtectedOrganizations from "@/app/pages/Organizations/Organizations";
import { getData } from "@/app/services/axios";
import type { AxiosResponse } from "axios";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/app/services/axios", () => ({
  getData: jest.fn(),
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("../../components/DataTable/OrganizationList", () => ({
  __esModule: true,
  default: ({ orgs }: { orgs: any[] }) => (
    <div data-testid="org-list">{orgs.length} organisations</div>
  ),
}));

jest.mock("../../components/DataTable/OrgInvites", () => ({
  __esModule: true,
  default: ({ invites }: { invites: any[] }) => (
    <div data-testid="invite-list">{invites.length} invites</div>
  ),
}));

jest.mock("@/app/pages/CompleteProfile/CompleteProfile", () => ({
  HeadText: ({ blktext }: { blktext: string }) => <h1>{blktext}</h1>,
}));

const mockGetData = getData as jest.MockedFunction<typeof getData>;

describe("<Organizations />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // suppress console.error for this suite only
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("renders heading and Create button", () => {
    render(<ProtectedOrganizations />);
    expect(screen.getByText("Organizations")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create new organization/i })
    ).toBeInTheDocument();
  });

  it("fetches and displays organisations & invites", async () => {
    mockGetData
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
        data: [{ id: 1 }, { id: 2 }],
      } as AxiosResponse)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
        data: [{ id: 3 }],
      } as AxiosResponse);

    render(<ProtectedOrganizations />);

    await waitFor(() => {
      expect(screen.getByTestId("org-list")).toHaveTextContent(
        "2 organisations"
      );
      expect(screen.getByTestId("invite-list")).toHaveTextContent("1 invites");
    });
  });

  it("shows 0 lists when APIs fail", async () => {
    mockGetData
      .mockRejectedValueOnce(new Error("org fail"))
      .mockRejectedValueOnce(new Error("invite fail"));

    render(<ProtectedOrganizations />);

    await waitFor(() => {
      expect(screen.getByTestId("org-list")).toHaveTextContent(
        "0 organisations"
      );
      expect(screen.getByTestId("invite-list")).toHaveTextContent("0 invites");
    });
  });
});
