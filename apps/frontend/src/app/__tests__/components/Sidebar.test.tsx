import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Sidebar from "@/app/components/Sidebar/Sidebar";
import { useOrgStore } from "@/app/stores/orgStore";
import { useOrgList, usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { useSignOut } from "@/app/hooks/useAuth";

const mockUsePathname = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockRouter,
}));

jest.mock("next/image", () => {
  const MockImage = (props: any) => <img alt={props.alt} {...props} />;
  MockImage.displayName = "MockNextImage";
  return { __esModule: true, default: MockImage };
});

jest.mock("next/link", () => {
  const MockLink = ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockNextLink";
  return MockLink;
});

jest.mock("@/app/hooks/useAuth", () => ({
  useSignOut: jest.fn(),
}));
jest.mock("@/app/hooks/useOrgSelectors", () => ({
  useOrgList: jest.fn(),
  usePrimaryOrg: jest.fn(),
}));
jest.mock("@/app/hooks/useLoadOrg", () => ({ useLoadOrg: jest.fn() }));
jest.mock("@/app/hooks/useProfiles", () => ({ useLoadProfiles: jest.fn() }));
jest.mock("@/app/hooks/useAvailabiities", () => ({ useLoadAvailabilities: jest.fn() }));
jest.mock("@/app/hooks/useSpecialities", () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseOrgList = useOrgList as unknown as jest.Mock;
const mockUsePrimaryOrg = usePrimaryOrg as unknown as jest.Mock;
const mockUseSignOut = useSignOut as unknown as jest.Mock;

const setPrimaryOrg = jest.fn();

const setupOrgStore = (status: string = "loaded") => {
  mockUseOrgStore.mockImplementation((selector: any) =>
    selector({
      status,
      setPrimaryOrg,
    })
  );
};

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/dashboard");
    mockUseSignOut.mockReturnValue({ signOut: jest.fn().mockResolvedValue(undefined) });
  });

  it("renders loading shell when orgs are still loading", () => {
    setupOrgStore("loading");
    mockUseOrgList.mockReturnValue([]);
    mockUsePrimaryOrg.mockReturnValue(null);

    const { container } = render(<Sidebar />);

    expect(container.querySelector(".sidebar")).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("prevents navigation to verified routes when org is missing verification", () => {
    setupOrgStore("loaded");
    const primaryOrg = { _id: "org-1", name: "Primary Org", isVerified: false, imageURL: "https://example.com/img.png" };
    mockUseOrgList.mockReturnValue([primaryOrg]);
    mockUsePrimaryOrg.mockReturnValue(primaryOrg);

    render(<Sidebar />);

    fireEvent.click(screen.getByText("Appointments"));

    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("allows navigation and org switching when data is ready", () => {
    setupOrgStore("loaded");
    const primaryOrg = { _id: "org-1", name: "Primary Org", isVerified: true, imageURL: "https://example.com/org1.png" };
    const secondOrg = { _id: "org-2", name: "Second Org", isVerified: true, imageURL: "https://example.com/org2.png" };
    mockUseOrgList.mockReturnValue([primaryOrg, secondOrg]);
    mockUsePrimaryOrg.mockReturnValue(primaryOrg);

    render(<Sidebar />);

    fireEvent.click(screen.getByText("Dashboard"));
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");

    fireEvent.click(screen.getByText("Primary Org"));
    fireEvent.click(screen.getByText("Second Org"));

    expect(setPrimaryOrg).toHaveBeenCalledWith("org-2");
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
  });

  it("signs out and redirects on sign out click", async () => {
    const signOutMock = jest.fn().mockResolvedValue(undefined);
    mockUseSignOut.mockReturnValue({ signOut: signOutMock });
    setupOrgStore("loaded");
    const primaryOrg = { _id: "org-1", name: "Primary Org", isVerified: true, imageURL: "https://example.com/org1.png" };
    mockUseOrgList.mockReturnValue([primaryOrg]);
    mockUsePrimaryOrg.mockReturnValue(primaryOrg);

    render(<Sidebar />);

    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(mockRouter.replace).toHaveBeenCalledWith("/signin");
  });
});
