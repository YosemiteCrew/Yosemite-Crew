import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUploadField from '@/app/features/inventory/components/AddInventory/ImageUploadField';
import {
  getInventoryItemImagePresignedUrl,
  uploadFileToS3,
} from '@/app/features/inventory/services/inventoryUploadService';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, unoptimized }: any) =>
    React.createElement('img', { alt, src, 'data-unoptimized': String(unoptimized) }),
}));

jest.mock('@/app/features/inventory/services/inventoryUploadService', () => ({
  getInventoryItemImagePresignedUrl: jest.fn(),
  uploadFileToS3: jest.fn(),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeOrgImageUrl: jest.fn((src: string) =>
    src.startsWith('inventory/') ? `https://cdn.example.com/${src}` : src
  ),
}));

describe('ImageUploadField', () => {
  const createObjectURL = jest.fn(() => 'blob:preview');
  const revokeObjectURL = jest.fn();

  const makeFile = () => new File(['file'], 'item.png', { type: 'image/png' });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      writable: true,
      configurable: true,
    });
  });

  it('renders an existing inventory s3 key through the org CDN url', () => {
    render(
      <ImageUploadField
        label="Product image"
        value="inventory/org-1/item-1.jpg"
        organisationId="org-1"
        onChange={jest.fn()}
      />
    );

    const image = screen.getByAltText('Product image');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/inventory/org-1/item-1.jpg');
    expect(image).toHaveAttribute('data-unoptimized', 'false');
    expect(screen.getByText('Product image')).toBeInTheDocument();
  });

  it('uploads the selected file and stores the returned s3 key', async () => {
    const onChange = jest.fn();
    (getInventoryItemImagePresignedUrl as jest.Mock).mockResolvedValue({
      uploadUrl: 'https://upload.example.com',
      s3Key: 'inventory/org-1/new-item.png',
    });
    (uploadFileToS3 as jest.Mock).mockResolvedValue(undefined);

    render(
      <ImageUploadField label="Product image" value="" organisationId="org-1" onChange={onChange} />
    );

    const fileInput = screen.getByLabelText('Product image');
    const file = makeFile();
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(getInventoryItemImagePresignedUrl).toHaveBeenCalledWith('org-1', 'image/png')
    );
    expect(uploadFileToS3).toHaveBeenCalledWith('https://upload.example.com', file);
    expect(onChange).toHaveBeenCalledWith('inventory/org-1/new-item.png');
    // the local blob preview is revoked once the real key is stored
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview'));
  });

  it('renders the upload placeholder and a generic aria-label when no label is given', () => {
    render(<ImageUploadField value="" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Upload inventory image')).toBeInTheDocument();
    expect(screen.getByText('Upload image')).toBeInTheDocument();
    expect(screen.getByText('PNG, JPG, WebP · Max 2 MB')).toBeInTheDocument();
    expect(screen.queryByAltText('Product image')).not.toBeInTheDocument();
  });

  it('opens the hidden file input when the placeholder button is clicked', () => {
    render(
      <ImageUploadField
        label="Product image"
        value=""
        organisationId="org-1"
        onChange={jest.fn()}
      />
    );

    const fileInput = screen.getByLabelText('Product image');
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: /Upload image/ }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('ignores a change event that carries an empty file list', () => {
    render(
      <ImageUploadField
        label="Product image"
        value=""
        organisationId="org-1"
        onChange={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: [] } });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(getInventoryItemImagePresignedUrl).not.toHaveBeenCalled();
  });

  it('ignores a change event with no file list at all', () => {
    render(
      <ImageUploadField
        label="Product image"
        value=""
        organisationId="org-1"
        onChange={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: null } });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(getInventoryItemImagePresignedUrl).not.toHaveBeenCalled();
  });

  it('shows an error and skips the upload when the organisation is not loaded yet', () => {
    const onChange = jest.fn();
    render(<ImageUploadField label="Product image" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: [makeFile()] } });

    expect(screen.getByText('Organisation not loaded. Please try again.')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(getInventoryItemImagePresignedUrl).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the blob preview and the uploading overlay while the upload is in flight', async () => {
    let resolvePresigned: (value: { uploadUrl: string; s3Key: string }) => void = () => {};
    (getInventoryItemImagePresignedUrl as jest.Mock).mockReturnValue(
      new Promise<{ uploadUrl: string; s3Key: string }>((resolve) => {
        resolvePresigned = resolve;
      })
    );
    (uploadFileToS3 as jest.Mock).mockResolvedValue(undefined);
    const onChange = jest.fn();

    render(
      <ImageUploadField label="Product image" value="" organisationId="org-1" onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: [makeFile()] } });

    const image = screen.getByAltText('Product image');
    expect(image).toHaveAttribute('src', 'blob:preview');
    expect(image).toHaveAttribute('data-unoptimized', 'true');
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
    // the remove control is hidden while an upload is running
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

    await act(async () => {
      resolvePresigned({
        uploadUrl: 'https://upload.example.com',
        s3Key: 'inventory/org-1/new-item.png',
      });
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('inventory/org-1/new-item.png'));
    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
  });

  it('surfaces an upload error when the presigned url request rejects', async () => {
    (getInventoryItemImagePresignedUrl as jest.Mock).mockRejectedValue(new Error('presign failed'));
    const onChange = jest.fn();

    render(
      <ImageUploadField label="Product image" value="" organisationId="org-1" onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: [makeFile()] } });

    expect(await screen.findByText('Upload failed. Please try again.')).toBeInTheDocument();
    expect(uploadFileToS3).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    // preview is cleared, so the empty placeholder comes back
    expect(screen.getByText('Upload image')).toBeInTheDocument();
    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
  });

  it('surfaces an upload error when the s3 put rejects', async () => {
    (getInventoryItemImagePresignedUrl as jest.Mock).mockResolvedValue({
      uploadUrl: 'https://upload.example.com',
      s3Key: 'inventory/org-1/new-item.png',
    });
    (uploadFileToS3 as jest.Mock).mockRejectedValue(new Error('s3 down'));
    const onChange = jest.fn();

    render(
      <ImageUploadField label="Product image" value="" organisationId="org-1" onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: [makeFile()] } });

    expect(await screen.findByText('Upload failed. Please try again.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('clears the stored image and any error when remove is clicked', () => {
    const onChange = jest.fn();
    render(
      <ImageUploadField
        label="Product image"
        value="inventory/org-1/item-1.jpg"
        organisationId="org-1"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));

    expect(onChange).toHaveBeenCalledWith('');
    // nothing to revoke: the visible image is a stored s3 key, not a blob preview
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the in-flight blob preview when the field unmounts mid-upload', async () => {
    let resolvePresigned: (value: { uploadUrl: string; s3Key: string }) => void = () => {};
    (getInventoryItemImagePresignedUrl as jest.Mock).mockReturnValue(
      new Promise<{ uploadUrl: string; s3Key: string }>((resolve) => {
        resolvePresigned = resolve;
      })
    );
    (uploadFileToS3 as jest.Mock).mockResolvedValue(undefined);

    const { unmount } = render(
      <ImageUploadField
        label="Product image"
        value=""
        organisationId="org-1"
        onChange={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Product image'), { target: { files: [makeFile()] } });
    expect(screen.getByText('Uploading…')).toBeInTheDocument();

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    // settle the in-flight promise so nothing leaks past the test
    await act(async () => {
      resolvePresigned({
        uploadUrl: 'https://upload.example.com',
        s3Key: 'inventory/org-1/new-item.png',
      });
    });
  });
});
