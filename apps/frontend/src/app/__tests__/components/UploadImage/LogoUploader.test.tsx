import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LogoUploader from "../../../components/UploadImage/LogoUploader";
import { postData } from "@/app/services/axios";
import axios from "axios";

// --- Mocks ---

// 1. Mock Services
jest.mock("@/app/services/axios", () => ({
  postData: jest.fn(),
}));

jest.mock("axios");

// 2. Mock Icons
jest.mock("react-icons/io5", () => ({
  IoCamera: () => <span data-testid="icon-camera" />,
}));

jest.mock("react-icons/fi", () => ({
  FiMinusCircle: () => <span data-testid="icon-remove" />,
}));

// 3. Mock URL Object (createObjectURL / revokeObjectURL)
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

beforeAll(() => {
  globalThis.URL.createObjectURL = mockCreateObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterAll(() => {
  // FIX: Use type casting instead of @ts-ignore to satisfy linter
  (globalThis.URL as any).createObjectURL = undefined;
  (globalThis.URL as any).revokeObjectURL = undefined;
});

describe("LogoUploader Component", () => {
  const mockSetImageUrl = jest.fn();
  const mockApiUrl = "/api/logo-upload";
  const mockTitle = "Upload Logo";

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/mock-image");
  });

  // --- Section 1: Rendering ---
  it("renders the initial state correctly", () => {
    render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.getByTestId("icon-camera")).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", "image/*");
  });

  // --- Section 2: Successful Upload Flow ---
  it("handles file selection, shows preview, and uploads successfully", async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: "https://s3.url", s3Key: "logos/image.png" },
    });
    (axios.put as jest.Mock).mockResolvedValue({});

    render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    const file = new File(["dummy"], "logo.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    // 1. Check Loading State
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
    expect(mockCreateObjectURL).toHaveBeenCalledWith(file);

    await waitFor(() => {
      // 2. Verify API Calls
      expect(postData).toHaveBeenCalledWith(mockApiUrl, {
        mimeType: "image/png",
      });
      expect(axios.put).toHaveBeenCalledWith("https://s3.url", file, {
        headers: { "Content-Type": "image/png" },
        withCredentials: false,
      });

      // 3. Verify Callback
      expect(mockSetImageUrl).toHaveBeenCalledWith("logos/image.png");
    });

    // 4. Verify Preview State
    expect(screen.getByAltText("Logo Preview")).toBeInTheDocument();
    expect(screen.getByText(mockTitle)).toBeInTheDocument();
  });

  // --- Section 3: Error Handling ---
  it("handles upload errors and clears preview", async () => {
    const errorMsg = "Network Error";
    (postData as jest.Mock).mockRejectedValue(new Error(errorMsg));

    render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    const file = new File(["dummy"], "logo.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    // Note: The component logic calls `handleRemoveImage` which implicitly clears the error.
    // We check that the process completed (loading gone) and success callback wasn't called.
    await waitFor(() => {
      expect(screen.getByText(mockTitle)).toBeInTheDocument();
      expect(mockSetImageUrl).not.toHaveBeenCalled();
    });

    expect(mockRevokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByAltText("Logo Preview")).not.toBeInTheDocument();
  });

  it("handles fallback error message logic if error object is empty", async () => {
    (postData as jest.Mock).mockRejectedValue({}); // No message property

    render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    const file = new File(["dummy"], "logo.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetImageUrl).not.toHaveBeenCalled();
      expect(screen.getByText(mockTitle)).toBeInTheDocument();
    });

    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  // --- Section 4: User Interactions & Edge Cases ---
  it("removes the image when the remove button is clicked", async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: "url", s3Key: "key" },
    });
    (axios.put as jest.Mock).mockResolvedValue({});

    render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    const file = new File(["dummy"], "logo.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByAltText("Logo Preview")).toBeInTheDocument()
    );

    // Click remove (FiMinusCircle wrapper)
    const removeBtn = screen.getByRole("button");
    fireEvent.click(removeBtn);

    expect(mockRevokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByAltText("Logo Preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon-camera")).toBeInTheDocument();
  });

  it("does nothing if no file is selected (cancel dialog)", () => {
    render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(postData).not.toHaveBeenCalled();
  });

  it("cleans up object URL on unmount", async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: "", s3Key: "" },
    });
    (axios.put as jest.Mock).mockResolvedValue({});

    const { unmount } = render(
      <LogoUploader
        title={mockTitle}
        apiUrl={mockApiUrl}
        setImageUrl={mockSetImageUrl}
      />
    );

    const file = new File(["dummy"], "logo.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByAltText("Logo Preview")).toBeInTheDocument()
    );

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/mock-image"
    );
  });
});
