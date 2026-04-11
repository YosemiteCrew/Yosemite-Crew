import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoapSubmissions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SoapSubmissions';
import { useFormsStore } from '@/app/stores/formsStore';
import { hasSignatureField } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/signatureUtils';

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock('@/app/stores/formsStore', () => ({
  useFormsStore: jest.fn(),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SignatureActions',
  () => ({
    __esModule: true,
    default: ({ submission }: any) => (
      <div data-testid="signature-actions">{submission._id || submission.submissionId}</div>
    ),
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/signatureUtils',
  () => ({
    hasSignatureField: jest.fn(),
  })
);

const cases = [
  { key: 'assessment', title: 'Previous assessment submissions' },
  { key: 'objective', title: 'Previous objective submissions' },
  { key: 'subjective', title: 'Previous subjective submissions' },
  { key: 'discharge', title: 'Previous discharge submissions' },
  { key: 'plan', title: 'Previous plan submissions' },
] as const;

describe.each(cases)('SoapSubmissions (%s)', ({ key, title }) => {
  const setFormData = jest.fn();

  beforeEach(() => {
    (useFormsStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        formsById: {
          'form-vet': { schema: [{ id: 'sig-1', type: 'signature' }], requiredSigner: 'VET' },
          'form-client': { schema: [{ id: 'sig-2', type: 'signature' }], requiredSigner: 'CLIENT' },
        },
      })
    );
    (hasSignatureField as unknown as jest.Mock).mockReturnValue(true);
  });

  it('renders empty state', () => {
    render(
      <SoapSubmissions
        formData={{ [key]: [] } as any}
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText('No submissions yet.')).toBeInTheDocument();
  });

  it('renders submission answers', () => {
    render(
      <SoapSubmissions
        formData={
          {
            [key]: [
              {
                _id: 'sub-1',
                answers: { Diagnosis: 'Allergy' },
              },
            ],
          } as any
        }
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />
    );

    expect(screen.getByText('Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Allergy')).toBeInTheDocument();
  });

  it('renders vet signature actions when signer is VET', () => {
    render(
      <SoapSubmissions
        formData={
          {
            [key]: [
              {
                _id: 'sub-vet-1',
                formId: 'form-vet',
                answers: { diagnosis: 'Inflammation' },
              },
            ],
          } as any
        }
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />
    );

    expect(screen.getByTestId('signature-actions')).toHaveTextContent('sub-vet-1');
  });

  it('renders parent signing status for client signer submissions', () => {
    const { rerender } = render(
      <SoapSubmissions
        formData={
          {
            [key]: [
              {
                _id: 'sub-client-1',
                formId: 'form-client',
                answers: {},
                signing: { status: 'PENDING' },
              },
            ],
          } as any
        }
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />
    );

    expect(
      screen.getByText('Sent to pet parent. It will update when they sign the document.')
    ).toBeInTheDocument();

    rerender(
      <SoapSubmissions
        formData={
          {
            [key]: [
              {
                _id: 'sub-client-1',
                formId: 'form-client',
                answers: {},
                signing: { status: 'SIGNED' },
              },
            ],
          } as any
        }
        setFormData={setFormData as any}
        formDataKey={key}
        title={title}
      />
    );

    expect(screen.getByText('Signed by pet parent.')).toBeInTheDocument();
  });
});
