import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SpecialityStep from "../../../../components/Steps/CreateOrg/SpecialityStep";
import { createSpeciality } from "../../../../services/specialityService";
import { useRouter } from "next/navigation";
import { Speciality } from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../../../services/specialityService", () => ({
  createSpeciality: jest.fn(),
}));

jest.mock(
  "../../../../components/Inputs/SpecialitySearch/SpecialitySearch",
  () =>
    ({ setSpecialities }: any) => (
      <div data-testid="search-component">
        <button
          data-testid="add-speciality-btn"
          onClick={() =>
            setSpecialities((prev: Speciality[]) => [
              ...prev,
              { name: "New Spec" },
            ])
          }
        >
          Add Spec
        </button>
      </div>
    )
);

jest.mock(
  "../../../../components/Cards/SpecialityCard/SpecialityCard",
  () =>
    ({ speciality }: any) => (
      <div data-testid="speciality-card">{speciality.name}</div>
    )
);

jest.mock("../../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="btn-next" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: any) => (
    <button data-testid="btn-back" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("SpecialityStep Component", () => {
  const mockPrevStep = jest.fn();
  const mockSetSpecialities = jest.fn();
  const mockRouterPush = jest.fn();

  const emptySpecialities: Speciality[] = [];
  const mockSpecialities: Speciality[] = [
    { name: "Cardiology" } as Speciality,
    { name: "Surgery" } as Speciality,
  ];

  beforeEach(() => {
    // FIX: Use resetAllMocks to completely clear implementations (like mockRejectedValue) from previous tests
    jest.resetAllMocks();

    // Re-apply default mocks
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });

    // Default createSpeciality to resolve (prevent unhandled rejections in tests that don't specifically test failure)
    (createSpeciality as jest.Mock).mockResolvedValue({});
  });

  // --- Section 1: Rendering ---
  it("renders correctly with empty specialities", () => {
    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={emptySpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    expect(screen.getByText("Specialties")).toBeInTheDocument();
    expect(
      screen.getByText("Search and add specialities from the search bar above")
    ).toBeInTheDocument();
    expect(screen.getByTestId("search-component")).toBeInTheDocument();
    expect(screen.queryByTestId("speciality-card")).not.toBeInTheDocument();
  });

  it("renders correctly with populated specialities", () => {
    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={mockSpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    expect(
      screen.queryByText(
        "Search and add specialities from the search bar above"
      )
    ).not.toBeInTheDocument();
    const cards = screen.getAllByTestId("speciality-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Cardiology");
    expect(cards[1]).toHaveTextContent("Surgery");
  });

  // --- Section 2: Interaction ---
  it("calls prevStep when Back button is clicked", () => {
    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={emptySpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("btn-back"));
    expect(mockPrevStep).toHaveBeenCalled();
  });

  it("updates state when adding speciality via mock search", () => {
    let stateCallback: any;
    mockSetSpecialities.mockImplementation((cb) => {
      stateCallback = cb;
    });

    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={mockSpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("add-speciality-btn"));

    const newState = stateCallback(mockSpecialities);
    expect(newState).toHaveLength(3);
    expect(newState[2].name).toBe("New Spec");
  });

  // --- Section 3: Validation ---
  it("does not submit if specialities list is empty", async () => {
    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={emptySpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    expect(createSpeciality).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  // --- Section 4: Submission & Error Handling ---
  it("submits all specialities and navigates on success", async () => {
    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={mockSpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(createSpeciality).toHaveBeenCalledTimes(2);
      expect(createSpeciality).toHaveBeenCalledWith(mockSpecialities[0]);
      expect(createSpeciality).toHaveBeenCalledWith(mockSpecialities[1]);
      expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("handles partial failure but navigates if at least one succeeds", async () => {
    // First call succeeds, second fails
    (createSpeciality as jest.Mock)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Fail"));

    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={mockSpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(createSpeciality).toHaveBeenCalledTimes(2);
      expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("does not navigate if ALL requests fail", async () => {
    (createSpeciality as jest.Mock).mockRejectedValue(new Error("Fail"));

    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={mockSpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(createSpeciality).toHaveBeenCalledTimes(2);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  it("logs error if submission crashes unexpectedly", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Safely spy on Promise.allSettled
    const allSettledSpy = jest
      .spyOn(Promise, "allSettled")
      .mockRejectedValue(new Error("Critical Failure"));

    // Ensure createSpeciality does NOT return a rejected promise here,
    // otherwise the rejected promise + mocked allSettled = Unhandled Rejection (the cause of your "Fail" error)
    (createSpeciality as jest.Mock).mockResolvedValue({});

    render(
      <SpecialityStep
        prevStep={mockPrevStep}
        specialities={mockSpecialities}
        setSpecialities={mockSetSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save specialities:",
        expect.any(Error)
      );
    });

    allSettledSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
