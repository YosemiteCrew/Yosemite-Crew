import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddAppointment from "@/app/pages/Appointments/Sections/AddAppointment";

// --- Mocks ---

// 1. Mock the Modal to simply render children when open
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children, setShowModal }: any) =>
    showModal ? (
      <div data-testid="modal-container">
        {children}
        <button
          data-testid="modal-overlay-close"
          onClick={() => setShowModal(false)}
        >
          Overlay Close
        </button>
      </div>
    ) : null;
});

// 2. Mock Accordion to always render children
jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ title, children }: any) => (
    <div data-testid="accordion-item">
      <h3>{title}</h3>
      {children}
    </div>
  );
});

// 3. Mock Icons
// FIX 1 & 2: Use <button> instead of <div> for interactive elements (S6848, S1082)
jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick, className }: any) => (
    <button
      type="button"
      data-testid={onClick ? "close-icon-btn" : "close-icon-spacer"}
      onClick={onClick}
      className={className}
    >
      Icon
    </button>
  ),
}));

// 4. Mock Inputs & Dropdowns
// We safeguard onChange handlers to prevent "value without onChange" warnings from React

jest.mock("@/app/components/Inputs/SearchDropdown", () => {
  return ({ onSelect, placeholder, query, setQuery }: any) => (
    <div data-testid="search-dropdown">
      <input
        data-testid="search-input"
        placeholder={placeholder}
        value={query || ""}
        onChange={(e) => (setQuery ? setQuery(e.target.value) : jest.fn())}
      />
      <button
        type="button"
        data-testid="select-buddy"
        // FIX 3: Use optional chaining (S6582)
        onClick={() => onSelect?.("1")}
      >
        Select Buddy
      </button>
      <button
        type="button"
        data-testid="select-invalid"
        // FIX 4: Use optional chaining (S6582)
        onClick={() => onSelect?.("999")}
      >
        Select Invalid
      </button>
    </div>
  );
});

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, value, onChange, inname }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inname}`}
        value={value || ""}
        // Pass the event directly as the parent expects (e) => ...
        onChange={onChange || jest.fn()}
      />
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ placeholder, value, onChange }: any) => (
    <div>
      <label>{placeholder}</label>
      <input
        data-testid={`dropdown-${placeholder?.toLowerCase()}`}
        value={value || ""}
        // Dropdown usually passes the value directly, but our mock simulates an input event
        // The parent AddAppointment expects (val) => setFormData...
        // So we adapt the event to the value
        onChange={(e) => (onChange ? onChange(e.target.value) : jest.fn())}
      />
    </div>
  );
});

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => {
  return ({ placeholder, value, onChange }: any) => (
    <div>
      <label>{placeholder}</label>
      <input
        data-testid={`multi-${placeholder?.toLowerCase()}`}
        value={Array.isArray(value) ? value.join(",") : ""}
        // Simulate multi-select by splitting comma-separated values
        onChange={(e) =>
          onChange ? onChange(e.target.value.split(",")) : jest.fn()
        }
      />
    </div>
  );
});

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => {
  return ({ inlabel, value, onChange, inname }: any) => (
    <div>
      <label>{inlabel}</label>
      <textarea
        data-testid={`desc-${inname}`}
        value={value || ""}
        onChange={onChange || jest.fn()}
      />
    </div>
  );
});

jest.mock("@/app/components/Inputs/Slotpicker", () => {
  return ({
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
  }: any) => (
    <div data-testid="slotpicker">
      <span data-testid="display-date">{selectedDate.toString()}</span>
      <span data-testid="display-time">{selectedTime}</span>
      <button
        type="button"
        data-testid="set-date-btn"
        onClick={() => setSelectedDate(new Date("2025-12-25"))}
      >
        Set Xmas
      </button>
      <button
        type="button"
        data-testid="set-time-btn"
        onClick={() => setSelectedTime("10:00 AM")}
      >
        Set 10AM
      </button>
    </div>
  );
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

// 5. Mock Demo Data (Using absolute path alias)
jest.mock("@/app/pages/Appointments/demo", () => ({
  CompanionData: [
    {
      id: "1",
      companion: "Buddy",
      specie: "Dog",
      parent: "John Doe",
      breed: "Golden Retriever",
    },
  ],
  CompanionDataOptions: [{ id: "1", label: "Buddy" }],
}));

// 6. Mock Helpers
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: (date: Date) => date.toISOString().split("T")[0],
  getDayName: jest.fn(),
}));

describe("AddAppointment Component", () => {
  const mockSetShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Rendering Tests ---

  it("renders the modal when showModal is true", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);
    expect(screen.getByText("Add appointment")).toBeInTheDocument();
    expect(screen.getByText("Companion details")).toBeInTheDocument();
    expect(screen.getByText("Book appointment")).toBeInTheDocument();
  });

  it("does not render the modal content when showModal is false", () => {
    render(
      <AddAppointment showModal={false} setShowModal={mockSetShowModal} />
    );
    expect(screen.queryByText("Add appointment")).not.toBeInTheDocument();
  });

  // --- User Interaction Tests ---

  it("calls setShowModal(false) when the close icon is clicked", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);
    const closeBtn = screen.getByTestId("close-icon-btn");
    fireEvent.click(closeBtn);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("updates companion form fields when a companion is selected from SearchDropdown", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    // Trigger selection mock
    const selectBtn = screen.getByTestId("select-buddy");
    fireEvent.click(selectBtn);

    // Verify fields updated
    expect(screen.getByTestId("input-companion")).toHaveValue("Buddy");
    expect(screen.getByTestId("input-specie")).toHaveValue("Dog");
    expect(screen.getByTestId("input-parent")).toHaveValue("John Doe");
    expect(screen.getByTestId("input-breed")).toHaveValue("Golden Retriever");
  });

  it("does not update form fields if an invalid ID is selected", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    const invalidBtn = screen.getByTestId("select-invalid");
    fireEvent.click(invalidBtn);

    // Verify fields remain empty
    expect(screen.getByTestId("input-companion")).toHaveValue("");
  });

  it("allows manual entry into companion form fields", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    const companionInput = screen.getByTestId("input-companion");
    fireEvent.change(companionInput, { target: { value: "Max" } });
    expect(companionInput).toHaveValue("Max");

    const parentInput = screen.getByTestId("input-parent");
    fireEvent.change(parentInput, { target: { value: "Jane" } });
    expect(parentInput).toHaveValue("Jane");

    const specieInput = screen.getByTestId("input-specie");
    fireEvent.change(specieInput, { target: { value: "Cat" } });
    expect(specieInput).toHaveValue("Cat");

    const breedInput = screen.getByTestId("input-breed");
    fireEvent.change(breedInput, { target: { value: "Siamese" } });
    expect(breedInput).toHaveValue("Siamese");
  });

  it("updates appointment detail fields (Speciality, Service, Concern)", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    // Speciality (Mock Dropdown onChange receives string value directly)
    const specialityInput = screen.getByTestId("dropdown-speciality");
    fireEvent.change(specialityInput, { target: { value: "Cardiology" } });
    expect(specialityInput).toHaveValue("Cardiology");

    // Service
    const serviceInput = screen.getByTestId("dropdown-service");
    fireEvent.change(serviceInput, { target: { value: "Surgery" } });
    expect(serviceInput).toHaveValue("Surgery");

    // Concern (textarea - Mock FormDesc onChange receives event)
    const concernInput = screen.getByTestId("desc-Describe concern");
    fireEvent.change(concernInput, { target: { value: "Coughing" } });
    expect(concernInput).toHaveValue("Coughing");
  });

  it("updates date and time via Slotpicker and reflects in readonly inputs", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    // Interact with Mock Slotpicker
    const dateBtn = screen.getByTestId("set-date-btn");
    const timeBtn = screen.getByTestId("set-time-btn");

    fireEvent.click(dateBtn);
    fireEvent.click(timeBtn);

    // Check display within slot picker
    expect(screen.getByTestId("display-time")).toHaveTextContent("10:00 AM");

    // Check that the form inputs (which display the selected data) are updated
    // getFormattedDate mock returns YYYY-MM-DD
    expect(screen.getByTestId("input-date")).toHaveValue("2025-12-25");
    expect(screen.getByTestId("input-time")).toHaveValue("10:00 AM");
  });

  it("updates staff details (Lead, Support)", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    // Lead
    const leadInput = screen.getByTestId("dropdown-lead");
    fireEvent.change(leadInput, { target: { value: "Dr.Smith" } });
    expect(leadInput).toHaveValue("Dr.Smith");

    // Support (MultiSelect mock receives string, splits by comma)
    const supportInput = screen.getByTestId("multi-support");
    fireEvent.change(supportInput, { target: { value: "NurseA,NurseB" } });
    // Check that state updated correctly (input value reads back from state.join(','))
    expect(supportInput).toHaveValue("NurseA,NurseB");
  });

  it("toggles the emergency checkbox", () => {
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("updates the search query state in SearchDropdown", () => {
    // This covers the setQuery passed to SearchDropdown
    render(<AddAppointment showModal={true} setShowModal={mockSetShowModal} />);
    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Searching..." } });
    expect(searchInput).toHaveValue("Searching...");
  });
});
