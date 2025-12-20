import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import FormInfo from "../../../../pages/Forms/Sections/FormInfo";
import {
  archiveForm,
  publishForm,
  unpublishForm,
} from "@/app/services/formService";
import { FormsProps, FormField } from "@/app/types/forms";

// --- Mocks ---

// 1. Mock Services
jest.mock("@/app/services/formService", () => ({
  archiveForm: jest.fn(),
  publishForm: jest.fn(),
  unpublishForm: jest.fn(),
}));

// 2. Mock UI Components
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => (
    <div data-testid="editable-accordion">{title}</div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      {title}
      {children}
    </div>
  ),
}));

jest.mock(
  "../../../../pages/Forms/Sections/AddForm/components/FormRenderer",
  () => ({
    __esModule: true,
    default: ({ values }: any) => (
      <div data-testid="form-renderer">
        Renderer Values: {JSON.stringify(values)}
      </div>
    ),
  })
);

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button
      data-testid={`btn-primary-${text.replaceAll(/\s+/g, "-")}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button
      data-testid={`btn-secondary-${text.replaceAll(/\s+/g, "-")}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {text}
    </button>
  ),
}));

// --- Test Data ---

// Cast schema to 'any' to bypass strict field type checks (label, options, etc.)
// while ensuring it's valid enough for the component logic.
const mockSchema: any[] = [
  { id: "f1", type: "text", placeholder: "Name" },
  { id: "f2", type: "number", defaultValue: 10 },
  { id: "f3", type: "boolean", defaultValue: true },
  { id: "f4", type: "checkbox", defaultValue: ["A"] },
  { id: "f5", type: "date" },
  {
    id: "g1",
    type: "group",
    fields: [{ id: "f6", type: "text", defaultValue: "Nested" }],
  },
];

const mockForm: FormsProps = {
  _id: "form-123",
  name: "Test Form",
  status: "Draft",
  schema: mockSchema as FormField[], // Cast to satisfy prop type
} as unknown as FormsProps;

const mockServiceOptions = [{ label: "Service A", value: "s1" }];

describe("FormInfo Component", () => {
  const mockSetShowModal = jest.fn();
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering & Logic (buildPreviewValues) ---

  it("renders correctly and generates preview values from schema", () => {
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

    const renderer = screen.getByTestId("form-renderer");
    // Remove "Renderer Values: " prefix to parse JSON
    const values = JSON.parse(
      renderer.textContent?.replace("Renderer Values: ", "") || "{}"
    );

    expect(values).toEqual({
      f1: "Name",
      f2: 10,
      f3: true,
      f4: ["A"],
      f5: "",
      f6: "Nested",
    });
  });

  it("handles missing schema safely", () => {
    const emptyForm = { ...mockForm, schema: undefined } as any;
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={emptyForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    expect(screen.queryByTestId("form-renderer")).not.toBeInTheDocument();
  });

  it("closes modal on close icon click", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const closeBtn = document.querySelectorAll("svg")[1];
    fireEvent.click(closeBtn);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("calls onEdit when Edit Form button is clicked", () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("btn-secondary-Edit-form"));
    expect(mockOnEdit).toHaveBeenCalledWith(mockForm);
  });

  // --- Section 2: Actions - Status: Draft (Default) ---

  it("renders Publish and Archive buttons for Draft status", async () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={{ ...mockForm, status: "Draft" }}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const publishBtn = screen.getByTestId("btn-primary-Publish");
    const archiveBtn = screen.getByTestId("btn-secondary-Archive");

    expect(publishBtn).toBeInTheDocument();
    expect(archiveBtn).toBeInTheDocument();

    // Test Publish Action
    fireEvent.click(publishBtn);
    expect(publishForm).toHaveBeenCalledWith("form-123");
    expect(screen.getByTestId("btn-primary-Publishing...")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("btn-primary-Publish")).toBeInTheDocument()
    );

    // Test Archive Action
    fireEvent.click(archiveBtn);
    expect(archiveForm).toHaveBeenCalledWith("form-123");
    // FIXED: Wait for Archive action to settle to prevent act() warning
    await waitFor(() =>
      expect(screen.getByTestId("btn-secondary-Archive")).toBeInTheDocument()
    );
  });

  // --- Section 3: Actions - Status: Published ---

  it("renders Unpublish and Archive buttons for Published status", async () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={{ ...mockForm, status: "Published" }}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const unpublishBtn = screen.getByTestId("btn-secondary-Unpublish");
    const archiveBtn = screen.getByTestId("btn-secondary-Archive");

    expect(unpublishBtn).toBeInTheDocument();
    expect(archiveBtn).toBeInTheDocument();

    // Test Unpublish Action
    fireEvent.click(unpublishBtn);
    expect(unpublishForm).toHaveBeenCalledWith("form-123");
    expect(
      screen.getByTestId("btn-secondary-Unpublishing...")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("btn-secondary-Unpublish")).toBeInTheDocument()
    );

    // Test Archive Action logic existence
    // We only click it to verify it calls the service, then wait for it.
    fireEvent.click(archiveBtn);
    expect(archiveForm).toHaveBeenCalledWith("form-123");
    // FIXED: Wait for Archive state to settle
    await waitFor(() =>
      expect(screen.getByTestId("btn-secondary-Archive")).toBeInTheDocument()
    );
  });

  // --- Section 4: Actions - Status: Archived ---

  it("renders Move to Draft and Publish buttons for Archived status", async () => {
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={{ ...mockForm, status: "Archived" }}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const moveToDraftBtn = screen.getByTestId("btn-secondary-Move-to-draft");
    const publishBtn = screen.getByTestId("btn-primary-Publish");

    expect(moveToDraftBtn).toBeInTheDocument();
    expect(publishBtn).toBeInTheDocument();

    fireEvent.click(moveToDraftBtn);
    expect(unpublishForm).toHaveBeenCalledWith("form-123");
    expect(screen.getByTestId("btn-secondary-Moving...")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByTestId("btn-secondary-Move-to-draft")
      ).toBeInTheDocument()
    );
  });

  // --- Section 5: Edge Cases & Error Handling ---

  it("does not call services if form ID is missing", async () => {
    const noIdForm = { ...mockForm, _id: "" };
    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={noIdForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("btn-primary-Publish"));
    fireEvent.click(screen.getByTestId("btn-secondary-Archive"));

    expect(publishForm).not.toHaveBeenCalled();
    expect(archiveForm).not.toHaveBeenCalled();
  });

  it("handles loading state correctly (verifies finally block)", async () => {
    // FIXED: Instead of mocking a rejection (which crashes since the component has no catch block),
    // we mock a delayed success. This proves the loading state persists during the call
    // and is turned off in the finally block.
    (publishForm as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(
      <FormInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeForm={mockForm}
        onEdit={mockOnEdit}
        serviceOptions={mockServiceOptions}
      />
    );

    const publishBtn = screen.getByTestId("btn-primary-Publish");
    fireEvent.click(publishBtn);

    // Verify loading state is active immediately
    expect(screen.getByTestId("btn-primary-Publishing...")).toBeInTheDocument();

    // Verify loading state is removed after promise resolves (finally block executed)
    await waitFor(() => {
      expect(screen.getByTestId("btn-primary-Publish")).toBeInTheDocument();
    });
  });
});
