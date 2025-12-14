import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Companion from "@/app/components/AddCompanion/Sections/Companion";
import {
  createCompanion,
  createParent,
  getCompanionForParent,
} from "@/app/services/companionService";
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from "@/app/components/AddCompanion/type";

// --- Mocks ---

// Mock the Service calls
jest.mock("@/app/services/companionService", () => ({
  createCompanion: jest.fn(),
  createParent: jest.fn(),
  linkCompanion: jest.fn(),
  getCompanionForParent: jest.fn(() => Promise.resolve([])),
}));

// Mock Complex UI Components
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, onChange, value, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        value={value}
        onChange={onChange}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ placeholder, onChange, value, error }: any) => (
    <div>
      <label>{placeholder}</label>
      <select
        data-testid={`dropdown-${placeholder}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select</option>
        <option value="Dog">Dog</option>
        <option value="Cat">Cat</option>
        <option value="Golden Retriever">Golden Retriever</option>
      </select>
      {error && <span role="alert">{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Datepicker", () => {
  return ({ placeholder }: any) => (
    <div data-testid="datepicker">{placeholder}</div>
  );
});

jest.mock("@/app/components/Inputs/SearchDropdown", () => {
  return ({ placeholder }: any) => (
    <div data-testid="search-dropdown">{placeholder}</div>
  );
});

jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ children, title }: any) => (
    <div data-testid="accordion">
      <h2>{title}</h2>
      {children}
    </div>
  );
});

// --- Test Suite ---

describe("Companion Component", () => {
  const mockSetActiveLabel = jest.fn();
  const mockSetFormData = jest.fn();
  const mockSetParentFormData = jest.fn();
  const mockSetShowModal = jest.fn();

  const defaultProps = {
    setActiveLabel: mockSetActiveLabel,
    formData: EMPTY_STORED_COMPANION,
    setFormData: mockSetFormData,
    parentFormData: EMPTY_STORED_PARENT,
    setParentFormData: mockSetParentFormData,
    setShowModal: mockSetShowModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the companion form correctly", () => {
    render(<Companion {...defaultProps} />);

    // Use getAllByText because "Companion information" appears in the Header AND the Accordion
    expect(screen.getAllByText("Companion information").length).toBeGreaterThan(
      0
    );

    expect(screen.getByTestId("input-Name")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Species")).toBeInTheDocument();
  });

  it("shows validation errors when saving with empty required fields", async () => {
    // Explicitly set empty values to ensure validation fails
    const emptyProps = {
      ...defaultProps,
      formData: {
        ...EMPTY_STORED_COMPANION,
        name: "",
        type: "" as any,
        breed: "",
        isInsured: false,
      },
    };

    render(<Companion {...emptyProps} />);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(screen.getByText("Species is required")).toBeInTheDocument();
      expect(screen.getByText("Breed is required")).toBeInTheDocument();
    });

    expect(createParent).not.toHaveBeenCalled();
  });

  it("calls setActiveLabel('parents') when Back button is clicked", () => {
    render(<Companion {...defaultProps} />);

    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);

    expect(mockSetActiveLabel).toHaveBeenCalledWith("parents");
  });

  it("updates form data when inputs change", () => {
    render(<Companion {...defaultProps} />);

    const nameInput = screen.getByTestId("input-Name");
    fireEvent.change(nameInput, { target: { value: "Buddy" } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Buddy",
      })
    );
  });

  it("successfully submits the form when valid data is provided (New Parent)", async () => {
    (createParent as jest.Mock).mockResolvedValue("new-parent-id-123");
    (createCompanion as jest.Mock).mockResolvedValue("new-companion-id-456");

    const filledProps = {
      ...defaultProps,
      formData: {
        ...EMPTY_STORED_COMPANION,
        name: "Buddy",
        type: "Dog" as any,
        breed: "Golden Retriever",
      },
    };

    render(<Companion {...filledProps} />);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createParent).toHaveBeenCalled();
      expect(createCompanion).toHaveBeenCalled();
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("fetches existing companions if parentId exists", async () => {
    const parentProps = {
      ...defaultProps,
      parentFormData: { ...EMPTY_STORED_PARENT, id: "existing-parent-id" },
    };

    render(<Companion {...parentProps} />);

    await waitFor(() => {
      expect(getCompanionForParent).toHaveBeenCalledWith("existing-parent-id");
    });
  });
});
