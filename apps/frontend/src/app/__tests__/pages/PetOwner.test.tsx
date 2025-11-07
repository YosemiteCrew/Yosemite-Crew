import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/image", () => {
  return ({ alt = "", ...props }: any) => {
    const {
      // strip Next/Image-specific or non-DOM props
      objectFit,
      objectPosition,
      fill,
      loader,
      quality,
      priority,
      placeholder,
      blurDataURL,
      onLoadingComplete,
      unoptimized,
      ...rest
    } = props;
    return <img alt={alt} {...rest} />;
  };
});

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

jest.mock("@/app/components/Footer/Footer", () => () => (
  <footer data-testid="footer" />
));

import PetOwner, { PetDownBtn } from "@/app/pages/PetOwner/PetOwner";

describe("PetOwner page", () => {
  test("renders hero content, toolkit, and footer", () => {
    render(<PetOwner />);

    expect(
      screen.getByRole("heading", {
        name: /Your companion’s health, in your hands/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Your companion’s all-in-one Toolkit/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId(/icon-solar:/)).not.toHaveLength(0);
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });
});

describe("PetDownBtn", () => {
  test("shows coming soon pill when not launched", () => {
    render(<PetDownBtn launched={false} />);
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /App Store/i })
    ).not.toBeInTheDocument();
  });

  test("renders platform download links when launched", () => {
    render(<PetDownBtn launched />);
    expect(
      screen.getByRole("link", { name: /App Store/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Google Play/i })
    ).toBeInTheDocument();
  });
});
