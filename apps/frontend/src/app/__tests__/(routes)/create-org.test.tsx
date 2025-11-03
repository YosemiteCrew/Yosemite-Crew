import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/CreateOrg/CreateOrg", () => {
  const Mock = () => <div data-testid="protected-create-org">Mocked CreateOrg</div>;
  return { __esModule: true, default: Mock };
});

// Import the page under test (adjust path if your file lives elsewhere)
import Page from "@/app/(routes)/create-org/page";

describe("CreateOrg page", () => {
  it("renders ProtectedCreateOrg", () => {
    render(<Page />);
    expect(screen.getByTestId("protected-create-org")).toBeInTheDocument();
    expect(screen.getByText("Mocked CreateOrg")).toBeInTheDocument();
  });

  it("exports a valid React component", () => {
    // sanity check: default export should be a function component
    expect(typeof Page).toBe("function");
  });
});
