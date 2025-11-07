import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/AboutUs/AboutUs", () => ({
  __esModule: true,
  default: () => <div data-testid="route-about" />,
}));

jest.mock("@/app/pages/PetOwner/PetOwner", () => ({
  __esModule: true,
  default: () => <div data-testid="route-application" />,
}));

jest.mock("@/app/pages/BookDemo/BookDemo", () => ({
  __esModule: true,
  default: () => <div data-testid="route-book-demo" />,
}));

jest.mock("@/app/pages/ContactusPage/ContactusPage", () => ({
  __esModule: true,
  default: () => <div data-testid="route-contact" />,
}));

jest.mock("@/app/pages/DeveloperLanding/DeveloperLanding", () => ({
  __esModule: true,
  default: () => <div data-testid="route-developers" />,
}));

jest.mock("@/app/pages/Organizations/Organizations", () => ({
  __esModule: true,
  default: () => <div data-testid="route-organizations" />,
}));

jest.mock("@/app/pages/CreateOrg/CreateOrg", () => ({
  __esModule: true,
  default: () => <div data-testid="route-create-org" />,
}));

jest.mock("@/app/pages/Dashboard/Dashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="route-dashboard" />,
}));

jest.mock("@/app/pages/HomePage/HomePage", () => ({
  __esModule: true,
  default: () => <div data-testid="route-pms" />,
}));

jest.mock("@/app/pages/PricingPage/PricingPage", () => ({
  __esModule: true,
  default: () => <div data-testid="route-pricing" />,
}));

jest.mock("@/app/pages/PrivacyPolicy/PrivacyPolicy", () => ({
  __esModule: true,
  default: () => <div data-testid="route-privacy-policy" />,
}));

jest.mock("@/app/pages/TermsAndConditions/TermsAndConditions", () => ({
  __esModule: true,
  default: () => <div data-testid="route-terms" />,
}));

jest.mock("@/app/components/Footer/Footer", () => ({
  __esModule: true,
  default: () => <footer data-testid="route-footer" />,
}));

jest.mock("@/app/pages/TeamOnboarding/TeamOnboarding", () => ({
  __esModule: true,
  default: () => <div data-testid="route-team-onboarding" />,
}));

import AboutRoute, * as AboutModule from "@/app/(routes)/about/page";
import ApplicationRoute, * as ApplicationModule from "@/app/(routes)/application/page";
import BookDemoRoute, * as BookDemoModule from "@/app/(routes)/book-demo/page";
import ContactRoute, * as ContactModule from "@/app/(routes)/contact/page";
import DevelopersRoute, * as DevelopersModule from "@/app/(routes)/developers/page";
import OrganizationsRoute, * as OrganizationsModule from "@/app/(routes)/organizations/page";
import CreateOrgRoute, * as CreateOrgModule from "@/app/(routes)/create-org/page";
import DashboardRoute, * as DashboardModule from "@/app/(routes)/dashboard/page";
import PmsRoute, * as PmsModule from "@/app/(routes)/pms/page";
import PricingRoute, * as PricingModule from "@/app/(routes)/pricing/page";
import PrivacyPolicyRoute, * as PrivacyPolicyModule from "@/app/(routes)/privacy-policy/page";
import TermsRoute, * as TermsModule from "@/app/(routes)/terms-and-conditions/page";
import TeamOnboardingRoute, * as TeamOnboardingModule from "@/app/(routes)/team-onboarding/page";

type RouteCase = {
  name: string;
  RouteComponent: React.ComponentType;
  Module: { default: React.ComponentType };
  expectedTestIds: string[];
};

const routeCases: RouteCase[] = [
  {
    name: "AboutUs",
    RouteComponent: AboutRoute,
    Module: AboutModule,
    expectedTestIds: ["route-about"],
  },
  {
    name: "Application",
    RouteComponent: ApplicationRoute,
    Module: ApplicationModule,
    expectedTestIds: ["route-application"],
  },
  {
    name: "Book Demo",
    RouteComponent: BookDemoRoute,
    Module: BookDemoModule,
    expectedTestIds: ["route-book-demo"],
  },
  {
    name: "Contact",
    RouteComponent: ContactRoute,
    Module: ContactModule,
    expectedTestIds: ["route-contact"],
  },
  {
    name: "Developers",
    RouteComponent: DevelopersRoute,
    Module: DevelopersModule,
    expectedTestIds: ["route-developers"],
  },
  {
    name: "Organizations",
    RouteComponent: OrganizationsRoute,
    Module: OrganizationsModule,
    expectedTestIds: ["route-organizations"],
  },
  {
    name: "Create Org",
    RouteComponent: CreateOrgRoute,
    Module: CreateOrgModule,
    expectedTestIds: ["route-create-org"],
  },
  {
    name: "Dashboard",
    RouteComponent: DashboardRoute,
    Module: DashboardModule,
    expectedTestIds: ["route-dashboard"],
  },
  {
    name: "PMS",
    RouteComponent: PmsRoute,
    Module: PmsModule,
    expectedTestIds: ["route-pms"],
  },
  {
    name: "Pricing",
    RouteComponent: PricingRoute,
    Module: PricingModule,
    expectedTestIds: ["route-pricing"],
  },
  {
    name: "Privacy Policy",
    RouteComponent: PrivacyPolicyRoute,
    Module: PrivacyPolicyModule,
    expectedTestIds: ["route-privacy-policy"],
  },
  {
    name: "Terms and Conditions",
    RouteComponent: TermsRoute,
    Module: TermsModule,
    expectedTestIds: ["route-terms", "route-footer"],
  },
  {
    name: "Team Onboarding",
    RouteComponent: TeamOnboardingRoute,
    Module: TeamOnboardingModule,
    expectedTestIds: ["route-team-onboarding"],
  },
];

describe("static route wrappers", () => {
  test.each(routeCases)("page (%s route)", ({ RouteComponent, Module, expectedTestIds }) => {
    render(<RouteComponent />);
    for (const testId of expectedTestIds) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(typeof RouteComponent).toBe("function");
    expect(typeof Module.default).toBe("function");
  });
});
