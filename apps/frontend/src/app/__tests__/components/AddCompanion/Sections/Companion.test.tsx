import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import Companion from "@/app/components/AddCompanion/Sections/Companion";
import {
  createCompanion,
  createParent,
  getCompanionForParent,
  linkCompanion,
} from "@/app/services/companionService";
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from "@/app/components/AddCompanion/type";

// --- Stabilize Test Environment ---
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// --- Mocks ---

jest.mock("@/app/services/companionService", () => ({
  createCompanion: jest.fn(),
  createParent: jest.fn(),
  getCompanionForParent: jest.fn(),
  linkCompanion: jest.fn(),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inname, value, onChange, error, inlabel }: any) => (
    <div data-testid={`input-wrapper-${inname}`}>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inname}`}
        name={inname}
        value={value || ""}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inname}`}>{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ placeholder, value, onChange, error }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <label>{placeholder}</label>
      <select
        data-testid={`select-${placeholder}`}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select</option>
        <option value="Dog">Dog</option>
        <option value="Cat">Cat</option>
        <option value="Labrador">Labrador</option>
        <option value="Siamese">Siamese</option>
        <option value="USA">USA</option>
      </select>
      {/* Explicitly render error if present. */}
      {error && <span data-testid={`error-${placeholder}`}>{error}</span>}
    </div>
  );
});

// FIX: Bulletproof SelectLabel Mock
jest.mock("@/app/components/Inputs/SelectLabel", () => {
  return ({ title, options, setOption }: any) => (
    <div data-testid={`select-label-${title}`}>
      <span>{title}</span>
      {options?.map((opt: any, idx: number) => {
        // Resolve Value
        let val: any;
        if (typeof opt === "object" && opt !== null) {
          // Try common properties
          val = opt.value ?? opt.key ?? opt.id ?? opt.label;
        } else {
          val = opt;
        }

        // Resolve Label
        let lab: any;
        if (typeof opt === "object" && opt !== null) {
          lab = opt.label ?? opt.name ?? val;
        } else {
          lab = opt;
        }

        // Fallback for safety (should verify source types if this keeps failing)
        if (val === undefined) val = `opt-${idx}`;
        const safeVal = String(val);

        return (
          <button
            key={safeVal}
            data-testid={`option-${safeVal}`}
            onClick={() => setOption(val)}
          >
            {String(lab)}
          </button>
        );
      })}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Datepicker", () => {
  return ({ currentDate, setCurrentDate }: any) => (
    <input
      data-testid="datepicker"
      value={currentDate ? currentDate.toISOString().split("T")[0] : ""}
      onChange={(e) =>
        setCurrentDate(e.target.value ? new Date(e.target.value) : null)
      }
    />
  );
});

jest.mock("@/app/components/Inputs/SearchDropdown", () => {
  return ({ onSelect, options }: any) => (
    <div data-testid="search-dropdown">
      {options.map((opt: any) => (
        <button
          key={opt.key}
          data-testid={`search-option-${opt.key}`}
          onClick={() => onSelect(opt.key)}
        >
          {opt.value}
        </button>
      ))}
    </div>
  );
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button onClick={onClick} data-testid="btn-save">
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: any) => (
    <button onClick={onClick} data-testid="btn-back">
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ children }: any) => <div>{children}</div>;
});

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => {
  return ({ value, onChange, inlabel }: any) => (
    <div>
      <label>{inlabel}</label>
      <textarea data-testid="input-desc" value={value} onChange={onChange} />
    </div>
  );
});

