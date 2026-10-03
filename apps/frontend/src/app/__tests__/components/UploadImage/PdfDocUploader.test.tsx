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
  const mockUploadFile = jest.fn();
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
        uploadFile={mockUploadFile}
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
        uploadFile={mockUploadFile}
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
        uploadFile={mockUploadFile}
      />
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click');
    fireEvent.click(screen.getByRole('button', { name: placeholder }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('uploads a valid pdf: sets file, requests signed url, uploads to s3, and calls onChange', async () => {
    mockUploadFile.mockResolvedValue({ s3Key: 'uploads/test.pdf' });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );

    const file = createPdfFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(mockUploadFile).toHaveBeenCalledWith(file);
    expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024);
  });

  it('handles a file drop the same as a picked file', async () => {
    mockUploadFile.mockResolvedValue({ s3Key: 'key' });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );

    const file = createPdfFile();
    const dropZone = screen.getByRole('button', { name: placeholder });

    fireEvent.dragOver(dropZone);
    await waitFor(() => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    });

    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(mockUploadFile).toHaveBeenCalledWith(file);
  });

  it('ignores non-pdf files', async () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );
    const invalidFile = new File(['content'], 'test.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [invalidFile] } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('ignores pdf files over the 20MB size limit', async () => {
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
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
        uploadFile={mockUploadFile}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await waitFor(() => {
      fireEvent.change(input, { target: { files: null } });
    });

    expect(mockSetFile).not.toHaveBeenCalled();
  });

  it('shows an error and skips onChange when the upload rejects', async () => {
    mockUploadFile.mockRejectedValue(new Error('upload failed'));

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );
    const file = createPdfFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The PDF could not be uploaded. Try again.'
    );
    expect(mockSetFile).toHaveBeenCalledWith(file);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows upload progress and ignores another file until the current upload settles', async () => {
    let resolveUpload: (uploaded: { s3Key: string }) => void = () => {};
    mockUploadFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createPdfFile()] } });

    expect(screen.getByRole('status').tagName).toBe('OUTPUT');
    expect(screen.getByRole('status')).toHaveTextContent('Uploading PDF…');
    expect(screen.getByRole('button', { name: placeholder })).toBeDisabled();

    fireEvent.change(input, { target: { files: [createPdfFile('second.pdf')] } });
    expect(mockUploadFile).toHaveBeenCalledTimes(1);

    resolveUpload({ s3Key: 'uploads/test.pdf' });

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024)
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('retries a failed upload without selecting the file again', async () => {
    mockUploadFile
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce({ s3Key: 'uploads/test.pdf' });

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={null}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );
    const file = createPdfFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: 'Retry upload' }));

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith('uploads/test.pdf', 'application/pdf', 1024)
    );
    expect(mockUploadFile).toHaveBeenCalledTimes(2);
    expect(mockUploadFile).toHaveBeenLastCalledWith(file);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the upload error when the file is removed', async () => {
    mockUploadFile.mockRejectedValue(new Error('upload failed'));
    const file = createPdfFile();

    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={file}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: `Remove ${file.name}` }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockSetFile).toHaveBeenLastCalledWith(null);
  });

  it('removes the selected file when the trash icon is clicked', () => {
    const file = createPdfFile();
    render(
      <PdfDocUploader
        placeholder={placeholder}
        onChange={mockOnChange}
        file={file}
        setFile={mockSetFile}
        uploadFile={mockUploadFile}
      />
    );
    fireEvent.click(screen.getByTestId('icon-trash').closest('button')!);
    expect(mockSetFile).toHaveBeenCalledWith(null);
  });
});
