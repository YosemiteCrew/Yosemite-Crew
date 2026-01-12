import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeveloperLanding from "../../pages/DeveloperLanding/DeveloperLanding";

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <div data-testid="icon-mock" />,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt || "mocked image"} />;
  },
}));

jest.mock("@/app/pages/HomePage/HomePage", () => ({
  FillBtn: ({ text }: { text: string }) => <button>{text}</button>,
  UnFillBtn: ({ text }: { text: string }) => (
    <button className="unfilled">{text}</button>
  ),
}));

// FIXED: Gave the mock component a display name "MockLaunchGrowTab"
jest.mock("@/app/components/LaunchGrowTab/LaunchGrowTab", () =>
  function MockLaunchGrowTab() {
    return <div data-testid="launch-grow-tab">LaunchGrowTab Mock</div>;
  }
);

// FIXED: Gave the mock component a display name "MockFooter"
jest.mock("@/app/components/Footer/Footer", () =>
  function MockFooter() {
    return <footer data-testid="footer">Footer Mock</footer>;
  }
);

describe("DeveloperLanding Page", () => {
  beforeEach(() => {
    render(<DeveloperLanding />);
  });

  it("renders the main hero section with correct heading, paragraph, buttons, and image", () => {
    expect(
      screen.getByText(/Build, customise, and launch powerful apps for the animal health ecosystem/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Transform animal care with your ideas./i)
    ).toBeInTheDocument();
    expect(screen.getByAltText("devlogin")).toBeInTheDocument();
  });

  it("renders the 'Why Yosemite Crew?' section with all content", () => {
    expect(
      screen.getByText(/Why developers choose Yosemite Crew/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Flexibilty/i)).toBeInTheDocument();
    expect(screen.getByAltText("devchose1")).toBeInTheDocument();
    expect(screen.getByText(/Seamless integrations/i)).toBeInTheDocument();
    expect(screen.getByAltText("devchose2")).toBeInTheDocument();
    const openSourceElements = screen.getAllByText(/Open source/i);
    expect(openSourceElements.length).toBeGreaterThan(0);
    expect(screen.getByAltText("devchose3")).toBeInTheDocument();
  });

  it("renders the 'Developer Tools and Resources' section", () => {
    expect(
      screen.getByText(/Everything you need to build and launch/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/From robust APIs to intuitive SDKs/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("launch-grow-tab")).toBeInTheDocument();
  });

  it("renders the 'Get Started' section with three steps", () => {
    expect(
      screen.getByText(/Get started in three simple steps/i)
    ).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /Developer portal/i });
    expect(links.length).toBeGreaterThan(0);

    expect(screen.getByText(/^Sign up$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Create your developer account/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/Explore/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Browse APIs, SDKs, and templates/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/^Build$/i)).toBeInTheDocument();
    expect(screen.getByText(/Develop, test, and deploy your app/i)).toBeInTheDocument();
  });

  it("renders the footer", () => {
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });
});