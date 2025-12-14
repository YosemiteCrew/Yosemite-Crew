import React from "react";
import {
  render,
  screen,
  fireEvent,
  createEvent,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import UploadImage from "@/app/components/UploadImage/UploadImage";

// --- Mocks ---

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // We render a standard img tag to allow firing 'load' events
    return <img {...props} alt={props.alt || "mock-img"} />;
  },
}));

// Mock React Bootstrap Button
jest.mock("react-bootstrap", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button className={className} onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

// Mock Icons
jest.mock("react-icons/fa", () => ({
  FaCloudUploadAlt: () => <span data-testid="icon-upload">Upload</span>,
  FaFilePdf: () => <span data-testid="icon-pdf">PDF</span>,
  FaFileWord: () => <span data-testid="icon-word">Word</span>,
  FaFileImage: () => <span data-testid="icon-image">Image</span>,
  FaTrashAlt: () => <span data-testid="icon-trash">Delete</span>,
}));

// Mock URL API methods
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

beforeAll(() => {
  globalThis.URL.createObjectURL = mockCreateObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("UploadImage Component", () => {
  const mockOnChange = jest.fn();

  const defaultProps = {
    placeholder: "Upload Documents",
    onChange: mockOnChange,
  };

  // --- 1. Rendering ---

  it("renders the upload area with placeholder text", () => {
    render(<UploadImage {...defaultProps} />);

    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
    // Use regex to match multi-line text or parts of it
    expect(screen.getByText(/Only DOC, PDF, PNG, JPEG/)).toBeInTheDocument();
    expect(screen.getByTestId("icon-upload")).toBeInTheDocument();
  });

  it("renders existing files correctly", () => {
    const existingFiles = [
      {
        name: "test.pdf",
        type: "application/pdf",
        url: "http://example.com/test.pdf",
      },
      {
        name: "image.png",
        type: "image/png",
        url: "http://example.com/image.png",
      },
    ];

    render(<UploadImage {...defaultProps} existingFiles={existingFiles} />);

    // Check PDF rendering (icon)
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("icon-pdf")).toBeInTheDocument();

    // Check Image rendering (img tag)
    const img = screen.getByAltText("image.png");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "http://example.com/image.png");
  });

  // --- 2. File Selection (Click & Change) ---

  it("handles file selection via input change", () => {
    render(<UploadImage {...defaultProps} />);

    const file = new File(["dummy content"], "doc.pdf", {
      type: "application/pdf",
    });
    mockCreateObjectURL.mockReturnValue("blob:test-url");

    // Select the hidden input by selector
    // eslint-disable-next-line testing-library/no-node-access
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnChange).toHaveBeenCalled();
    // Verify file added to UI list
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("icon-pdf")).toBeInTheDocument();
  });

  it("filters out invalid file types", () => {
    render(<UploadImage {...defaultProps} />);

    const validFile = new File(["a"], "valid.png", { type: "image/png" });
    const invalidFile = new File(["b"], "invalid.exe", {
      type: "application/x-msdownload",
    });

    // eslint-disable-next-line testing-library/no-node-access
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [validFile, invalidFile] } });

    expect(screen.getByAltText("valid.png")).toBeInTheDocument();
    expect(screen.queryByText("invalid.exe")).not.toBeInTheDocument();

    // Check onChange called with only 1 file
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([validFile])
    );
    expect(mockOnChange.mock.calls[0][0]).toHaveLength(1);
  });

  it("filters out files larger than 20MB", () => {
    render(<UploadImage {...defaultProps} />);

    const largeFile = new File(["a"], "large.pdf", { type: "application/pdf" });
    // Mock the size property
    Object.defineProperty(largeFile, "size", { value: 25 * 1024 * 1024 }); // 25MB

    const smallFile = new File(["b"], "small.pdf", { type: "application/pdf" });
    Object.defineProperty(smallFile, "size", { value: 1 * 1024 * 1024 }); // 1MB

    // eslint-disable-next-line testing-library/no-node-access
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [largeFile, smallFile] } });

    expect(screen.getByText("small.pdf")).toBeInTheDocument();
    expect(screen.queryByText("large.pdf")).not.toBeInTheDocument();
  });

  // --- 3. Drag and Drop ---

  it("handles drag over event (prevents default behavior)", () => {
    render(<UploadImage {...defaultProps} />);
    const dropZone = screen.getByText("Upload Documents").closest("button")!;

    const dragOverEvent = createEvent.dragOver(dropZone);
    const preventDefaultSpy = jest.spyOn(dragOverEvent, "preventDefault");

    fireEvent(dropZone, dragOverEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("handles file drop event", () => {
    render(<UploadImage {...defaultProps} />);
    const dropZone = screen.getByText("Upload Documents").closest("button")!;

    const file = new File(["content"], "dropped.docx", {
      type: "application/msword",
    });

    const dropEvent = createEvent.drop(dropZone);
    // Mock dataTransfer files
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [file],
      },
    });

    fireEvent(dropZone, dropEvent);

    expect(screen.getByText("dropped.docx")).toBeInTheDocument();
    expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([file]));
  });

  // --- 4. Deletion ---

  it("deletes a newly added file", () => {
    render(<UploadImage {...defaultProps} />);

    // Add file first
    const file = new File(["c"], "delete-me.pdf", { type: "application/pdf" });
    // eslint-disable-next-line testing-library/no-node-access
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("delete-me.pdf")).toBeInTheDocument();

    // Click delete button
    const deleteBtn = screen.getAllByTestId("icon-trash")[0].closest("button")!;
    fireEvent.click(deleteBtn);

    expect(screen.queryByText("delete-me.pdf")).not.toBeInTheDocument();
    // onChange should be called with empty array after deletion
    expect(mockOnChange).toHaveBeenLastCalledWith([]);
  });

  it("deletes an existing (API) file", () => {
    const existingFiles = [
      { name: "existing.pdf", type: "application/pdf", url: "url" },
    ];
    render(<UploadImage {...defaultProps} existingFiles={existingFiles} />);

    expect(screen.getByText("existing.pdf")).toBeInTheDocument();

    const deleteBtn = screen.getAllByTestId("icon-trash")[0].closest("button")!;
    fireEvent.click(deleteBtn);

    expect(screen.queryByText("existing.pdf")).not.toBeInTheDocument();
    // Note: Based on provided code, handleDeleteExisting only updates local state 'apiFiles'
    // and does NOT call onChange. We verify via UI removal.
  });

  // --- 5. Icon Logic & Edge Cases ---

  it("displays correct icons for different file types", () => {
    const files = [
      { name: "a.doc", type: "application/msword" }, // Word
      {
        name: "b.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }, // Word via 'word' check
    ];

    render(<UploadImage {...defaultProps} />);
    // eslint-disable-next-line testing-library/no-node-access
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileObjects = files.map(
      (f) => new File([""], f.name, { type: f.type })
    );
    fireEvent.change(input, { target: { files: fileObjects } });

    // Expect 2 Word icons
    expect(screen.getAllByTestId("icon-word")).toHaveLength(2);
  });

  it("renders correctly when passed initial 'value' prop (files)", () => {
    const file = new File([""], "init.pdf", { type: "application/pdf" });
    render(<UploadImage {...defaultProps} value={[file]} />);
    expect(screen.getByText("init.pdf")).toBeInTheDocument();
  });

  it("triggers click on hidden input when main button is clicked", () => {
    render(<UploadImage {...defaultProps} />);
    const btn = screen.getByText("Upload Documents").closest("button")!;
    // eslint-disable-next-line testing-library/no-node-access
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    fireEvent.click(btn);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("revokes object URL on image load", () => {
    mockCreateObjectURL.mockReturnValue("blob:test-revoke");
    const file = new File([""], "img-revoke.png", { type: "image/png" });
    render(<UploadImage {...defaultProps} value={[file]} />);

    const img = screen.getByAltText("img-revoke.png");
    // Simulate image loading
    fireEvent.load(img);

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-revoke");
  });
});
