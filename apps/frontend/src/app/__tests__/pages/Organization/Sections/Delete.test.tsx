import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Delete from "@/app/pages/Organization/Sections/Delete";
import { deleteOrg } from "@/app/services/orgService";

// --- Mocks ---

jest.mock("@/app/services/orgService", () => ({
  deleteOrg: jest.fn(),
}));

// Mock Secondary Button component
jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button data-testid="secondary-button" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Mock FormInput component
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, error, inlabel }: any) => (
    <div>
      <label>{inlabel}</label>
      <input data-testid="email-input" value={value} onChange={onChange} />
      {error && <span data-testid="email-error">{error}</span>}
    </div>
  ),
}));

describe("Delete Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial State & Popup Toggling ---

  it("renders the delete trigger button initially", () => {
    render(<Delete />);
    expect(screen.getByText("Delete organization")).toBeInTheDocument();
    expect(
      screen.queryByText("Are you sure you want to delete this organization?")
    ).not.toBeInTheDocument();
  });

  it("opens the delete popup when trigger button is clicked", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));
    expect(
      screen.getByText("Are you sure you want to delete this organization?")
    ).toBeInTheDocument();
  });

  it("closes the popup when the close icon is clicked", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));

    // There are two close icons in the code, we click the visible one (index 1)
    const closeButtons = screen.getAllByRole("button");
    fireEvent.click(closeButtons[2]); // The one with setDeletePopup(false)

    expect(
      screen.queryByText("Are you sure you want to delete this organization?")
    ).not.toBeInTheDocument();
  });

  // --- 2. Input Handling & Validation ---

  it("updates email and consent states correctly", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));

    const emailInput = screen.getByTestId("email-input");
    const checkbox = screen.getByRole("checkbox");

    fireEvent.change(emailInput, { target: { value: "owner@test.com" } });
    fireEvent.click(checkbox);

    expect(emailInput).toHaveValue("owner@test.com");
    expect(checkbox).toBeChecked();
  });

  it("shows validation error if email is empty during delete", async () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId("email-error")).toHaveTextContent(
      "Email is required"
    );
    expect(deleteOrg).not.toHaveBeenCalled();
  });

  // --- 3. Successful Deletion & Error Handling ---

  it("calls deleteOrg and resets state on success", async () => {
    (deleteOrg as jest.Mock).mockResolvedValueOnce({ success: true });
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "owner@test.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteOrg).toHaveBeenCalled();
      expect(
        screen.queryByText("Are you sure you want to delete this organization?")
      ).not.toBeInTheDocument();
    });
  });

  it("logs error to console if deleteOrg fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const mockError = new Error("API Failure");
    (deleteOrg as jest.Mock).mockRejectedValueOnce(mockError);

    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "owner@test.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(mockError);
    });
    consoleSpy.mockRestore();
  });

  // --- 4. Cancel & Cleanup ---

  it("resets all states when handleCancel is called", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete organization"));

    // Set some data
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "wrong@email.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    // Click Cancel (Secondary component)
    fireEvent.click(screen.getByTestId("secondary-button"));

    // Re-open to verify reset
    fireEvent.click(screen.getByText("Delete organization"));
    expect(screen.getByTestId("email-input")).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});
