import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PdfDocUploader from '@/app/ui/widgets/UploadImage/PdfDocUploader';
import axios from 'axios';

jest.mock('axios');

jest.mock('react-icons/fa', () => ({
  FaCloudUploadAlt: () => <span data-testid="icon-cloud" />,
  FaFilePdf: () => <span data-testid="icon-pdf" />,
  FaTrashAlt: () => <span data-testid="icon-trash" />,
}));

describe('PdfDocUploader', () => {
  const mockOnChange = jest.fn();
  const mockSetFile = jest.fn();
  const mockGetSignedUrl = jest.fn();
  const placeholder = 'Upload PDF';

  const createPdfFile = (name = 'test.pdf', size = 1024) => {
    const file = new File(['dummy content'], name, { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
    mockGetSignedUrl.mockResolvedValue({ uploadUrl: 'https://s3.url', s3Key: 'uploads/test.pdf' });
    (axios.put as jest.Mock).mockResolvedValue({});

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
    expect(axios.put).toHaveBeenCalledWith('https://s3.url', file, {
      headers: { 'Content-Type': 'application/pdf' },
      withCredentials: false,
    });
    expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024);
  });

  it('handles a file drop the same as a picked file', async () => {
    mockGetSignedUrl.mockResolvedValue({ uploadUrl: 'https://s3.url', s3Key: 'key' });
    (axios.put as jest.Mock).mockResolvedValue({});

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

  it('logs the error and skips onChange when the upload flow rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('signed url failed');
    mockGetSignedUrl.mockRejectedValue(error);

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

    expect(consoleSpy).toHaveBeenCalledWith(error);
    expect(mockOnChange).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
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
