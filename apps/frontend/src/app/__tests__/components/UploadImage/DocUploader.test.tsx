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
  const mockFetch = jest.fn();
  const originalFetch = globalThis.fetch;

  // Helper to create a dummy PDF file
  const createPdfFile = (name = 'test.pdf', size = 1024) => {
    const file = new File(['dummy content'], name, { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({ ok: true } as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
      data: { uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload', s3Key: 'key' },
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
    expect(postData).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith('key', 'application/pdf', 1024);
  });

  it('handles file drop event', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload', s3Key: 'key' },
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
    expect(postData).toHaveBeenCalled();
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
  it('uploads file successfully (getSignedUrl -> uploadToS3 -> onChange)', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: {
        uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload',
        s3Key: 'uploads/test.pdf',
      },
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

    // 1. Verify Signed URL Request
    expect(postData).toHaveBeenCalledWith(mockApiUrl, {
      mimeType: 'application/pdf',
    });

    // 2. Verify S3 Upload
    expect(mockFetch).toHaveBeenCalledWith('https://bucket.s3.us-east-1.amazonaws.com/upload', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'application/pdf' },
      credentials: 'omit',
      redirect: 'error',
    });

    // 3. Verify Callback
    expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024);
  });

  it('shows an upload error if the signed URL request fails', async () => {
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
