import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionInfo from "@/app/components/CompanionInfo/index";
import { isHttpsImageUrl } from "@/app/utils/urls";

// --- Mocks ---

// Mock Modal
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children, setShowModal }: any) =>
    showModal ? (
      <div data-testid="mock-modal">
        <button data-testid="close-modal" onClick={() => setShowModal(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null;
});

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt} />
  ),
}));

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoEye: () => <span>IconEye</span>,
  IoDocumentTextSharp: () => <span>IconDoc</span>,
}));
jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button data-testid="icon-close" onClick={onClick} />
  ),
}));

// Mock Utils
jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn(),
}));

// Mock Labels Component
jest.mock("@/app/components/Labels/Labels", () => {
  return ({
    labels,
    activeLabel,
    setActiveLabel,
    activeSubLabel,
    setActiveSubLabel,
  }: any) => (
    <div data-testid="mock-labels">
      <div data-testid="active-label">{activeLabel}</div>
      <div data-testid="active-sublabel">{activeSubLabel}</div>
      {labels.map((l: any) => (
        <button
          key={l.key}
          data-testid={`tab-${l.key}`}
          onClick={() => setActiveLabel(l.key)}
        >
          {l.name}
        </button>
      ))}
      <button
        data-testid="switch-sub-parent"
        onClick={() => setActiveSubLabel("parent-information")}
      >
        Parent Info
      </button>
      <button
        data-testid="switch-sub-docs"
        onClick={() => setActiveSubLabel("documents")}
      >
        Documents
      </button>
    </div>
  );
});

// Mock Section Components
jest.mock("@/app/components/CompanionInfo/Sections", () => ({
  Companion: () => (
    <div data-testid="section-companion">Companion Component</div>
  ),
  Parent: () => <div data-testid="section-parent">Parent Component</div>,
  Core: () => <div data-testid="section-core">Core Component</div>,
  History: () => <div data-testid="section-history">History Component</div>,
  Documents: () => (
    <div data-testid="section-documents">Documents Component</div>
  ),
  AddAppointment: () => <div>Add Appointment</div>,
  AddTask: () => <div>Add Task</div>,
}));

describe("CompanionInfo Component", () => {
  const mockSetShowModal = jest.fn();
  const mockCompanion = {
    companion: {
      name: "Buddy",
      breed: "Golden Retriever",
      type: "Dog",
      photoUrl: "https://example.com/buddy.jpg",
    },
    parent: {
      name: "John",
      email: "john@test.com",
      phone: "123",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Fixed: Double cast to handle Type Guard signature incompatibility
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(true);
  });

  // --- 1. Rendering Section ---

  it("renders correctly when open", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Golden Retriever / Dog")).toBeInTheDocument();
  });

  it("renders default image if photoUrl is invalid", () => {
    // Fixed: Double cast
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(false);

    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    const img = screen.getByAltText("pet image");
    expect(img).toHaveAttribute(
      "src",
      "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
    );
  });

  it("renders provided image if photoUrl is valid", () => {
    // Fixed: Double cast
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(true);

    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    const img = screen.getByAltText("pet image");
    expect(img).toHaveAttribute("src", "https://example.com/buddy.jpg");
  });

  // --- 2. Interaction: Closing ---

  it("closes modal when clicking close icon", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    const closeIcons = screen.getAllByTestId("icon-close");
    fireEvent.click(closeIcons[1]);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- 3. Interaction: Tabs & Component Mapping ---

  it("renders Companion section by default", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    expect(screen.getByTestId("section-companion")).toBeInTheDocument();
    expect(screen.queryByTestId("section-parent")).not.toBeInTheDocument();
  });

  it("switches to Parent section when sub-label changes", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    fireEvent.click(screen.getByTestId("switch-sub-parent"));

    expect(screen.getByTestId("section-parent")).toBeInTheDocument();
    expect(screen.queryByTestId("section-companion")).not.toBeInTheDocument();
  });

  it("switches main tab to Records and resets sub-label to History", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    fireEvent.click(screen.getByTestId("tab-records"));

    expect(screen.getByTestId("active-label")).toHaveTextContent("records");
    expect(screen.getByTestId("active-sublabel")).toHaveTextContent("history");
    expect(screen.getByTestId("section-history")).toBeInTheDocument();
  });

  it("switches sub-label within Records tab", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockCompanion as any}
      />
    );

    fireEvent.click(screen.getByTestId("tab-records"));
    fireEvent.click(screen.getByTestId("switch-sub-docs"));

    expect(screen.getByTestId("section-documents")).toBeInTheDocument();
  });

  // --- 4. Edge Cases ---

  it("handles case where content component mapping is missing (defensive)", () => {
    render(
      <CompanionInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={null}
      />
    );

    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
  });
});
