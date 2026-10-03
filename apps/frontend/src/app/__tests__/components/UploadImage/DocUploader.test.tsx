import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DocUploader from '@/app/ui/widgets/UploadImage/DocUploader';
import { postData } from '@/app/services/axios';

// --- Mocks ---

// 1. Mock Services
jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));

// 2. Mock Icons
jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

expect.extend(toHaveNoViolations);

describe('DocUploader Component', () => {
  const mockOnChange = jest.fn();
  const mockSetFile = jest.fn();
  const mockApiUrl = '/api/upload';
  const mockPlaceholder = 'Upload PDF';

  // Helper to create a dummy PDF file
  const createPdfFile = (name = 'test.pdf', size = 1024) => {
    const file = new File(['dummy content'], name, { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it('renders the upload button and placeholder', () => {
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
    expect(screen.getByTestId('IoCloudUploadOutline')).toBeInTheDocument();
  });

  it('renders the file preview when a file is selected', () => {
    const file = createPdfFile('preview.pdf');
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={file}
        setFile={mockSetFile}
      />
    );

    expect(screen.getByText('preview.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('IoDocumentTextOutline')).toBeInTheDocument();
    expect(screen.getByTestId('IoTrashOutline')).toBeInTheDocument();
  });

  // --- Section 2: Interactions (Click & Drag) ---
  it('triggers file input click when button is clicked', () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click');

    // Click the main button wrapper
    fireEvent.click(screen.getByRole('button'));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('handles file selection via input change', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { s3Key: 'key' },
    });

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
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(postData).toHaveBeenCalledWith(mockApiUrl, expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect((postData as jest.Mock).mock.calls[0][1].get('file')).toBe(file);
    expect(mockOnChange).toHaveBeenCalledWith('key', 'application/pdf', 1024);
  });

  it('handles file drop event', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { s3Key: 'key' },
    });

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
    const dropZone = screen.getByRole('button');

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
    expect(postData).toHaveBeenCalledWith(mockApiUrl, expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  // --- Section 3: Validation Logic ---
  it('ignores files with invalid types (non-PDF)', async () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const invalidFile = new File(['content'], 'test.png', {
      type: 'image/png',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [invalidFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
    expect(postData).not.toHaveBeenCalled();
  });

  it('ignores files exceeding size limit (20MB)', async () => {
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
    const largeFile = createPdfFile('large.pdf', 21 * 1024 * 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  it('handles null file list gracefully', async () => {
    render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate cancelling file dialog (files becomes null or empty)
    await waitFor(() => {
      fireEvent.change(input, { target: { files: null } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  // --- Section 4: API & Error Handling ---
  it('uploads file directly and calls onChange with the stored key', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { s3Key: 'uploads/test.pdf' },
    });

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
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Upload to the authenticated API rather than returning a storage URL to the browser.
    expect(postData).toHaveBeenCalledWith(mockApiUrl, expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect(((postData as jest.Mock).mock.calls[0][1] as FormData).get('file')).toBe(file);

    expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024);
  });

  it('shows an upload error if the upload request fails', async () => {
    (postData as jest.Mock).mockRejectedValue(new Error('Upload Failed'));

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
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The PDF could not be uploaded. Try again.'
    );
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('removes the file when trash icon is clicked', () => {
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

    const trashIcon = screen.getByTestId('IoTrashOutline');
    fireEvent.click(trashIcon);

    expect(mockSetFile).toHaveBeenCalledWith(null);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <DocUploader
        placeholder={mockPlaceholder}
        onChange={mockOnChange}
        apiUrl={mockApiUrl}
        file={null}
        setFile={mockSetFile}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
