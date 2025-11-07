import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

let latestProgressProps: any;
jest.mock("@/app/components/Steps/Progress/Progress", () => ({
  __esModule: true,
  default: (props: any) => {
    latestProgressProps = props;
    return <div data-testid="team-progress" />;
  },
}));

let latestPersonalProps: any;
jest.mock("@/app/components/Steps/TeamOnboarding/PersonalStep", () => ({
  __esModule: true,
  default: (props: any) => {
    latestPersonalProps = props;
    return <div data-testid="personal-step" />;
  },
}));

let latestProfessionalProps: any;
jest.mock("@/app/components/Steps/TeamOnboarding/ProfessionalStep", () => ({
  __esModule: true,
  default: (props: any) => {
    latestProfessionalProps = props;
    return <div data-testid="professional-step" />;
  },
}));

let latestAvailabilityProps: any;
jest.mock("@/app/components/Steps/TeamOnboarding/AvailabilityStep", () => ({
  __esModule: true,
  default: (props: any) => {
    latestAvailabilityProps = props;
    return <div data-testid="availability-step" />;
  },
}));

import ProtectedTeamOnboarding from "@/app/pages/TeamOnboarding/TeamOnboarding";

describe("TeamOnboarding page", () => {
  beforeEach(() => {
    latestProgressProps = undefined;
    latestPersonalProps = undefined;
    latestProfessionalProps = undefined;
    latestAvailabilityProps = undefined;
  });

  test("shows initial personal step with progress", () => {
    render(<ProtectedTeamOnboarding />);

    expect(screen.getByText("Create profile")).toBeInTheDocument();
    expect(screen.getByTestId("team-progress")).toBeInTheDocument();
    expect(latestProgressProps?.steps).toHaveLength(3);
    expect(screen.getByTestId("personal-step")).toBeInTheDocument();
  });

  test("navigates through onboarding steps", () => {
    render(<ProtectedTeamOnboarding />);

    act(() => {
      latestPersonalProps.nextStep();
    });
    expect(screen.getByTestId("professional-step")).toBeInTheDocument();

    act(() => {
      latestProfessionalProps.nextStep();
    });
    expect(screen.getByTestId("availability-step")).toBeInTheDocument();

    act(() => {
      latestAvailabilityProps.prevStep();
    });
    expect(screen.getByTestId("professional-step")).toBeInTheDocument();
  });
});
