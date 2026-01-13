import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import AddDocument from "@/app/pages/Organization/Sections/Documents/AddDocument";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (
    <div data-testid="modal" data-open={showModal}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value ?? ""} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea aria-label={inlabel} value={value ?? ""} onChange={onChange} />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect }: any) => (
    <div>
      <span>{placeholder}</span>
      {options.map((option: any) => (
        <button
          key={`${placeholder}-${option.key}`}
          type="button"
          onClick={() => onSelect(option)}
        >
          {placeholder}: {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/UploadImage/DocUploader", () => ({
  __esModule: true,
  default: ({ onChange, error }: any) => (
    <div>
      <button type="button" onClick={() => onChange("file-url")}>
        Upload document
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: () => ({
      primaryOrgId: "org-1",
    }),
  },
}));

jest.mock("@/app/services/documentService", () => ({
  createDocument: jest.fn(),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

import { createDocument } from "@/app/services/documentService";

describe("AddDocument", () => {
  const setShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders modal and form fields", () => {
    render(<AddDocument showModal={true} setShowModal={setShowModal} />);

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByText("Add document")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("validates required fields", () => {
    render(<AddDocument showModal={true} setShowModal={setShowModal} />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getAllByText("File is required").length).toBeGreaterThan(0);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("creates document when valid", async () => {
    (createDocument as jest.Mock).mockResolvedValue({});

    render(<AddDocument showModal={true} setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Policy" },
    });
    fireEvent.click(screen.getByText("Type: TERMS AND CONDITIONS"));
    fireEvent.click(screen.getByText("Upload document"));

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createDocument).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
