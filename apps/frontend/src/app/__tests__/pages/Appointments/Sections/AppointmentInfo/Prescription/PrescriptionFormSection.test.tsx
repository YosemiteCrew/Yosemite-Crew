import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrescriptionFormSection from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection';

const useFormsForPrimaryOrgByCategoryMock = jest.fn();
const createSubmissionMock = jest.fn();
const linkAppointmentFormsMock = jest.fn();
const hasSignatureFieldMock = jest.fn();

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/inputs/SearchDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect }: any) => (
    <div>
      <div>{placeholder}</div>
      {options.map((opt: any) => (
        <button key={opt.value} type="button" onClick={() => onSelect(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer', () => ({
  __esModule: true,
  default: ({ fields }: any) => <div data-testid="form-renderer">{fields.length}</div>,
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SoapSubmissions',
  () => ({
    __esModule: true,
    default: ({ title }: any) => <div>{title}</div>,
  })
);

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/hooks/useForms', () => ({
  useFormsForPrimaryOrgByCategory: (...args: any[]) => useFormsForPrimaryOrgByCategoryMock(...args),
}));

jest.mock('@/app/features/appointments/services/soapService', () => ({
  createSubmission: (...args: any[]) => createSubmissionMock(...args),
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  linkAppointmentForms: (...args: any[]) => linkAppointmentFormsMock(...args),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/signatureUtils',
  () => ({
    hasSignatureField: (...args: any[]) => hasSignatureFieldMock(...args),
  })
);

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/Review', () => ({
  buildInitialValues: jest.fn(() => ({})),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      attributes: { sub: 'user-1' },
    }),
  },
}));

const appointment: any = {
  id: 'appt-1',
  organisationId: 'org-1',
  companion: {
    id: 'comp-1',
    parent: { id: 'parent-1' },
  },
};

const baseProps = {
  title: 'Prescription',
  submissionsTitle: 'Submissions',
  searchPlaceholder: 'Search forms',
  category: 'Prescription' as any,
  formDataKey: 'plan' as any,
  activeAppointment: appointment,
  canEdit: true,
};

const Harness = ({ onAfterCreate }: { onAfterCreate?: any }) => {
  const [formData, setFormData] = React.useState<any>({ plan: [], lineItems: [] });
  return (
    <PrescriptionFormSection
      {...baseProps}
      formData={formData}
      setFormData={setFormData}
      onAfterCreate={onAfterCreate}
    />
  );
};

describe('PrescriptionFormSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasSignatureFieldMock.mockReturnValue(true);
    useFormsForPrimaryOrgByCategoryMock.mockReturnValue([
      {
        _id: 'form-vet',
        name: 'Vet Form',
        schema: [{ id: 'sig', type: 'signature' }],
        requiredSigner: 'VET',
      },
      {
        _id: 'form-client',
        name: 'Client Form',
        schema: [],
        requiredSigner: 'CLIENT',
      },
    ]);
  });

  it('hides editable controls when canEdit is false', () => {
    render(
      <PrescriptionFormSection
        {...baseProps}
        canEdit={false}
        formData={{ plan: [], lineItems: [] } as any}
        setFormData={jest.fn() as any}
      />
    );

    expect(screen.queryByText('Search forms')).not.toBeInTheDocument();
    expect(screen.getByText('Submissions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('creates vet submission and merges post-create line items', async () => {
    createSubmissionMock.mockResolvedValue({ _id: 'sub-1', signing: undefined });
    const onAfterCreate = jest.fn().mockResolvedValue({
      lineItems: [{ id: 'line-1', qty: 1 }],
    });

    render(<Harness onAfterCreate={onAfterCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vet Form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createSubmissionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'form-vet',
          appointmentId: 'appt-1',
          submittedBy: 'user-1',
        })
      );
    });

    expect(onAfterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        created: expect.objectContaining({ signatureRequired: true }),
      })
    );
    expect(linkAppointmentFormsMock).not.toHaveBeenCalled();
  });

  it('sends client-signer form to parent instead of creating submission', async () => {
    linkAppointmentFormsMock.mockResolvedValue({});

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Client Form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to parent' }));

    await waitFor(() => {
      expect(linkAppointmentFormsMock).toHaveBeenCalledWith({
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        formIds: ['form-client'],
      });
    });

    expect(createSubmissionMock).not.toHaveBeenCalled();
  });
});
