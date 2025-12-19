import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
// Import Path: Go up 6 levels to 'src/app', then down to 'pages'
import Documents from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Documents";

// --- Mocks ---

// Mock Accordion to render children immediately (simplifies traversing)
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <div className="title">{title}</div>
      <div className="content">{children}</div>
    </div>
  ),
}));

// Mock Dropdown
// Based on usage: onChange(e) where e is the value string
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ onChange, value, placeholder, options }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`current-${placeholder}`}>{value}</span>
      <select
        data-testid={`select-${placeholder}`}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {options?.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  ),
}));

// Mock FormInput
// Based on usage: onChange(e) where e is an event object
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel }: any) => (
    <input data-testid={`input-${inlabel}`} value={value} onChange={onChange} />
  ),
}));

// Mock Button
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button>{text}</button>,
}));

describe("Documents Prescription Section", () => {
  // --- Section 1: Rendering & Structure ---

  it("renders the main structure and recursive accordions", () => {
    render(<Documents />);

    // 1. Check Main Categories (Health, Hygiene)
    expect(screen.getByTestId("accordion-Health")).toBeInTheDocument();
    expect(
      screen.getByTestId("accordion-Hygiene maintenance")
    ).toBeInTheDocument();

    // 2. Check Nested Items (e.g., Hospital visits inside Health)
    // Since we mocked Accordion to always render children, these should be visible
    expect(screen.getByTestId("accordion-Hospital visits")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Grooming visits")).toBeInTheDocument();

    // 3. Check 'Upload records' section
    expect(screen.getByTestId("accordion-Upload records")).toBeInTheDocument();
  });

  // --- Section 2: Interactions (State Updates) ---

  it("updates the Category state when a dropdown option is selected", () => {
    render(<Documents />);

    const categorySelect = screen.getByTestId("select-Category");

    // Simulate selecting "Health"
    fireEvent.change(categorySelect, { target: { value: "Health" } });

    // Verify the value passed back to the component
    expect(screen.getByTestId("current-Category")).toHaveTextContent("Health");
  });

  it("updates the Sub-category state when selected", () => {
    render(<Documents />);

    // First select Category to ensure options might be populated (logically),
    // though our mock renders options if passed.
    const categorySelect = screen.getByTestId("select-Category");
    fireEvent.change(categorySelect, { target: { value: "Health" } });

    // Now select Sub-category
    const subSelect = screen.getByTestId("select-Sub-category");
    fireEvent.change(subSelect, { target: { value: "Hospital visits" } });

    expect(screen.getByTestId("current-Sub-category")).toHaveTextContent(
      "Hospital visits"
    );
  });

  it("updates the Name/Breed input state on typing", () => {
    render(<Documents />);

    const input = screen.getByTestId("input-Breed");

    // Simulate typing
    fireEvent.change(input, { target: { value: "Golden Retriever" } });

    expect(input).toHaveValue("Golden Retriever");
  });

  // --- Section 3: Conditional Logic (Options Mapping) ---

  it("dynamically populates sub-category options based on category selection", () => {
    render(<Documents />);

    const categorySelect = screen.getByTestId("select-Category");
    const subSelect = screen.getByTestId("select-Sub-category");

    // 1. Select "Health"
    fireEvent.change(categorySelect, { target: { value: "Health" } });

    // 2. Check if sub-category dropdown now contains "Hospital visits"
    // (Our mock renders options as <option> tags)
    expect(subSelect).toHaveTextContent("Hospital visits");
    expect(subSelect).toHaveTextContent("Prescriptions & treatments");
    expect(subSelect).not.toHaveTextContent("Grooming visits"); // Belongs to Hygiene

    // 3. Switch to "Hygiene maintenance"
    fireEvent.change(categorySelect, {
      target: { value: "Hygiene maintenance" },
    });

    // 4. Check if options updated
    expect(subSelect).toHaveTextContent("Grooming visits");
    expect(subSelect).not.toHaveTextContent("Hospital visits");
  });

  // --- Section 4: Edge Cases & Render Safety ---

  it("handles empty sub-category options gracefully if category is empty", () => {
    render(<Documents />);

    // Initially category is "", so DocumentsOptions[""] is undefined
    const subSelect = screen.getByTestId("select-Sub-category");

    // Should verify it rendered but has no dynamic options (only the default "Select..." from mock)
    // The component does `options={DocumentsOptions[formData.category]}`.
    // DocumentsOptions[""] is undefined.
    // Our mock handles `options?.map`, so undefined is safe.
    expect(subSelect.children.length).toBe(1); // Only the default "Select..." option
  });

  it("renders the Save button", () => {
    render(<Documents />);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
