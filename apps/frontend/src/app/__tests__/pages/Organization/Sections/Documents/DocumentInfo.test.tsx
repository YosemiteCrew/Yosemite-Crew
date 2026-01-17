import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DocumentInfo from "@/app/pages/Organization/Sections/Documents/DocumentInfo";

const updateDocumentMock = jest.fn();

jest.mock("@/app/services/documentService", () => ({
  updateDocument: (...args: any[]) => updateDocumentMock(...args),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, onSave }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={() => onSave?.({ title: "Doc" })}>
        save
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/UploadImage/DocUploader", () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange("file-url")}
    >
      upload
    </button>
  ),
}));

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

describe("DocumentInfo", () => {
  it("shows download and save actions", async () => {
    const setShowModal = jest.fn();
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    const doc: any = {
      _id: "d1",
      organisationId: "org1",
      fileUrl: "https://example.com/file.pdf",
      title: "Doc",
      description: "Desc",
      category: "legal",
    };

    render(
      <DocumentInfo
        showModal
        setShowModal={setShowModal}
        activeDocument={doc}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Download document" }));
    expect(openSpy).toHaveBeenCalledWith(doc.fileUrl, "_blank");

    fireEvent.click(screen.getByRole("button", { name: "upload" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateDocumentMock).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });
});
