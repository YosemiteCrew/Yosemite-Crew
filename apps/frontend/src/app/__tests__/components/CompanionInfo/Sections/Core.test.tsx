import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Core from "@/app/components/CompanionInfo/Sections/Core";

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div data-testid="accordion">{title}</div>,
}));

describe("CompanionInfo Core section", () => {
  it("renders breeding and physical accordions", () => {
    render(<Core companion={{}} />);

    const accordions = screen.getAllByTestId("accordion");
    expect(accordions).toHaveLength(2);
    expect(screen.getByText("Breeding information")).toBeInTheDocument();
    expect(screen.getByText("Physical information")).toBeInTheDocument();
  });
});
