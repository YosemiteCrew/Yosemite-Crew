import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddDocument from "@/app/pages/Organization/Sections/Documents/AddDocument";
import { createDocument } from "@/app/services/documentService";
import { useOrgStore } from "@/app/stores/orgStore";

// --- Mocks ---

jest.mock("@/app/services/documentService", () => ({
  createDocument: jest.fn(),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid="accordion">
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input data-testid="input-title" value={value} onChange={onChange} />
      {error && <span data-testid="error-title">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ onChange, value }: any) => (
    <textarea data-testid="input-desc" value={value} onChange={onChange} />
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <select
      data-testid="input-category"
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="CANCELLATION_POLICY">Cancellation Policy</option>
      <option value="PRIVACY_POLICY">Privacy Policy</option>
    </select>
  ),
}));

jest.mock("@/app/components/UploadImage/DocUploader", () => ({
  __esModule: true,
  default: ({ onChange, error }: any) => (
    <div>
      <button
        data-testid="mock-upload-btn"
        onClick={() => onChange("https://mock-url.com/file.pdf")}
      >
        Simulate Upload
      </button>
      {/* This mock renders the error, causing duplication with the parent's error render */}
      {error && <span data-testid="error-file-mock">{error}</span>}
    </div>
  ),
}));

describe("AddDocument Component", () => {
  const mockSetShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });
  });

  // --- 1. Rendering Section ---

  it("renders nothing if primaryOrgId is missing", () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    const { container } = render(
      <AddDocument showModal={true} setShowModal={mockSetShowModal} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the modal form when primaryOrgId exists", () => {
    render(<AddDocument showModal={true} setShowModal={mockSetShowModal} />);
    expect(screen.getByText("Add document")).toBeInTheDocument();
    expect(screen.getByTestId("input-title")).toBeInTheDocument();
    expect(screen.getByTestId("mock-upload-btn")).toBeInTheDocument();
  });

  // --- 2. Interaction Section ---

  it("closes modal when close icon is clicked", () => {
    const { container } = render(
      <AddDocument showModal={true} setShowModal={mockSetShowModal} />
    );
    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) fireEvent.click(closeIcon);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("updates form fields", () => {
    render(<AddDocument showModal={true} setShowModal={mockSetShowModal} />);
    fireEvent.change(screen.getByTestId("input-title"), {
      target: { value: "My Doc" },
    });
    expect(screen.getByTestId("input-title")).toHaveValue("My Doc");
  });

  // --- 3. Validation Section ---

  it("shows validation errors for missing title and file", async () => {
    render(<AddDocument showModal={true} setShowModal={mockSetShowModal} />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByTestId("error-title")).toHaveTextContent(
      "Name is required"
    );

    // FIX: Handle duplicate text by using getAllByText or checking specific mock testId
    const fileErrors = screen.getAllByText("File is required");
    expect(fileErrors.length).toBeGreaterThanOrEqual(1);

    expect(createDocument).not.toHaveBeenCalled();
  });

  // --- 4. Submission Section ---

  it("submits form data successfully and closes modal", async () => {
    (createDocument as jest.Mock).mockResolvedValueOnce({ success: true });
    render(<AddDocument showModal={true} setShowModal={mockSetShowModal} />);

    fireEvent.change(screen.getByTestId("input-title"), {
      target: { value: "Valid Doc" },
    });
    fireEvent.change(screen.getByTestId("input-category"), {
      target: { value: "PRIVACY_POLICY" },
    });
    fireEvent.click(screen.getByTestId("mock-upload-btn"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createDocument).toHaveBeenCalled();
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("logs error to console on submission failure", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    (createDocument as jest.Mock).mockRejectedValueOnce(
      new Error("Network Error")
    );

    render(<AddDocument showModal={true} setShowModal={mockSetShowModal} />);
    fireEvent.change(screen.getByTestId("input-title"), {
      target: { value: "Doc" },
    });
    fireEvent.click(screen.getByTestId("mock-upload-btn"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });
});
