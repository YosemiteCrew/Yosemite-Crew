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
  it("should render correctly with the first tab active by default", () => {
    render(<LaunchGrowTab />);

    expect(screen.getByRole("heading", { name: "Application Programming Interface", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Integrate essential veterinary features like appointment scheduling and medical records.")).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Software Development Kit", level: 2 })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /APIs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SDKs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pre-Built Templates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Documentation/i })).toBeInTheDocument();
  });

  it("should switch to the correct tab when a tab button is clicked", async () => {
    const user = userEvent.setup();
    render(<LaunchGrowTab />);

    expect(screen.queryByRole("heading", { name: "Software Development Kit", level: 2 })).not.toBeInTheDocument();

    const sdkTabButton = screen.getByRole('button', { name: /SDKs/i });
    await user.click(sdkTabButton);

    expect(screen.getByRole("heading", { name: "Software Development Kit", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Provides APIs for authentication, user roles, patient records, appointment scheduling, and billing.")).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Application Programming Interface", level: 2 })).not.toBeInTheDocument();
  });

  it("should display the correct content for the 'Documentation' tab when active", async () => {
    const user = userEvent.setup();
    render(<LaunchGrowTab />);

    const documentationTabButton = screen.getByRole('button', { name: /Documentation/i });
    await user.click(documentationTabButton);

    expect(screen.getByRole("heading", { name: "Documentation", level: 2 })).toBeInTheDocument();

    expect(screen.getByAltText("Documentation icon")).toBeInTheDocument();

    expect(screen.getByText("Endpoints, authentication methods, request/response examples, and SDK usage guides.")).toBeInTheDocument();
  });
});

