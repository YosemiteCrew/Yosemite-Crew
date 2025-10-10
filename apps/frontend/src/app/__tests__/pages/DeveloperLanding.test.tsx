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

jest.mock(
  "@/app/components/LaunchGrowTab/LaunchGrowTab",
  () => () => <div data-testid="launch-grow-tab">LaunchGrowTab Mock</div>
);

jest.mock(
  "@/app/components/Footer/Footer",
  () => () => <footer data-testid="footer">Footer Mock</footer>
);



describe("DeveloperLanding Page", () => {
  beforeEach(() => {
    render(<DeveloperLanding />);
  });

  it("renders the main hero section with correct heading, paragraph, buttons, and image", () => {
    expect(screen.getByRole("heading", { name: /Build, customize, and launch powerful apps/i })).toBeInTheDocument();
    expect(screen.getByText(/Transform pet healthcare with your ideas./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Explore Dev Tools/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Learn more/i })).toBeInTheDocument();
    expect(screen.getByAltText("devlogin")).toBeInTheDocument();
  });

  it("renders the 'Why Yosemite Crew?' section with all content", () => {
    expect(screen.getByText(/Why Yosemite Crew?/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Why Developers Choose Yosemite Crew/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Flexibilty/i })).toBeInTheDocument();
    expect(screen.getByAltText("devchose1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Seamless Integrations/i })).toBeInTheDocument();
    expect(screen.getByAltText("devchose2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Open Source/i })).toBeInTheDocument();
    expect(screen.getByAltText("devchose3")).toBeInTheDocument();
  });

  it("renders the 'Developer Tools and Resources' section", () => {
    expect(screen.getByRole("heading", { name: /Everything You Need to Build and Launch/i })).toBeInTheDocument();
    expect(screen.getByText(/From robust APIs to intuitive SDKs/i)).toBeInTheDocument();
    expect(screen.getByTestId("launch-grow-tab")).toBeInTheDocument();
  });

  it("renders the 'Get Started' section with three steps", () => {
    expect(screen.getByRole("heading", { name: /Get Started in Three Simple Steps/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign up to Build/i })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /^Sign up$/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByText(/Create your developer account/i)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Explore/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByText(/Browse APIs, SDKs, and templates/i)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /^Build$/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByText(/Develop, test, and deploy your app/i)).toBeInTheDocument();
  });

  it("renders the pricing section with all options", () => {
    expect(screen.getByRole("heading", { name: /Transparent Pricing That Fits Your Needs/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Pay-As-You-Go/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Free Option/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /No Lock-In/i })).toBeInTheDocument();
  });

  it("renders the 'Ready to Build' call-to-action section", () => {
    expect(screen.getByText(/Ready to Build?/i)).toBeInTheDocument();
    expect(screen.getByText(/Join a growing community of developers/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign Up as a Developer/i })).toBeInTheDocument();
    expect(screen.getByAltText("devlpbuild")).toBeInTheDocument();
  });

  it("renders the footer", () => {
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });
});