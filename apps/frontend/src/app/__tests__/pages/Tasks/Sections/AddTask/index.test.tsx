import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddTask from "@/app/pages/Tasks/Sections/AddTask/index";

// --- Mocks ---

// Mock Modal to control visibility and children rendering
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children, setShowModal }: any) =>
    showModal ? (
      <div data-testid="mock-modal">
        <button
          data-testid="modal-close-btn"
          onClick={() => setShowModal(false)}
        >
          Close
        </button>
        {children}
      </div>
    ) : null;
});

// Mock Accordion to simply render children
jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ children, title }: any) => (
    <div data-testid="mock-accordion">
      <h2>{title}</h2>
      {children}
    </div>
  );
});

// Mock Dropdown to simulate selection
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ placeholder, value, onChange, options }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`dropdown-val-${placeholder}`}>{value}</span>
      <select
        data-testid={`select-${placeholder}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select</option>
        {options?.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
});

// Mock FormInput
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inname, value, onChange, inlabel }: any) => (
    <div>
      <label htmlFor={inname}>{inlabel}</label>
      <input
        data-testid={`input-${inname}`}
        id={inname}
        value={value}
        onChange={onChange}
      />
    </div>
  );
});

// Mock FormDesc (Textarea)
jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => {
  return ({ inname, value, onChange, inlabel }: any) => (
    <div>
      <label htmlFor={inname}>{inlabel}</label>
      <textarea
        data-testid={`input-${inname}`}
        id={inname}
        value={value}
        onChange={onChange}
      />
    </div>
  );
});

// Mock Datepicker
jest.mock("@/app/components/Inputs/Datepicker", () => {
  return ({ currentDate, setCurrentDate, placeholder }: any) => (
    <div data-testid={`datepicker-${placeholder}`}>
      <span>
        {currentDate ? new Date(currentDate).toISOString() : "No Date"}
      </span>
      <button
        data-testid="date-btn"
        onClick={() => setCurrentDate(new Date("2025-01-01"))}
      >
        Pick Date
      </button>
    </div>
  );
});

// Mock Buttons
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button>{text}</button>,
  Secondary: ({ text }: any) => <button>{text}</button>,
}));

// Mock Icons
jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick, className }: any) => (
    <div data-testid="icon-close" onClick={onClick} className={className}>
      Icon
    </div>
  ),
}));

// Mock Data Source
jest.mock("@/app/components/CompanionInfo/Sections/AddAppointment", () => ({
  LeadOptions: ["Lead 1", "Lead 2"],
}));

describe("AddTask Component", () => {
  const mockSetShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when showModal is false", () => {
    render(<AddTask showModal={false} setShowModal={mockSetShowModal} />);
    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();
  });

  it("renders correctly when showModal is true", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);
    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();

    // Fix: "Add task" appears twice (Header + Accordion Title)
    const titles = screen.getAllByText("Add task");
    expect(titles.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByTestId("mock-accordion")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Save as template")).toBeInTheDocument();
  });

  it("closes modal when clicking the top right close icon", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const icons = screen.getAllByTestId("icon-close");
    // The second icon is the visible clickable one
    fireEvent.click(icons[1]);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("updates category dropdown", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const select = screen.getByTestId("select-Category");
    fireEvent.change(select, { target: { value: "Template" } });

    expect(screen.getByTestId("dropdown-val-Category")).toHaveTextContent(
      "Template"
    );
  });

  it("updates task input field", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const input = screen.getByTestId("input-task");
    fireEvent.change(input, { target: { value: "New Task Name" } });

    expect(input).toHaveValue("New Task Name");
  });

  it("updates description input field", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const textarea = screen.getByTestId("input-description");
    fireEvent.change(textarea, { target: { value: "Some details" } });

    expect(textarea).toHaveValue("Some details");
  });

  it("updates 'From' dropdown", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const select = screen.getByTestId("select-From");
    fireEvent.change(select, { target: { value: "Lead 1" } });

    expect(screen.getByTestId("dropdown-val-From")).toHaveTextContent("Lead 1");
  });

  it("updates 'To' dropdown", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const select = screen.getByTestId("select-To");
    fireEvent.change(select, { target: { value: "Lead 2" } });

    expect(screen.getByTestId("dropdown-val-To")).toHaveTextContent("Lead 2");
  });

  it("updates 'Due date' via datepicker", () => {
    render(<AddTask showModal={true} setShowModal={mockSetShowModal} />);

    const pickDateBtn = screen.getByTestId("date-btn");
    fireEvent.click(pickDateBtn);

    const display = screen.getByTestId("datepicker-Due date");
    expect(display).toHaveTextContent("2025");
  });
});
