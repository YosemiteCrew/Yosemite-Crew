import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

let latestProgressProps: any;
jest.mock("@/app/components/Steps/Progress/Progress", () => ({
  __esModule: true,
  default: (props: any) => {
    latestProgressProps = props;
    return <div data-testid="create-org-progress" />;
  },
}));

let latestOrgStepProps: any;
jest.mock("@/app/components/Steps/CreateOrg/OrgStep", () => ({
  __esModule: true,
  default: (props: any) => {
    latestOrgStepProps = props;
    return <div data-testid="org-step" />;
  },
}));

let latestAddressStepProps: any;
jest.mock("@/app/components/Steps/CreateOrg/AddressStep", () => ({
  __esModule: true,
  default: (props: any) => {
    latestAddressStepProps = props;
    return <div data-testid="address-step" />;
  },
}));

let latestSpecialityStepProps: any;
jest.mock("@/app/components/Steps/CreateOrg/SpecialityStep", () => ({
  __esModule: true,
  default: (props: any) => {
    latestSpecialityStepProps = props;
    return <div data-testid="speciality-step" />;
  },
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

const mockUseOrgOnboardingResult = {
  org: null,
  step: 0,
  specialities: [] as any[],
};

jest.mock("@/app/hooks/useOrgOnboarding", () => ({
  useOrgOnboarding: () => mockUseOrgOnboardingResult,
}));

const mockRouter = { replace: jest.fn() };
const mockSearchParams = { get: () => null };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

import ProtectedCreateOrg from "@/app/pages/CreateOrg/CreateOrg";

describe("CreateOrg page", () => {
  beforeEach(() => {
    latestProgressProps = undefined;
    latestOrgStepProps = undefined;
    latestAddressStepProps = undefined;
    latestSpecialityStepProps = undefined;
  });

  test("renders initial step with progress component", () => {
    render(<ProtectedCreateOrg />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByText("Create organization")).toBeInTheDocument();
    expect(screen.getByTestId("create-org-progress")).toBeInTheDocument();
    expect(latestProgressProps?.steps).toHaveLength(3);
    expect(screen.getByTestId("org-step")).toBeInTheDocument();
  });

  test("advances through steps when nextStep is invoked", async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestOrgStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId("address-step")).toBeInTheDocument();
    });

    act(() => {
      latestAddressStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId("speciality-step")).toBeInTheDocument();
    });
    expect(latestSpecialityStepProps.specialities).toBeDefined();
    expect(Array.isArray(latestSpecialityStepProps.specialities)).toBe(true);
  });

  test("goes back to previous step when prevStep called", async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestOrgStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId("address-step")).toBeInTheDocument();
    });

    act(() => {
      latestAddressStepProps.prevStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId("org-step")).toBeInTheDocument();
    });
  });
});
