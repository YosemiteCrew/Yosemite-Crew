import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddDocument from "@/app/pages/Organization/Sections/Documents/AddDocument";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock("@/app/components/UploadImage/DocUploader", () => ({
  __esModule: true,
  default: ({ onChange, error }: any) => (
    <div>
      <button type="button" onClick={() => onChange("file-url")}>Upload</button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ value: "CANCELLATION_POLICY" })}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: () => ({ primaryOrgId: "org-1" }),
  },
}));

jest.mock("@/app/services/documentService", () => ({
  createDocument: jest.fn(),
}));

const documentService = jest.requireMock("@/app/services/documentService");

describe("AddDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors", () => {
    render(<AddDocument showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getAllByText("File is required")).toHaveLength(2);
  });

  it("creates a document", async () => {
    documentService.createDocument.mockResolvedValue({});
    const setShowModal = jest.fn();

    render(<AddDocument showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Policy" },
    });
    fireEvent.click(screen.getByText("Upload"));

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(documentService.createDocument).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
