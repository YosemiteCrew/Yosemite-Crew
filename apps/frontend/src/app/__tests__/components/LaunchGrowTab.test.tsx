import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import LaunchGrowTab from "@/app/components/LaunchGrowTab/LaunchGrowTab";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt} />;
  },
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: (props: any) => <i data-testid="mock-icon" data-icon={props.icon} />,
}));

describe("LaunchGrowTab Component", () => {
  it("should switch to the correct tab when a tab button is clicked", async () => {
    const user = userEvent.setup();
    render(<LaunchGrowTab />);

    const sdkTabButton = screen.getByRole("button", { name: /SDKs/i });
    await user.click(sdkTabButton);

    const headings = screen.getAllByRole("heading", {
      name: "Software Development Kit",
      level: 2,
    });
    expect(headings.length).toBeGreaterThan(0);
    const texts = screen.getAllByText(
      "Provides APIs for authentication, user roles, patient records, appointment scheduling, and billing."
    );
    expect(texts.length).toBeGreaterThan(0);

    expect(
      screen.queryByRole("heading", {
        name: "Application Programming Interface",
        level: 2,
      })
    ).not.toBeInTheDocument();
  });

  it("should display the correct content for the 'Documentation' tab when active", async () => {
    const user = userEvent.setup();
    render(<LaunchGrowTab />);

    const documentationTabButton = screen.getByRole("button", {
      name: /Documentation/i,
    });
    await user.click(documentationTabButton);

    const headings = screen.getAllByRole("heading", {
      name: "Documentation",
      level: 2,
    });
    expect(headings.length).toBeGreaterThan(0);
    const texts = screen.getAllByText(
      "Endpoints, authentication methods, request/response examples, and SDK usage guides."
    );
    expect(texts.length).toBeGreaterThan(0);
  });
});
