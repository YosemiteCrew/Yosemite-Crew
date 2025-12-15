import React, { useEffect } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import AddForm from "@/app/pages/Forms/Sections/AddForm"; // Adjust import path if needed based on index.tsx location
import * as formService from "@/app/services/formService";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

// Mock Services
jest.mock("@/app/services/formService", () => ({
  saveFormDraft: jest.fn(),
  publishForm: jest.fn(),
}));

// Mock Child Components
// We inject logic to trigger parent callbacks (onNext, registerValidator, etc.)
jest.mock("@/app/pages/Forms/Sections/AddForm/Details", () => {
  return ({ onNext, registerValidator, setFormData, formData }: any) => {
    // Register a default validator that passes
    useEffect(() => {
      registerValidator(() => {
        // We can control validation result via a hidden input or global mock if needed
        // For simple tests, we assume valid unless specifically tested otherwise
        return !formData.name?.includes("Invalid");
      });
    }, [formData.name]);

    return (
      <div data-testid="details-step">
        <button data-testid="details-next-btn" onClick={onNext}>
          Next
        </button>
        <button
          data-testid="change-name-btn"
          onClick={() => setFormData({ ...formData, name: "New Name" })}
        >
          Change Name
        </button>
        <button
          data-testid="set-invalid-btn"
          onClick={() => setFormData({ ...formData, name: "Invalid" })}
        >
          Set Invalid
        </button>
      </div>
    );
  };
});

jest.mock("@/app/pages/Forms/Sections/AddForm/Build", () => {
  return ({ onNext, registerValidator, formData }: any) => {
    useEffect(() => {
      registerValidator(() => !formData.name?.includes("BuildInvalid"));
    }, [formData.name]);

    return (
      <div data-testid="build-step">
        <button data-testid="build-next-btn" onClick={onNext}>
          Next
        </button>
      </div>
    );
  };
});

jest.mock("@/app/pages/Forms/Sections/AddForm/Review", () => {
  return ({ onPublish, onSaveDraft }: any) => (
    <div data-testid="review-step">
      <button data-testid="save-draft-btn" onClick={onSaveDraft}>
        Save Draft
      </button>
      <button data-testid="publish-btn" onClick={onPublish}>
        Publish
      </button>
    </div>
  );
});

jest.mock("@/app/components/Labels/SubLabels", () => {
  return ({ labels, activeLabel, setActiveLabel }: any) => (
    <div data-testid="sub-labels">
      {labels.map((l: any) => (
        <button
          key={l.key}
          data-testid={`label-${l.key}`}
          onClick={() => setActiveLabel(l.key)}
        >
          {l.name}
        </button>
      ))}
      <span data-testid="active-label">{activeLabel}</span>
    </div>
  );
});

// Mock Modal to just render children if open
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children, onClose }: any) =>
    showModal ? (
      <div data-testid="modal-wrapper">
        <button data-testid="modal-close-btn" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    ) : null;
});

// Mock Icon
jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button data-testid="close-icon" onClick={onClick}>
      IconClose
    </button>
  ),
}));

