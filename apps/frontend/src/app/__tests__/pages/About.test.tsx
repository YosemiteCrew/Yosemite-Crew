import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AboutUs from "../../pages/AboutUs/AboutUs";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt || "mock image"} />;
  },
}));

jest.mock("@/app/components/TeamSlide/TeamSlide", () => {
  return function MockTeamSlide() {
    return <div data-testid="mock-teamslide">TeamSlide Component</div>;
  };
});

jest.mock("@/app/components/Footer/Footer", () => {
  return function MockFooter() {
    return <div data-testid="mock-footer">Footer Component</div>;
  };
});

describe("AboutUs Page", () => {
  beforeEach(() => {
    render(<AboutUs />);
  });

  it("should render the hero section content correctly", () => {
    expect(
      screen.getByText(/Welcome to Yosemite Crew where compassion meets code/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/For pet businesses, pet parents, and developers/i),
    ).toBeInTheDocument();
  });

  it("should render the 'About Us' cards section correctly", () => {
    expect(screen.getByText("About Us")).toBeInTheDocument();
    expect(screen.getByText("Why do we exist?")).toBeInTheDocument();
    expect(screen.getByText("Our mission")).toBeInTheDocument();
    expect(screen.getByText("Our USP")).toBeInTheDocument();
  });

  it("should render the 'Our Story' section correctly", () => {
    expect(screen.getByText("Our story")).toBeInTheDocument();
    expect(screen.getByAltText("aboutstory")).toBeInTheDocument();
    expect(
      screen.getByText(/Our story began in the field quite literally/i),
    ).toBeInTheDocument();
  });

  it("should render the community/team section correctly", () => {
    expect(
      screen.getByText(/We.?re an open source community/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/That means no gates, no egos./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Just a group of humans trying to build better tools/i),
    ).toBeInTheDocument();
  });

  it("should render the mocked TeamSlide and Footer components", () => {
    expect(screen.getByTestId("mock-teamslide")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });
});