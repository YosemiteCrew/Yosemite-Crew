import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUploadField from '@/app/features/inventory/components/AddInventory/ImageUploadField';
import {
  getInventoryItemImagePresignedUrl,
  uploadFileToS3,
} from '@/app/features/inventory/services/inventoryUploadService';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => React.createElement('img', { alt, src }),
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
    const file = new File(['file'], 'item.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(getInventoryItemImagePresignedUrl).toHaveBeenCalledWith('org-1', 'image/png')
    );
    expect(uploadFileToS3).toHaveBeenCalledWith('https://upload.example.com', file);
    expect(onChange).toHaveBeenCalledWith('inventory/org-1/new-item.png');
  });
});