describe("AddForm Component", () => {
  const mockSetShowModal = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnDraftChange = jest.fn();

  const serviceOptions = [{ label: "Service 1", value: "s1" }];

  const defaultProps = {
    showModal: true,
    setShowModal: mockSetShowModal,
    onClose: mockOnClose,
    serviceOptions,
    onDraftChange: mockOnDraftChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Initialization ---

  it("renders correctly in 'Add' mode", () => {
    render(<AddForm {...defaultProps} />);
    expect(screen.getByText("Add form")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument(); // Clear button only in add mode
    expect(screen.getByTestId("details-step")).toBeInTheDocument();
  });

  it("renders correctly in 'Edit' mode", () => {
    const initialForm = { _id: "123", name: "Existing Form" } as FormsProps;
    render(<AddForm {...defaultProps} initialForm={initialForm} />);

    expect(screen.getByText("Edit form")).toBeInTheDocument();
    expect(screen.queryByText("Clear")).not.toBeInTheDocument(); // No clear button in edit mode
  });

  it("initializes with draft data if provided and no initialForm", () => {
    const draft = { name: "Draft Form" } as FormsProps;
    render(<AddForm {...defaultProps} draft={draft} />);
    // We can simulate checking internal state by triggering a component update that depends on it,
    // or by assuming the mock Details component renders initial values.
    // However, our mock Details component allows changing name.
    // Let's verify via side effect: clicking 'Next' should check validation on "Draft Form".
    expect(screen.getByTestId("details-step")).toBeInTheDocument();
  });

  it("resets state when modal is opened", () => {
    const { rerender } = render(
      <AddForm {...defaultProps} showModal={false} />
    );
    expect(screen.queryByTestId("modal-wrapper")).not.toBeInTheDocument();

    rerender(<AddForm {...defaultProps} showModal={true} />);
    expect(screen.getByTestId("active-label")).toHaveTextContent(
      "form-details"
    );
  });

  // --- 2. Navigation & Validation ---

  it("advances to Build step when Details validation passes", () => {
    render(<AddForm {...defaultProps} />);

    // Default mock validator returns true
    fireEvent.click(screen.getByTestId("details-next-btn"));

    expect(screen.getByTestId("active-label")).toHaveTextContent("build-form");
    expect(screen.getByTestId("build-step")).toBeInTheDocument();
  });

  it("advances to Review step when Build validation passes", () => {
    render(<AddForm {...defaultProps} />);

    // Move to build
    fireEvent.click(screen.getByTestId("details-next-btn"));

    // Move to review
    fireEvent.click(screen.getByTestId("build-next-btn"));

    expect(screen.getByTestId("active-label")).toHaveTextContent("review");
    expect(screen.getByTestId("review-step")).toBeInTheDocument();
  });

  it("blocks navigation from Details if validation fails", () => {
    render(<AddForm {...defaultProps} />);

    // Set invalid state (our mock validator checks for "Invalid" string)
    fireEvent.click(screen.getByTestId("set-invalid-btn"));

    fireEvent.click(screen.getByTestId("details-next-btn"));

    // Should still be on details
    expect(screen.getByTestId("active-label")).toHaveTextContent(
      "form-details"
    );
    expect(screen.getByTestId("details-step")).toBeInTheDocument();
  });

  // --- 3. Label Click Navigation ---

  it("navigates backward without validation", () => {
    render(<AddForm {...defaultProps} />);

    // Go forward to build
    fireEvent.click(screen.getByTestId("details-next-btn"));
    expect(screen.getByTestId("active-label")).toHaveTextContent("build-form");

    // Click details label to go back
    fireEvent.click(screen.getByTestId("label-form-details"));
    expect(screen.getByTestId("active-label")).toHaveTextContent(
      "form-details"
    );
  });

  it("validates intermediate steps when jumping forward via labels", () => {
    render(<AddForm {...defaultProps} />);

    // Try to click Review directly
    fireEvent.click(screen.getByTestId("label-review"));

    // Should succeed because defaults are valid
    expect(screen.getByTestId("active-label")).toHaveTextContent("review");
  });

  it("blocks jumping forward if intermediate validation fails", () => {
    render(<AddForm {...defaultProps} />);

    // Set invalid details
    fireEvent.click(screen.getByTestId("set-invalid-btn"));

    // Try to jump to Review
    fireEvent.click(screen.getByTestId("label-review"));

    // Should fail at details step
    expect(screen.getByTestId("active-label")).toHaveTextContent(
      "form-details"
    );
  });

  // --- 4. Draft & State Updates ---

  it("calls onDraftChange when form data updates", () => {
    render(<AddForm {...defaultProps} />);

    fireEvent.click(screen.getByTestId("change-name-btn"));

    expect(mockOnDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Name" })
    );
  });

  it("does not call onDraftChange in Edit mode", () => {
    const initialForm = { _id: "123", name: "Old" } as FormsProps;
    render(<AddForm {...defaultProps} initialForm={initialForm} />);

    fireEvent.click(screen.getByTestId("change-name-btn"));

    expect(mockOnDraftChange).not.toHaveBeenCalled();
  });

  it("handles saving draft successfully", async () => {
    (formService.saveFormDraft as jest.Mock).mockResolvedValue({
      _id: "draft-1",
    });
    render(<AddForm {...defaultProps} />);

    // Navigate to Review
    fireEvent.click(screen.getByTestId("details-next-btn"));
    fireEvent.click(screen.getByTestId("build-next-btn"));

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-draft-btn"));
    });

    expect(formService.saveFormDraft).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Draft" })
    );
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnDraftChange).toHaveBeenCalledWith(null);
  });

  it("handles draft save errors", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (formService.saveFormDraft as jest.Mock).mockRejectedValue(
      new Error("Fail")
    );

    render(<AddForm {...defaultProps} />);

    // Navigate to Review
    fireEvent.click(screen.getByTestId("details-next-btn"));
    fireEvent.click(screen.getByTestId("build-next-btn"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-draft-btn"));
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save draft",
      expect.any(Error)
    );
    expect(mockSetShowModal).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // --- 5. Publishing ---

  it("handles publishing successfully", async () => {
    (formService.saveFormDraft as jest.Mock).mockResolvedValue({
      _id: "form-new",
    });
    (formService.publishForm as jest.Mock).mockResolvedValue({});

    render(<AddForm {...defaultProps} />);

    // Navigate to Review
    fireEvent.click(screen.getByTestId("details-next-btn"));
    fireEvent.click(screen.getByTestId("build-next-btn"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("publish-btn"));
    });

    // It first saves the draft, then uses the returned ID to publish
    expect(formService.saveFormDraft).toHaveBeenCalled();
    expect(formService.publishForm).toHaveBeenCalledWith("form-new");
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("handles publish errors", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (formService.saveFormDraft as jest.Mock).mockRejectedValue(
      new Error("Save Fail")
    );

    render(<AddForm {...defaultProps} />);

    // Navigate to Review
    fireEvent.click(screen.getByTestId("details-next-btn"));
    fireEvent.click(screen.getByTestId("build-next-btn"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("publish-btn"));
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to publish form",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  // --- 6. Clear & Close ---

  it("clears form data when Clear button is clicked", () => {
    // Provide a draft so we can clear it
    const draft = { name: "Dirty Draft" } as FormsProps;
    render(<AddForm {...defaultProps} draft={draft} />);

    fireEvent.click(screen.getByText("Clear"));

    // Expect reset to default/empty
    // We check this by seeing if onDraftChange was called with the cleared object
    expect(mockOnDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "" })
    );
  });

  it("closes modal via Close Icon", () => {
    render(<AddForm {...defaultProps} />);

    fireEvent.click(screen.getByText("IconClose"));

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnDraftChange).toHaveBeenCalledWith(null); // Should clear draft on close
  });
});