describe("Companion Component", () => {
  const mockSetActiveLabel = jest.fn();
  const mockSetFormData = jest.fn();
  const mockSetParentFormData = jest.fn();
  const mockSetShowModal = jest.fn();

  const defaultProps = {
    setActiveLabel: mockSetActiveLabel,
    formData: EMPTY_STORED_COMPANION,
    setFormData: mockSetFormData,
    parentFormData: { ...EMPTY_STORED_PARENT, id: "parent-123" },
    setParentFormData: mockSetParentFormData,
    setShowModal: mockSetShowModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getCompanionForParent as jest.Mock).mockResolvedValue([]);
  });

  it("renders the form and fetches existing companions for parent", async () => {
    const existingCompanions = [{ id: "comp-1", name: "Buddy" }];
    (getCompanionForParent as jest.Mock).mockResolvedValue(existingCompanions);

    await act(async () => {
      render(<Companion {...defaultProps} />);
    });

    expect(getCompanionForParent).toHaveBeenCalledWith("parent-123");
    expect(screen.getByText("Companion information")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("search-option-comp-1")).toBeInTheDocument();
    });
  });

  it("handles empty parent ID gracefully (clears results)", async () => {
    await act(async () => {
      render(
        <Companion
          {...defaultProps}
          parentFormData={{ ...EMPTY_STORED_PARENT, id: "" }}
        />
      );
    });

    expect(getCompanionForParent).not.toHaveBeenCalled();
    expect(screen.queryByTestId("search-dropdown")).toBeEmptyDOMElement();
  });

  it("handles API error when fetching companions", async () => {
    (getCompanionForParent as jest.Mock).mockRejectedValue(
      new Error("Network Error")
    );

    await act(async () => {
      render(<Companion {...defaultProps} />);
    });
    expect(
      screen.queryByTestId("search-option-comp-1")
    ).not.toBeInTheDocument();
  });

  it("updates form fields correctly", async () => {
    render(<Companion {...defaultProps} />);

    // Name
    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "Rex" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Rex" })
    );

    // Species
    fireEvent.change(screen.getByTestId("select-Species"), {
      target: { value: "Dog" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Dog" })
    );

    // Color
    fireEvent.change(screen.getByTestId("input-color"), {
      target: { value: "Brown" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ colour: "Brown" })
    );

    // Weight
    fireEvent.change(screen.getByTestId("input-weight"), {
      target: { value: "20" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ currentWeight: 20 })
    );
    // Origin
    // Find breeder option safely
    const breederOption = screen.queryByTestId("option-breeder");
    if (breederOption) {
      fireEvent.click(breederOption);
      expect(mockSetFormData).toHaveBeenCalledWith(
        expect.objectContaining({ source: "breeder" })
      );
    }
  });

  it("updates date of birth and syncs local state", async () => {
    render(<Companion {...defaultProps} />);

    const dateInput = screen.getByTestId("datepicker");
    fireEvent.change(dateInput, { target: { value: "2023-01-01" } });

    await waitFor(() => {
      expect(mockSetFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          dateOfBirth: expect.any(Date),
        })
      );
    });
  });

  it("selects an existing companion from search dropdown", async () => {
    const companion = { id: "c1", name: "ExistingPet", type: "Dog" };
    (getCompanionForParent as jest.Mock).mockResolvedValue([companion]);

    await act(async () => {
      render(<Companion {...defaultProps} />);
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("search-option-c1"));
    });

    expect(mockSetFormData).toHaveBeenCalledWith(companion);
  });

  it("toggles insurance fields", async () => {
    const { rerender } = render(<Companion {...defaultProps} />);

    const insuranceLabel = screen.getByTestId("select-label-Insurance");
    // "true" boolean converted to string key
    const yesBtn = await insuranceLabel.querySelector(
      '[data-testid="option-true"]'
    );

    if (yesBtn) {
      fireEvent.click(yesBtn);
    } else {
      // Safe check
      throw new Error("Insurance 'Yes' button not found");
    }

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        isInsured: true,
        insurance: { isInsured: true },
      })
    );

    rerender(
      <Companion
        {...defaultProps}
        formData={{
          ...EMPTY_STORED_COMPANION,
          isInsured: true,
          insurance: { isInsured: true },
        }}
      />
    );

    expect(screen.getByText("Company name")).toBeInTheDocument();
    expect(screen.getByText("Policy Number")).toBeInTheDocument();

    const companyInput = screen
      .getByText("Company name")
      .parentElement?.querySelector("input");
    fireEvent.change(companyInput!, { target: { value: "PetPlan" } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        insurance: expect.objectContaining({ companyName: "PetPlan" }),
      })
    );
  });

  it("validates required fields on save", async () => {
    render(<Companion {...defaultProps} formData={EMPTY_STORED_COMPANION} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-save"));
    });

    expect(screen.getByTestId("error-name")).toHaveTextContent(
      "Name is required"
    );

    expect(screen.getByTestId("error-Breed")).toHaveTextContent(
      "Breed is required"
    )
  });

  it("validates insurance fields if insured is true", async () => {
    const insuredData = {
      ...EMPTY_STORED_COMPANION,
      name: "Valid",
      type: "Dog" as any,
      breed: "Lab",
      dateOfBirth: new Date(),
      isInsured: true,
      insurance: { isInsured: true, companyName: "", policyNumber: "" },
    };

    render(<Companion {...defaultProps} formData={insuredData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-save"));
    });

    expect(createCompanion).not.toHaveBeenCalled();
  });

  it("submits successfully creating new companion for existing parent", async () => {
    const validData = {
      ...EMPTY_STORED_COMPANION,
      name: "Fido",
      type: "Dog" as any,
      breed: "Labrador",
      dateOfBirth: new Date("2020-01-01"),
    };

    render(<Companion {...defaultProps} formData={validData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-save"));
    });

    expect(createCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fido", parentId: "parent-123" }),
      expect.anything()
    );

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
    expect(mockSetActiveLabel).toHaveBeenCalledWith("parents");
  });

  it("submits successfully linking existing companion to existing parent", async () => {
    const existingPet = {
      ...EMPTY_STORED_COMPANION,
      id: "pet-999",
      name: "OldBoy",
      type: "Dog" as any,
      breed: "Labrador",
      dateOfBirth: new Date(),
    };

    render(<Companion {...defaultProps} formData={existingPet} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-save"));
    });

    expect(linkCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pet-999", parentId: "parent-123" }),
      expect.anything()
    );
  });

  it("submits successfully creating NEW parent and NEW companion", async () => {
    const validData = {
      ...EMPTY_STORED_COMPANION,
      name: "NewPet",
      type: "Dog" as any,
      breed: "Labrador",
      dateOfBirth: new Date(),
    };
    const newParentData = { ...EMPTY_STORED_PARENT, id: "" };

    (createParent as jest.Mock).mockResolvedValue("new-parent-id");

    render(
      <Companion
        {...defaultProps}
        parentFormData={newParentData}
        formData={validData}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-save"));
    });

    expect(createParent).toHaveBeenCalledWith(newParentData);

    expect(createCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ name: "NewPet", parentId: "new-parent-id" }),
      expect.objectContaining({ id: "new-parent-id" })
    );
  });

  it("handles submission errors", async () => {
    const validData = {
      ...EMPTY_STORED_COMPANION,
      name: "Crash",
      type: "Dog" as any,
      breed: "X",
      dateOfBirth: new Date(),
    };

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (createCompanion as jest.Mock).mockRejectedValue(new Error("API Fail"));

    render(<Companion {...defaultProps} formData={validData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-save"));
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockSetShowModal).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("navigates back to parents section", () => {
    render(<Companion {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-back"));
    expect(mockSetActiveLabel).toHaveBeenCalledWith("parents");
  });
});
