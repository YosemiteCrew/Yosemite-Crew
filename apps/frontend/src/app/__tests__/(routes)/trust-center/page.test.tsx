import React from "react";
import { render, screen } from "@testing-library/react";
import TrustCenterPage from "@/app/(routes)/(public)/trust-center/page";

jest.mock("@/app/features/legal", () => ({
  TrustCenter: () => (
    <div data-testid="mock-trust-center">TrustCenter Component</div>
  ),
}));

jest.mock("@/app/ui/widgets/Footer/Footer", () => {
  return function DummyFooter() {
    return <div data-testid="mock-footer">Footer Component</div>;
  };
});

describe("TrustCenterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the TrustCenterPage correctly with all child components", () => {
    render(<TrustCenterPage />);

    const trustCenter = screen.getByTestId("mock-trust-center");
    expect(trustCenter).toBeInTheDocument();
    expect(trustCenter).toHaveTextContent("TrustCenter Component");

    const footer = screen.getByTestId("mock-footer");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent("Footer Component");
  });
});
