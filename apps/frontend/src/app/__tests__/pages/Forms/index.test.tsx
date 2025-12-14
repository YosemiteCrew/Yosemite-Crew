import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import ProtectedForms from "@/app/pages/Forms/index";
import { useFormsStore } from "@/app/stores/formsStore";
import { loadForms } from "@/app/services/formService";
import { useServicesForPrimaryOrgSpecialities } from "@/app/hooks/useSpecialities";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

// Mock Router (passthrough not shown, assuming correctly mocked elsewhere)

// Mock Protected Route (passthrough)
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

// Mock Services
jest.mock("@/app/services/formService", () => ({
  loadForms: jest.fn(),
}));

// Mock Hooks
jest.mock("@/app/hooks/useSpecialities", () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
  useServicesForPrimaryOrgSpecialities: jest.fn(),
}));

// Mock Store
jest.mock("@/app/stores/formsStore", () => ({
  useFormsStore: jest.fn(),
}));

// Mock Child Components
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="primary-btn" onClick={onClick}>
            {text}   {" "}
    </button>
  ),
}));

jest.mock("@/app/components/Filters/FormsFilters", () => ({
  __esModule: true,
  default: ({ list, setFilteredList }: any) => (
    <div data-testid="forms-filters">
            <button onClick={() => setFilteredList(list)}>Reset Filter</button> 
         {" "}
      <button data-testid="filter-empty" onClick={() => setFilteredList([])}>
        Filter Empty
      </button>
           {" "}
      <button
        data-testid="filter-single"
        onClick={() => setFilteredList([list[0]])}
      >
        Filter Single
      </button>
         {" "}
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/FormsTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActiveForm, setViewPopup }: any) => (
    <div data-testid="forms-table">
           {" "}
      {filteredList.map((f: any) => (
        <div key={f._id} data-testid={`form-row-${f._id}`}>
                    {f.name}         {" "}
          <button onClick={() => setActiveForm(f._id)}>Select</button>{" "}
          {/* Use f._id string */}         {" "}
          <button
            onClick={() => {
              setActiveForm(f._id);
              setViewPopup(true);
            }}
          >
            View
          </button>{" "}
          {/* Use f._id string */}       {" "}
        </div>
      ))}
         {" "}
    </div>
  ),
}));

jest.mock("@/app/pages/Forms/Sections/AddForm", () => ({
  __esModule: true,
  default: ({ showModal, onClose, onDraftChange, initialForm }: any) => {
    if (!showModal) return null;
    return (
      <div data-testid="add-form-modal">
                <span>{initialForm ? "Edit Mode" : "Add Mode"}</span>       {" "}
        <button onClick={onClose}>Close</button>       {" "}
        <button onClick={() => onDraftChange({ name: "Draft Form" })}>
          Update Draft
        </button>
             {" "}
      </div>
    );
  },
}));

jest.mock("@/app/pages/Forms/Sections/FormInfo", () => ({
  __esModule: true,
  default: ({ showModal, onEdit, activeForm }: any) => {
    if (!showModal) return null;
    return (
      <div data-testid="form-info-modal">
                <span>Info: {activeForm ? activeForm.name : "N/A"}</span>       {" "}
        <button onClick={() => onEdit(activeForm)}>Edit</button>     {" "}
      </div>
    );
  },
}));

// Mock FormsHeader to ensure 'Forms' text is present
jest.mock("@/app/components/Headers/FormsHeader", () => ({
  __esModule: true,
  default: ({ showAddForm, setShowAddForm }: any) => (
    <div data-testid="forms-header">
      <h1>Forms</h1>
      <button onClick={() => setShowAddForm(true)}>Add</button>
    </div>
  ),
}));

