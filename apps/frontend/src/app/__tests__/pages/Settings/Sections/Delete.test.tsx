import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Delete from "@/app/pages/Settings/Sections/Delete";

// --- Mocks ---

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        data-testid="delete-email-input"
        value={value}
        onChange={onChange}
      />
      {error && <span data-testid="delete-email-error">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: () => <span data-testid="close-icon" />,
}));

describe("Delete Profile Section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Opening ---

  it("renders the delete button initially", () => {
    render(<Delete />);
    expect(screen.getByText("Delete profile")).toBeInTheDocument();
    expect(
      screen.queryByText("Are you sure you want to delete your profile?")
    ).not.toBeInTheDocument();
  });

  it("opens the popup when the delete button is clicked", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete profile"));
    expect(
      screen.getByText("Are you sure you want to delete your profile?")
    ).toBeInTheDocument();
  });

  // --- 2. Closing Logic ---

  it("closes the popup when the close icon is clicked", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete profile"));

    // Find the button wrapping the close icon (the visible one)
    const closeButtons = screen.getAllByRole("button");
    const closeBtn = closeButtons.find(
      (btn) =>
        btn.innerHTML.includes('data-testid="close-icon"') &&
        !btn.className.includes("opacity-0")
    );
    if (closeBtn) fireEvent.click(closeBtn);

    expect(
      screen.queryByText("Are you sure you want to delete your profile?")
    ).not.toBeInTheDocument();
  });

  it("closes the popup and resets state when the Cancel button is clicked", () => {
    render(<Delete />);

    fireEvent.click(screen.getByText("Delete profile"));

    // Enter text
    fireEvent.change(screen.getByTestId("delete-email-input"), {
      target: { value: "test@test.com" },
    });

    // Click Cancel (which calls handleCancel -> resets email)
    fireEvent.click(screen.getByText("Cancel"));

    expect(
      screen.queryByText("Are you sure you want to delete your profile?")
    ).not.toBeInTheDocument();

    // Re-open and verify email is empty
    fireEvent.click(screen.getByText("Delete profile"));
    expect(screen.getByTestId("delete-email-input")).toHaveValue("");
  });

  // --- 3. Validation & Success ---

  it("shows an error if Delete is clicked without an email", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete profile"));

    // Click the actual delete action button
    const deleteActionBtn = screen.getByText("Delete", { selector: "button" });
    fireEvent.click(deleteActionBtn);

    expect(screen.getByTestId("delete-email-error")).toHaveTextContent(
      "Email is required"
    );
  });

  it("closes the popup and resets state on successful delete", () => {
    render(<Delete />);
    fireEvent.click(screen.getByText("Delete profile"));

    const input = screen.getByTestId("delete-email-input");
    fireEvent.change(input, { target: { value: "user@example.com" } });

    const deleteActionBtn = screen.getByText("Delete", { selector: "button" });
    fireEvent.click(deleteActionBtn);

    expect(
      screen.queryByText("Are you sure you want to delete your profile?")
    ).not.toBeInTheDocument();

    // Verify reset
    fireEvent.click(screen.getByText("Delete profile"));
    expect(screen.getByTestId("delete-email-input")).toHaveValue("");
  });
});
