import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DocumentsCard from "@/app/components/Cards/DocumentsCard";

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/utils/validators", () => ({
  toTitle: (value: string) => value.toUpperCase(),
}));

describe("DocumentsCard", () => {
  it("renders document info and triggers view", () => {
    const handleViewDocument = jest.fn();
    const doc: any = {
      title: "License",
      description: "State license",
      category: "legal",
    };

    render(
      <DocumentsCard document={doc} handleViewDocument={handleViewDocument} />
    );

    expect(screen.getByText("License")).toBeInTheDocument();
    expect(screen.getByText("State license")).toBeInTheDocument();
    expect(screen.getByText("LEGAL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(handleViewDocument).toHaveBeenCalledWith(doc);
  });
});
