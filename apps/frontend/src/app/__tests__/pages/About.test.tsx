import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AboutUs from "../../pages/AboutUs/AboutUs";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} />;
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
      screen.getByRole("heading", {
        name: /Welcome to Yosemite Crew Where compassion meets code/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /For Pet Businesses,Pet parents, and Developers/i,
      }),
    ).toBeInTheDocument();
  });

  it("should render the 'About Us' cards section correctly", () => {
    expect(
      screen.getByRole("heading", { name: "About Us" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Why Do We exist?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Our Mission" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Our USP" }),
    ).toBeInTheDocument();
  });

  it("should render the 'Our Story' section correctly", () => {
    expect(
      screen.getByRole("heading", { name: "Our Story" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("aboutstory")).toBeInTheDocument();
    expect(
      screen.getByText(/Our story began in the field quite literally/i),
    ).toBeInTheDocument();
  });

  it("should render the community/team section correctly", () => {
    expect(
      screen.getByRole("heading", {
        name: /We're not a Company. We're a Community./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /That means No Gates, No Egos./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Just a group of humans trying to build better tools/i),
    ).toBeInTheDocument();
  });

  it("should render the mocked TeamSlide and Footer components", () => {
    expect(screen.getByTestId("mock-teamslide")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });
});