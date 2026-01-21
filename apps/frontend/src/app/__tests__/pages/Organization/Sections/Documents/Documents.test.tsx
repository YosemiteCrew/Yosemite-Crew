import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Documents from "@/app/pages/Organization/Sections/Documents/Documents";

const useDocumentsMock = jest.fn();
const usePermissionsMock = jest.fn();
const accordionButtonSpy = jest.fn();

jest.mock("@/app/hooks/useDocuments", () => ({
  useDocumentsForPrimaryOrg: () => useDocumentsMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/AccordionButton", () => (props: any) => {
  accordionButtonSpy(props);
  return <div data-testid="accordion-button">{props.children}</div>;
});

jest.mock("@/app/components/DataTable/DocumentsTable", () => () => (
  <div data-testid="documents-table" />
));

jest.mock("@/app/pages/Organization/Sections/Documents/AddDocument", () => () => (
  <div data-testid="add-document" />
));

jest.mock("@/app/pages/Organization/Sections/Documents/DocumentInfo", () => () => (
  <div data-testid="document-info" />
));

describe("Organization documents section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDocumentsMock.mockReturnValue([
      { _id: "doc-1", title: "Doc" },
    ]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it("renders documents and add button when permitted", () => {
    render(<Documents />);

    expect(screen.getByTestId("documents-table")).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showButton: true })
    );
  });
});
