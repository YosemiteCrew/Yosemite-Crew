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
          const uploaded = await props.uploadFile(file);
          props.onChange(uploaded.s3Key, file.type, file.size);
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

  it('passes props and uploads the PDF with its companion ID', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { s3Key: 's3/key.pdf' },
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
      expect(postData).toHaveBeenCalledWith('/api/companion/sign', expect.any(FormData), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const formData = (postData as jest.Mock).mock.calls[0][1] as FormData;
      expect((formData.get('file') as File).name).toBe('doc.pdf');
      expect(formData.get('patientId')).toBe('comp-99');
    });
    expect(onChange).toHaveBeenCalledWith('s3/key.pdf', 'application/pdf', expect.any(Number));

    const lastProps = uploaderSpy.mock.calls.at(-1)?.[0];
    expect(lastProps.placeholder).toBe('Upload companion doc');
  });
});
