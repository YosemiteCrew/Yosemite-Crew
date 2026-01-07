import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocUploader from "../../../components/UploadImage/DocUploader";
import { postData } from "@/app/services/axios";
import axios from "axios";

// --- Mocks ---

// 1. Mock Services
jest.mock("@/app/services/axios", () => ({
  postData: jest.fn(),
}));

jest.mock("axios");

// 2. Mock Icons
// FIX: Added accessibility attributes to satisfy SonarQube S6848 and S1082
jest.mock("react-icons/fa", () => ({
  FaCloudUploadAlt: () => <span data-testid="icon-cloud" />,
  FaFilePdf: () => <span data-testid="icon-pdf" />,
  FaTrashAlt: ({ onClick }: { onClick: () => void }) => (
    <button type="button" data-testid="icon-trash" onClick={onClick} />
  ),
}));

describe("DocUploader Component", () => {
  const mockOnChange = jest.fn();
  const mockSetFile = jest.fn();
  const mockApiUrl = "/api/upload";
  const mockPlaceholder = "Upload PDF";

  // Helper to create a dummy PDF file
  const createPdfFile = (name = "test.pdf", size = 1024) => {
    const file = new File(["dummy content"], name, { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it("renders the upload button and placeholder", () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    expect(screen.getByText(mockPlaceholder)).toBeInTheDocument();
    expect(screen.getByText(/Only PDF/)).toBeInTheDocument();
    expect(screen.getByTestId("icon-cloud")).toBeInTheDocument();
  });

  it("renders the file preview when a file is selected", () => {
    const file = createPdfFile("preview.pdf");
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={file}
        setFile={mockSetFile}
      />
    );

    expect(screen.getByText("preview.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("icon-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("icon-trash")).toBeInTheDocument();
  });

  // --- Section 2: Interactions (Click & Drag) ---
  it("triggers file input click when button is clicked", () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, "click");

    // Click the main button wrapper
    fireEvent.click(screen.getByRole("button"));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles file selection via input change", async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: "url", s3Key: "key" },
    });
    (axios.put as jest.Mock).mockResolvedValue({});

    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const file = createPdfFile();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(postData).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith("key");
  });

  it("handles file drop event", async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: "url", s3Key: "key" },
    });
    (axios.put as jest.Mock).mockResolvedValue({});

    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const file = createPdfFile();
    const dropZone = screen.getByRole("button");

    // Simulate Drag Over
    fireEvent.dragOver(dropZone);

    // Simulate Drop
    await waitFor(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(postData).toHaveBeenCalled();
  });

  // --- Section 3: Validation Logic ---
  it("ignores files with invalid types (non-PDF)", async () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const invalidFile = new File(["content"], "test.png", {
      type: "image/png",
    });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [invalidFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
    expect(postData).not.toHaveBeenCalled();
  });

  it("ignores files exceeding size limit (20MB)", async () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    // Create large file (21MB)
    const largeFile = createPdfFile("large.pdf", 21 * 1024 * 1024);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  it("handles null file list gracefully", async () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate cancelling file dialog (files becomes null or empty)
    await waitFor(() => {
      fireEvent.change(input, { target: { files: null } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  // --- Section 4: API & Error Handling ---
  it("uploads file successfully (getSignedUrl -> uploadToS3 -> onChange)", async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: "https://s3.url", s3Key: "uploads/test.pdf" },
    });
    (axios.put as jest.Mock).mockResolvedValue({});

    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const file = createPdfFile();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // 1. Verify Signed URL Request
    expect(postData).toHaveBeenCalledWith(mockApiUrl, {
      mimeType: "application/pdf",
    });

    // 2. Verify S3 Upload
    expect(axios.put).toHaveBeenCalledWith("https://s3.url", file, {
      headers: { "Content-Type": "application/pdf" },
      withCredentials: false,
    });

    // 3. Verify Callback
    expect(mockOnChange).toHaveBeenCalledWith("uploads/test.pdf");
  });

  it("logs error if upload process fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const error = new Error("Upload Failed");
    (postData as jest.Mock).mockRejectedValue(error);

    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const file = createPdfFile();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(consoleSpy).toHaveBeenCalledWith(error);
    expect(mockOnChange).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("removes the file when trash icon is clicked", () => {
    const file = createPdfFile();
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={file}
        setFile={mockSetFile}
      />
    );

    const trashIcon = screen.getByTestId("icon-trash");
    fireEvent.click(trashIcon);

    expect(mockSetFile).toHaveBeenCalledWith(null);
  });
});
