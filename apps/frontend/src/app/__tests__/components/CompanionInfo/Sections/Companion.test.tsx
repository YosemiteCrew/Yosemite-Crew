import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Companion from "@/app/components/CompanionInfo/Sections/Companion";

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, fields, data }: any) => (
    <div data-testid="editable-accordion">
      <div>{title}</div>
      <div data-testid="fields-count">{fields.length}</div>
      <div data-testid="data-name">{data.name}</div>
    </div>
  ),
}));

describe("CompanionInfo Companion section", () => {
  it("renders companion information accordion", () => {
    const companion = {
      companion: {
        name: "Buddy",
        insurance: { companyName: "InsureCo" },
      },
    } as any;

    render(<Companion companion={companion} />);

    expect(screen.getByText("Companion information")).toBeInTheDocument();
    expect(screen.getByTestId("fields-count")).toHaveTextContent("13");
    expect(screen.getByTestId("data-name")).toHaveTextContent("Buddy");
  });
});
