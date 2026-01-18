import React from "react";
import { render } from "@testing-library/react";
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
});
