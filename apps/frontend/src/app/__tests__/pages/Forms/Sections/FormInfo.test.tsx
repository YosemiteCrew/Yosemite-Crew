import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FormInfo from "@/app/pages/Forms/Sections/FormInfo";
import * as formService from "@/app/services/formService";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

// Mock Services
jest.mock("@/app/services/formService", () => ({
  archiveForm: jest.fn(),
  publishForm: jest.fn(),
  unpublishForm: jest.fn(),
}));

// Mock Child Components
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null;
});

jest.mock("@/app/components/Accordion/EditableAccordion", () => {
  return ({ title }: any) => (
    <div data-testid="editable-accordion">{title}</div>
  );
});

jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ title, children }: any) => (
    <div data-testid="accordion">
      <h3>{title}</h3>
      {children}
    </div>
  );
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button
      data-testid={`primary-btn-${text}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button
      data-testid={`secondary-btn-${text}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {text}
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button data-testid="close-icon" onClick={onClick}>
      Close
    </button>
  ),
}));

// FIX: Use absolute path alias to correctly resolve the FormRenderer component mock
jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => {
  return () => <div data-testid="form-renderer">Form Preview Content</div>;
});

// --- Test Data ---

// FIX: Ensure mock data aligns strictly with FormsProps types
const mockForm: FormsProps = {
  _id: "form-123",
  name: "Test Form",
  description: "A test form",
  category: "Custom",
  status: "Draft",
  usage: "Internal",
  services: ["Service A"],
  species: ["Dog"],
  schema: [
    { id: "f1", type: "input", label: "Field 1", placeholder: "Enter text" },
    {
      id: "f2",
      type: "checkbox",
      label: "Field 2",
      options: [{ label: "Option 1", value: "opt1" }],
    },
    { id: "f3", type: "boolean", label: "Field 3" },
    { id: "f4", type: "date", label: "Field 4" },
    { id: "f5", type: "number", label: "Field 5" },
    {
      id: "g1",
      type: "group",
      label: "Group 1",
      fields: [{ id: "gf1", type: "input", label: "Group Field" }],
    },
  ],
  // FIX: Replaced createdAt/updatedAt/orgId with new required props
  updatedBy: "test-user-id",
  lastUpdated: "2023-01-01",
};

const mockServiceOptions = [{ label: "Service A", value: "Service A" }];
const mockOnEdit = jest.fn();
const mockSetShowModal = jest.fn();

describe("FormInfo Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Rendering Tests ---

  it("renders the modal when showModal is true", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("View form")).toBeInTheDocument();
  });

  it("renders nothing when showModal is false", () => {
    render(
      <FormInfo
        showModal={false}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders form details and usage accordions", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.getByText("Form details")).toBeInTheDocument();
    expect(screen.getByText("Usage & visibility")).toBeInTheDocument();
  });

  it("renders form preview when schema is present", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.getByText("Form preview")).toBeInTheDocument();
    expect(screen.getByTestId("form-renderer")).toBeInTheDocument();
  });

  it("does not render form preview if schema is empty", () => {
    // Cast to FormsProps because strict type checking might complain about missing fields if we use Partial
    const emptySchemaForm = { ...mockForm, schema: [] } as FormsProps;
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={emptySchemaForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.queryByText("Form preview")).not.toBeInTheDocument();
  });

  // --- buildPreviewValues Logic via Rendering ---
  it("correctly builds preview values for complex schema types", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.getByTestId("form-renderer")).toBeInTheDocument();
  });

  // --- Action Tests: Draft Status (Default) ---

  it("renders Publish and Archive buttons for Draft status", () => {
    const draftForm = { ...mockForm, status: "Draft" } as FormsProps;
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={draftForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.getByTestId("primary-btn-Publish")).toBeInTheDocument();
    expect(screen.getByTestId("secondary-btn-Archive")).toBeInTheDocument();
  });

  it("calls publishForm service on Publish click", async () => {
    const draftForm = { ...mockForm, status: "Draft" } as FormsProps;
    (formService.publishForm as jest.Mock).mockResolvedValue({});

    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={draftForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("primary-btn-Publish"));

    await waitFor(() =>
      expect(
        screen.getByTestId("primary-btn-Publishing...")
      ).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(formService.publishForm).toHaveBeenCalledWith("form-123")
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("primary-btn-Publishing...")
      ).not.toBeInTheDocument()
    );
  });

  it("calls archiveForm service on Archive click", async () => {
    const draftForm = { ...mockForm, status: "Draft" } as FormsProps;
    (formService.archiveForm as jest.Mock).mockResolvedValue({});

    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={draftForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("secondary-btn-Archive"));

    await waitFor(() =>
      expect(
        screen.getByTestId("secondary-btn-Archiving...")
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(formService.archiveForm).toHaveBeenCalledWith("form-123")
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("secondary-btn-Archiving...")
      ).not.toBeInTheDocument()
    );
  });

  // --- Action Tests: Published Status ---

  it("renders Unpublish and Archive buttons for Published status", () => {
    const publishedForm = { ...mockForm, status: "Published" } as FormsProps;
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={publishedForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(screen.getByTestId("secondary-btn-Unpublish")).toBeInTheDocument();
    expect(screen.getByTestId("secondary-btn-Archive")).toBeInTheDocument();
  });

  it("calls unpublishForm service on Unpublish click", async () => {
    const publishedForm = { ...mockForm, status: "Published" } as FormsProps;
    (formService.unpublishForm as jest.Mock).mockResolvedValue({});

    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={publishedForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("secondary-btn-Unpublish"));

    await waitFor(() =>
      expect(
        screen.getByTestId("secondary-btn-Unpublishing...")
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(formService.unpublishForm).toHaveBeenCalledWith("form-123")
    );
  });

  // --- Action Tests: Archived Status ---

  it("renders Move to draft and Publish buttons for Archived status", () => {
    const archivedForm = { ...mockForm, status: "Archived" } as FormsProps;
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={archivedForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );
    expect(
      screen.getByTestId("secondary-btn-Move to draft")
    ).toBeInTheDocument();
    expect(screen.getByTestId("primary-btn-Publish")).toBeInTheDocument();
  });

  it("calls unpublishForm (move to draft) on Move to draft click", async () => {
    const archivedForm = { ...mockForm, status: "Archived" } as FormsProps;
    (formService.unpublishForm as jest.Mock).mockResolvedValue({});

    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={archivedForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("secondary-btn-Move to draft"));

    await waitFor(() =>
      expect(screen.getByTestId("secondary-btn-Moving...")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(formService.unpublishForm).toHaveBeenCalledWith("form-123")
    );
  });

  // --- Other Interactions ---

  it("calls onEdit when Edit form button is clicked", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("secondary-btn-Edit form"));
    expect(mockOnEdit).toHaveBeenCalledWith(mockForm);
  });

  it("closes modal when close icon is clicked", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const closeIcons = screen.getAllByTestId("close-icon");
    fireEvent.click(closeIcons[1]);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("does not trigger actions if _id is missing", async () => {
    const noIdForm = { ...mockForm, _id: undefined } as FormsProps;
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={noIdForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const publishBtn = screen.getByTestId("primary-btn-Publish");
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(formService.publishForm).not.toHaveBeenCalled();
    });
  });
});
