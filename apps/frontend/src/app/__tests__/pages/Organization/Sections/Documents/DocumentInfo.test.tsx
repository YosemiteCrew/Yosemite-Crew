import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DocumentInfo from "@/app/pages/Organization/Sections/Documents/DocumentInfo";

const updateDocumentMock = jest.fn();
const deleteRoomMock = jest.fn();

jest.mock("@/app/services/documentService", () => ({
  updateDocument: (...args: any[]) => updateDocumentMock(...args),
  deleteRoom: (...args: any[]) => deleteRoomMock(...args),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

const accordionCalls: any[] = [];

jest.mock("@/app/components/Accordion/EditableAccordion", () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid="document-accordion" />;
});

jest.mock("@/app/components/UploadImage/DocUploader", () => (props: any) => (
  <button type="button" onClick={() => props.onChange("updated.pdf")}>
    Upload
  </button>
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

describe("DocumentInfo modal", () => {
  const activeDocument: any = {
    _id: "doc-1",
    organisationId: "org-1",
    fileUrl: "https://example.com/doc.pdf",
    title: "Doc",
    description: "Desc",
    category: "POLICY",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
  });

  it("updates document info and file", async () => {
    const setShowModal = jest.fn();
    render(
      <DocumentInfo
        showModal
        setShowModal={setShowModal}
        activeDocument={activeDocument}
        canEditDocument
      />
    );

    await accordionCalls[0].onSave({
      title: "Updated",
      description: "New",
      category: "OTHER",
    });

    expect(updateDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "doc-1",
        title: "Updated",
        description: "New",
        category: "OTHER",
      })
    );

    fireEvent.click(screen.getByText("Upload"));
    fireEvent.click(screen.getByText("Save"));

    expect(updateDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileUrl: "updated.pdf" })
    );
  });
});
