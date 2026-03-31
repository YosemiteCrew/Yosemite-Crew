import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionDoc from '@/app/ui/widgets/UploadImage/CompanionDoc';
import { postData } from '@/app/services/axios';

const uploaderSpy = jest.fn();

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));

jest.mock('@/app/ui/widgets/UploadImage/PdfDocUploader', () => ({
  __esModule: true,
  default: (props: any) => {
    uploaderSpy(props);
    return (
      <button
        type="button"
        onClick={async () => {
          const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
          const signed = await props.getSignedUrl(file);
          props.onChange(signed.s3Key, file.type, file.size);
        }}
      >
        trigger-upload
      </button>
    );
  },
}));

describe('CompanionDoc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes props and resolves signed URL via api body', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { url: 'https://s3-url', key: 's3/key.pdf' },
    });
    const onChange = jest.fn();

    render(
      <CompanionDoc
        placeholder="Upload companion doc"
        onChange={onChange}
        apiUrl="/api/companion/sign"
        file={null}
        setFile={jest.fn()}
        companionId="comp-99"
      />
    );

    fireEvent.click(screen.getByText('trigger-upload'));

    await waitFor(() => {
      expect(postData).toHaveBeenCalledWith('/api/companion/sign', {
        mimeType: 'application/pdf',
        companionId: 'comp-99',
      });
    });
    expect(onChange).toHaveBeenCalledWith('s3/key.pdf', 'application/pdf', expect.any(Number));

    const lastProps = uploaderSpy.mock.calls.at(-1)?.[0];
    expect(lastProps.placeholder).toBe('Upload companion doc');
  });
});