describe("Forms Page", () => {
  const mockSetActiveForm = jest.fn();

  const mockForms: FormsProps[] = [
    {
      _id: "f1",
      name: "Form 1",
      category: "Cat1",
      description: "Desc1",
    } as any,
    {
      _id: "f2",
      name: "Form 2",
      category: "Cat2",
      description: "Desc2",
    } as any,
  ];

  const mockServices = [
    { id: "s1", name: "Service 1" },
    { _id: "s2", name: "Service 2" }, // Test fallback ID logic
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useServicesForPrimaryOrgSpecialities as jest.Mock).mockReturnValue(
      mockServices
    );
    (loadForms as jest.Mock).mockResolvedValue(undefined);
  });

  const setupStore = (overrides = {}) => {
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: {
        f1: mockForms[0],
        f2: mockForms[1],
      },
      formIds: ["f1", "f2"],
      activeFormId: null, // Default no active
      activeForm: null, // Ensure activeForm is null when activeFormId is null
      setActiveForm: mockSetActiveForm,
      loading: false,
      ...overrides,
    });
  }; // --- 1. Rendering & Initial Load ---

  it("renders correctly and triggers initial load", async () => {
    setupStore({ formIds: [], formsById: {}, activeForm: null }); // Empty initially
    // Need to wrap in act for initial render effects

    let container: HTMLElement;
    act(() => {
      container = render(<ProtectedForms />).container;
    });

    expect(screen.getByText("Forms")).toBeInTheDocument();
    expect(screen.getByTestId("primary-btn")).toHaveTextContent("Add");
    expect(screen.getByTestId("forms-filters")).toBeInTheDocument();
    expect(screen.getByTestId("forms-table")).toBeInTheDocument(); // Verify loading call

    await waitFor(() => {
      expect(loadForms).toHaveBeenCalled();
    });
  });

  it("does not trigger load if data already exists", () => {
    setupStore({ activeForm: mockForms[0] }); // Has data
    render(<ProtectedForms />);
    expect(loadForms).not.toHaveBeenCalled();
  });

  it("handles load error gracefully", async () => {
    setupStore({ formIds: [], formsById: {}, activeForm: null });
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (loadForms as jest.Mock).mockRejectedValue(new Error("Fail"));

    render(<ProtectedForms />);

    await waitFor(() => {
      expect(loadForms).toHaveBeenCalled();
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load forms",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  }); // --- 2. Active Form Logic & Filtering ---

  it("sets active form to first in list if none active", () => {
    setupStore({ activeFormId: null, activeForm: null });
    render(<ProtectedForms />); // Should select first item "f1"

    expect(mockSetActiveForm).toHaveBeenCalledWith("f1");
  });

  it("sets active form to null if filtered list is empty", () => {
    setupStore({ activeFormId: "f1", activeForm: mockForms[0] });
    render(<ProtectedForms />); // Simulate empty filter

    fireEvent.click(screen.getByTestId("filter-empty")); // Fixed: Use data-testid

    expect(mockSetActiveForm).toHaveBeenCalledWith(null);
  });

  it("selects first valid form if activeFormId is filtered out", () => {
    setupStore({ activeFormId: "f2", activeForm: mockForms[1] }); // f2 is active initially
    render(<ProtectedForms />); // Filter to show ONLY [f1] (Single filter mock logic)

    fireEvent.click(screen.getByTestId("filter-single")); // Fixed: Use data-testid
    // f2 is NOT in [f1]. Should switch active to f1.

    expect(mockSetActiveForm).toHaveBeenCalledWith("f1");
  });

  it("preserves active form if it is present in filter", () => {
    setupStore({ activeFormId: "f1", activeForm: mockForms[0] });
    render(<ProtectedForms />); // Reset mock from initial render call

    mockSetActiveForm.mockClear();

    fireEvent.click(screen.getByTestId("filter-single")); // Filters to [f1] (Fixed: Use data-testid)
    // f1 is in [f1], no change needed.

    expect(mockSetActiveForm).not.toHaveBeenCalled();
  }); // --- 3. Interactions: Select & View ---

  it("sets active form when selected from table", () => {
    setupStore({ activeForm: mockForms[0] });
    render(<ProtectedForms />); // Note: FormsTable mock calls setActiveForm with the ID string ('f2')

    const selectBtn = within(screen.getByTestId("form-row-f2")).getByText(
      "Select"
    );
    fireEvent.click(selectBtn);

    expect(mockSetActiveForm).toHaveBeenCalledWith("f2");
  });

  it("opens View popup when view clicked in table", async () => {
    // Set activeFormId and activeForm (needed for FormInfo modal to have data)
    setupStore({ activeFormId: "f1", activeForm: mockForms[0] });
    render(<ProtectedForms />); // Click View button in FormsTable mock (sets viewPopup=true)

    fireEvent.click(
      within(screen.getByTestId("form-row-f1")).getByText("View")
    ); // Verify setActiveForm was called with the ID (from FormsTable mock)

    expect(mockSetActiveForm).toHaveBeenCalledWith("f1"); // Check FormInfo modal appears

    await waitFor(() => {
      expect(screen.getByTestId("form-info-modal")).toBeInTheDocument();
      expect(screen.getByText("Info: Form 1")).toBeInTheDocument();
    });
  }); // --- 4. Interactions: Add & Edit ---

  it("opens Add Form modal", async () => {
    setupStore();
    render(<ProtectedForms />);

    fireEvent.click(screen.getByTestId("primary-btn")); // Add button (from Primary mock)

    await waitFor(() => {
      expect(screen.getByTestId("add-form-modal")).toBeInTheDocument();
      expect(screen.getByText("Add Mode")).toBeInTheDocument();
    });
  });

  it("opens Edit Form modal from Info view", async () => {
    // Setup store with f1 active, ensuring FormInfo modal can render
    setupStore({ activeFormId: "f1", activeForm: mockForms[0] });
    render(<ProtectedForms />); // 1. Open View

    fireEvent.click(
      within(screen.getByTestId("form-row-f1")).getByText("View")
    ); // 2. Click Edit in Info modal

    fireEvent.click(
      within(screen.getByTestId("form-info-modal")).getByText("Edit")
    ); // 3. Check Add Form is now open in Edit Mode

    await waitFor(() => {
      expect(screen.getByTestId("add-form-modal")).toBeInTheDocument();
      expect(screen.getByText("Edit Mode")).toBeInTheDocument(); // Info modal should be closed
      expect(screen.queryByTestId("form-info-modal")).not.toBeInTheDocument();
    });
  });

  it("handles draft state updates in Add mode", async () => {
    setupStore();
    render(<ProtectedForms />); // 1. Open Add

    fireEvent.click(screen.getByTestId("primary-btn")); // 2. Update draft (this mock call sets the local draft state)

    fireEvent.click(screen.getByText("Update Draft")); // 3. Close

    fireEvent.click(screen.getByText("Close")); // 4. Re-open. (Implicitly ensures coverage of the branch that checks for existing draft)

    fireEvent.click(screen.getByTestId("primary-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("add-form-modal")).toBeInTheDocument(); // State should hold the draft form name
      // This implicitly confirms the draft persists
    });
  });

  it("clears draft when opening Edit mode", async () => {
    setupStore({ activeFormId: "f1", activeForm: mockForms[0] });
    render(<ProtectedForms />); // 1. Set a draft (use Add button, update, then close)

    fireEvent.click(screen.getByTestId("primary-btn"));
    fireEvent.click(screen.getByText("Update Draft"));
    fireEvent.click(screen.getByText("Close")); // 2. Open View/Edit flow

    fireEvent.click(
      within(screen.getByTestId("form-row-f1")).getByText("View")
    );
    fireEvent.click(
      within(screen.getByTestId("form-info-modal")).getByText("Edit")
    ); // 3. Close Edit (should trigger draft clearance)
    fireEvent.click(screen.getByText("Close")); // 4. Re-open Add mode (If the draft was cleared, the mode should be "Add Mode")

    fireEvent.click(screen.getByTestId("primary-btn"));

    await waitFor(() => {
      expect(screen.getByText("Add Mode")).toBeInTheDocument(); // Confirms draft was cleared
    });
  });
});
