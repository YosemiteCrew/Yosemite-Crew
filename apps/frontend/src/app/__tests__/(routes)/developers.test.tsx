import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const signInMock = jest.fn(() => <div data-testid="dev-signin-page" />);
const signUpMock = jest.fn(() => <div data-testid="dev-signup-page" />);

jest.mock("@/app/pages/DeveloperLanding/DeveloperLanding", () => ({
  __esModule: true,
  default: () => <div data-testid="dev-landing" />,
}));

jest.mock("@/app/pages/DeveloperDocs/DeveloperDocs", () => ({
  __esModule: true,
  default: () => <div data-testid="dev-docs" />,
}));

jest.mock("@/app/pages/DeveloperPortalHome/DeveloperPortalHome", () => ({
  __esModule: true,
  default: () => <div data-testid="dev-portal-home" />,
}));

jest.mock("@/app/components/DevRouteGuard/DevRouteGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => ({
    session: {
      getIdToken: () => ({
        decodePayload: () => ({
          given_name: "Grace",
          family_name: "Hopper",
          email: "grace@example.com",
          "custom:role": "developer",
        }),
      }),
    },
    user: { getUsername: () => "graceh" },
  }),
}));

jest.mock("@/app/pages/SignIn/SignIn", () => ({
  __esModule: true,
  default: (props: any) => signInMock(),
}));

jest.mock("@/app/pages/SignUp/SignUp", () => ({
  __esModule: true,
  default: (props: any) => signUpMock(),
}));

import DevelopersRoute from "@/app/(routes)/(public)/developers/page";
import DevSettingsRoute from "@/app/(routes)/(app)/developers/settings/page";
import DevPortalHomeRoute from "@/app/(routes)/(app)/developers/(portal)/home/page";
import DevDocumentationRoute from "@/app/(routes)/(app)/developers/(portal)/documentation/page";
import DevPluginsRoute from "@/app/(routes)/(app)/developers/(portal)/plugins/page";
import DevWebsiteBuilderRoute from "@/app/(routes)/(app)/developers/(portal)/website-builder/page";
import DevApiKeysRoute from "@/app/(routes)/(app)/developers/(portal)/api-keys/page";

describe("developer routes", () => {
  test("root developer route renders landing page", () => {
    render(<DevelopersRoute />);
    expect(screen.getByTestId("dev-landing")).toBeInTheDocument();
  });

  test("settings route renders profile inside guard", () => {
    render(<DevSettingsRoute />);
    expect(screen.getByTestId("dev-guard")).toBeInTheDocument();
    expect(screen.getByText("Developer Settings")).toBeInTheDocument();
    expect(screen.getByText(/Grace Hopper/)).toBeInTheDocument();
    expect(screen.getByText(/grace@example.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/developer/i)[0]).toBeInTheDocument();
  });

  test("portal home route renders portal component", () => {
    render(<DevPortalHomeRoute />);
    expect(screen.getByTestId("dev-portal-home")).toBeInTheDocument();
  });

  test("documentation route renders developer docs", () => {
    render(<DevDocumentationRoute />);
    expect(screen.getByTestId("dev-docs")).toBeInTheDocument();
  });

  test("plugins route renders within guard", () => {
    render(<DevPluginsRoute />);
    expect(screen.getByTestId("dev-guard")).toBeInTheDocument();
    expect(screen.getByText("Plugins")).toBeInTheDocument();
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
  });

  test("website builder route renders within guard", () => {
    render(<DevWebsiteBuilderRoute />);
    expect(screen.getByTestId("dev-guard")).toBeInTheDocument();
    expect(screen.getByText("Website Builder")).toBeInTheDocument();
  });

  test("api keys route renders within guard", () => {
    render(<DevApiKeysRoute />);
    expect(screen.getByTestId("dev-guard")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
  });
});
