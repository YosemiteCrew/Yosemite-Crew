import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/(app)/settings/page";

// 1. Mock the child component
// This replaces the complex Settings page with a simple dummy element
jest.mock("@/app/pages/Settings", () => {
  return function MockProtectedSettings() {
    return <div data-testid="protected-settings-mock">Settings Content</div>;
  };
});

describe("Settings Page", () => {
  it("renders the ProtectedSettings component correctly", () => {
    // 2. Render the page wrapper
    render(<Page />);

    // 3. Assert that the specific mocked child is present
    const childComponent = screen.getByTestId("protected-settings-mock");
    expect(childComponent).toBeInTheDocument();
  });
});
