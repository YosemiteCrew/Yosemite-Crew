import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PdfDocUploader from '@/app/ui/widgets/UploadImage/PdfDocUploader';

jest.mock('react-icons/io5', () => ({
  IoCloudUploadOutline: () => <span data-testid="icon-cloud" />,
  IoDocumentTextOutline: () => <span data-testid="icon-pdf" />,
  IoTrashOutline: () => <span data-testid="icon-trash" />,
}));

describe('PdfDocUploader', () => {
  const mockOnChange = jest.fn();
  const mockSetFile = jest.fn();
  const mockGetSignedUrl = jest.fn();
  const mockFetch = jest.fn();
  const originalFetch = globalThis.fetch;
  const placeholder = 'Upload PDF';

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

  it('renders the upload button and placeholder text', () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    expect(screen.getByText(placeholder)).toBeInTheDocument();
    expect(screen.getByText(/Only PDF/)).toBeInTheDocument();
  });

  it('renders the file preview when a file is provided', () => {
    const file = createPdfFile('preview.pdf');
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={file}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    expect(screen.getByText('preview.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('icon-pdf')).toBeInTheDocument();
  });

  it('triggers the hidden file input when the upload button is clicked', () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click');
    fireEvent.click(screen.getByRole('button', { name: placeholder }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('uploads a valid pdf: sets file, requests signed url, uploads to s3, and calls onChange', async () => {
    mockGetSignedUrl.mockResolvedValue({
      uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload',
      s3Key: 'uploads/test.pdf',
    });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );

    const file = createPdfFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(mockGetSignedUrl).toHaveBeenCalledWith(file);
    expect(mockFetch).toHaveBeenCalledWith('https://bucket.s3.us-east-1.amazonaws.com/upload', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'application/pdf' },
      credentials: 'omit',
      redirect: 'error',
    });
    expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024);
  });

  it('handles a file drop the same as a picked file', async () => {
    mockGetSignedUrl.mockResolvedValue({
      uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload',
      s3Key: 'key',
    });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );

    const file = createPdfFile();
    const dropZone = screen.getByRole('button', { name: placeholder });

    fireEvent.dragOver(dropZone);
    await waitFor(() => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(mockGetSignedUrl).toHaveBeenCalledWith(file);
  });

  it('shows upload progress and ignores another file until the current upload settles', async () => {
    let resolveSignedUrl: (signed: { uploadUrl: string; s3Key: string }) => void = () => {};
    mockGetSignedUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignedUrl = resolve;
        })
    );

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createPdfFile()] } });

    expect(screen.getByRole('status')).toHaveTextContent('Uploading PDF…');
    expect(screen.getByRole('button', { name: placeholder })).toBeDisabled();

    fireEvent.change(input, { target: { files: [createPdfFile('second.pdf')] } });
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

    resolveSignedUrl({
      uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload',
      s3Key: 'uploads/test.pdf',
    });

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024)
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores non-pdf files', async () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const invalidFile = new File(['content'], 'test.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [invalidFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('ignores pdf files over the 20MB size limit', async () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const largeFile = createPdfFile('large.pdf', 21 * 1024 * 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  it('does nothing when the file list is null (dialog cancelled)', async () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: null } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  it('shows an error and skips onChange when the upload flow rejects', async () => {
    mockGetSignedUrl.mockRejectedValue(new Error('signed url failed'));

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
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
    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows an error when the upload request fails', async () => {
    mockGetSignedUrl.mockResolvedValue({
      uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload',
      s3Key: 'uploads/test.pdf',
    });
    mockFetch.mockResolvedValue({ ok: false } as Response);

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createPdfFile()] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The PDF could not be uploaded. Try again.'
    );
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  const credentialedUrl = new URL('https://bucket.s3.us-east-1.amazonaws.com/upload');
  credentialedUrl.username = 'test-user';
  credentialedUrl.password = 'test-password';

  it.each([
    ['malformed', 'not-a-url'],
    ['non-HTTPS', 'http://bucket.s3.us-east-1.amazonaws.com/upload'],
    ['unapproved host', 'https://upload.invalid/file'],
    ['non-default port', 'https://bucket.s3.us-east-1.amazonaws.com:8443/upload'],
    ['nested AWS host', 'https://bucket.s3.region.extra.cluster.amazonaws.com/upload'],
    ['credentialed', credentialedUrl.href],
  ])('rejects a %s signed upload URL before sending a request', async (_label, uploadUrl) => {
    mockGetSignedUrl.mockResolvedValue({ uploadUrl, s3Key: 'uploads/test.pdf' });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createPdfFile()] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The PDF could not be uploaded. Try again.'
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('retries a failed upload without selecting the file again', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(new Error('signed url failed')).mockResolvedValueOnce({
      uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/upload',
      s3Key: 'uploads/test.pdf',
    });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    const file = createPdfFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: 'Retry upload' }));

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024)
    );
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes the selected file when the trash icon is clicked', () => {
    const file = createPdfFile();
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={file}
        setFile={mockSetFile}
        getSignedUrl={mockGetSignedUrl}
      />
    );
    fireEvent.click(screen.getByTestId('icon-trash').closest('button')!);
    expect(mockSetFile).toHaveBeenCalledWith(null);
  });
});
