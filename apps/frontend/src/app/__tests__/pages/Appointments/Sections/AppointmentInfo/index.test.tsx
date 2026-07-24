import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentInfoModal from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import {
  createSubmission,
  fetchSubmissions,
} from '@/app/features/appointments/services/soapService';
import {
  fetchAppointmentForms,
  linkAppointmentForms,
} from '@/app/features/forms/services/appointmentFormsService';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import { useAuthStore } from '@/app/stores/authStore';

const labelsSpy = jest.fn();
let labelsRenderCount = 0;
const mockRouterPush = jest.fn();

const appointmentInfoSectionSpy = jest.fn();
const historySectionSpy = jest.fn();
const orgStoreState = {
  orgsById: {
    'org-1': { type: 'HOSPITAL' },
  },
};
const formsStoreState: {
  formsById: Record<string, any>;
  formIds: string[];
} = {
  formsById: {
    'form-1': {
      _id: 'form-1',
      name: 'SOAP Template',
      category: 'Prescription',
      schema: [],
      requiredSigner: '',
    },
    'form-2': {
      _id: 'form-2',
      name: 'Hospital SOAP Template',
      category: 'SOAP',
      schema: [],
      requiredSigner: '',
    },
    'form-vet': {
      _id: 'form-vet',
      name: 'Vet Signature Template',
      category: 'SOAP',
      schema: [{ type: 'signature', id: 'sig', label: 'Signature' }],
      requiredSigner: 'VET',
    },
    'form-required': {
      _id: 'form-required',
      name: 'Required Field Template',
      category: 'SOAP',
      schema: [{ type: 'text', id: 'name', label: 'Full Name', required: true }],
      requiredSigner: '',
    },
    'form-client': {
      _id: 'form-client',
      name: 'Client Signer Template',
      category: 'SOAP',
      schema: [{ type: 'signature', id: 'sig', label: 'Signature' }],
      requiredSigner: 'CLIENT',
    },
  },
  formIds: ['form-1', 'form-2', 'form-vet', 'form-required', 'form-client'],
};
const DEFAULT_FORM_IDS = ['form-1', 'form-2', 'form-vet', 'form-required', 'form-client'];
let servicesReturn: any[] = [];
let signingOverlayOpen = false;

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@/app/features/appointments/components/AppointmentStatusPill', () => ({
  __esModule: true,
  default: ({ appointment }: any) => <div>Status: {appointment.status}</div>,
}));

jest.mock('@/app/ui/widgets/Labels/Labels', () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel, setActiveSubLabel }: any) => {
    labelsRenderCount += 1;
    if (labelsRenderCount > 25) {
      throw new Error('Labels rendered too many times');
    }
    labelsSpy(labels);
    return (
      <div>
        {labels.map((label: any) => (
          <div key={label.key}>
            <button type="button" onClick={() => setActiveLabel(label.key)}>
              {typeof label.name === 'string' ? label.name : label.key}
            </button>
            {(label.labels ?? []).map((subLabel: any) => (
              <button
                key={subLabel.key}
                type="button"
                onClick={() => setActiveSubLabel(subLabel.key)}
              >
                {typeof subLabel.name === 'string' ? subLabel.name : subLabel.key}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo',
  () => ({
    __esModule: true,
    default: (props: any) => {
      appointmentInfoSectionSpy(props);
      return <div>appointment-info-section</div>;
    },
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/Companion',
  () => ({
    __esModule: true,
    default: () => <div>companion-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/History',
  () => ({
    __esModule: true,
    default: (props: any) => {
      historySectionSpy(props);
      return <div>history-section</div>;
    },
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Subjective',
  () => ({
    __esModule: true,
    default: () => <div>subjective-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Objective',
  () => ({
    __esModule: true,
    default: () => <div>objective-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Assessment',
  () => ({
    __esModule: true,
    default: () => <div>assessment-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan',
  () => ({
    __esModule: true,
    default: () => <div>plan-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit',
  () => ({
    __esModule: true,
    default: () => <div>audit-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Discharge',
  () => ({
    __esModule: true,
    default: () => <div>discharge-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents',
  () => ({
    __esModule: true,
    default: () => <div>documents-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat',
  () => ({
    __esModule: true,
    default: () => <div>chat-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Task',
  () => ({
    __esModule: true,
    default: () => <div>task-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/ParentTask',
  () => ({
    __esModule: true,
    default: () => <div>parent-task-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/Summary',
  () => ({
    __esModule: true,
    default: () => <div>summary-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/Details',
  () => ({
    __esModule: true,
    default: () => <div>details-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests',
  () => ({
    __esModule: true,
    default: () => <div>labs-section</div>,
  })
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch',
  () => ({
    __esModule: true,
    default: () => <div>merck-section</div>,
  })
);

jest.mock('@/app/features/appointments/services/soapService', () => ({
  fetchSubmissions: jest.fn(),
  createSubmission: jest.fn(),
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  fetchAppointmentForms: jest.fn().mockResolvedValue({ forms: [] }),
  linkAppointmentForms: jest.fn(),
  submitAppointmentForm: jest.fn(),
  getAppointmentFormSubmission: jest.fn(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: jest.fn(() => ({
    can: jest.fn(() => true),
  })),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector: any) => selector(orgStoreState)),
}));

jest.mock('@/app/stores/formsStore', () => ({
  useFormsStore: jest.fn((selector: any) => selector(formsStoreState)),
}));

jest.mock('@/app/hooks/useForms', () => ({
  useLoadFormsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      attributes: { sub: 'user-1' },
    })),
  },
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useServicesForPrimaryOrgSpecialities: jest.fn(() => servicesReturn),
}));

jest.mock('@/app/stores/signingOverlayStore', () => ({
  useSigningOverlayStore: jest.fn((selector: any) => selector({ open: signingOverlayOpen })),
}));

jest.mock('@/app/hooks/useMerckIntegration', () => ({
  useResolvedMerckIntegrationForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/ui/overlays/SigningOverlay', () => ({
  __esModule: true,
  default: () => <div>signing-overlay</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children, title, rightElement }: any) => (
    <div>
      <div>{title}</div>
      {rightElement}
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <div>
      <span>form-renderer</span>
      <button type="button" onClick={() => onChange?.('field-1', 'val-1')}>
        trigger-form-change
      </button>
    </div>
  ),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SignatureActions',
  () => ({
    __esModule: true,
    default: ({ submission, onStatusChange }: any) => (
      <button
        type="button"
        onClick={() => onStatusChange?.(submission?._id, { signing: { status: 'SIGNED' } })}
      >
        signature-actions
      </button>
    ),
  })
);

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => (
    <span data-testid="mock-next-image" data-alt={String(alt ?? '')} data-src={String(src ?? '')}>
      {alt}
    </span>
  ),
}));

jest.mock('@/app/ui/inputs/SearchDropdown', () => ({
  __esModule: true,
  default: ({ options, onSelect }: any) => (
    <div>
      <button
        type="button"
        onClick={() => {
          if (options.length > 0) {
            onSelect(options[0].value);
          }
        }}
      >
        pick-template
      </button>
      <button type="button" onClick={() => onSelect('__unknown-template__')}>
        pick-unknown
      </button>
      {options.map((option: { label: string; value: string }) => (
        <button key={option.value} type="button" onClick={() => onSelect(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

describe('AppointmentInfo modal', () => {
  beforeAll(() => {
    (console.error as jest.Mock).mockImplementation(() => {});
  });

  const setShowModal = jest.fn();

  const appointment: any = {
    id: 'appt-1',
    companion: {
      id: 'comp-1',
      name: 'Buddy',
      breed: 'Labrador',
      species: 'dog',
      photoUrl: 'https://example.com/buddy.png',
      parent: { id: 'parent-1' },
    },
    organisationId: 'org-1',
    appointmentType: { id: 'svc-1' },
    status: 'UPCOMING',
  };

  beforeEach(() => {
    appointmentInfoSectionSpy.mockClear();
    historySectionSpy.mockClear();
    labelsSpy.mockClear();
    labelsRenderCount = 0;
    setShowModal.mockClear();
    mockRouterPush.mockClear();
    servicesReturn = [];
    signingOverlayOpen = false;
    orgStoreState.orgsById['org-1'].type = 'HOSPITAL';
    formsStoreState.formIds = [...DEFAULT_FORM_IDS];
    formsStoreState.formsById['form-1'].requiredSigner = '';
    formsStoreState.formsById['form-2'].category = 'SOAP';
    (useAuthStore.getState as jest.Mock).mockReturnValue({ attributes: { sub: 'user-1' } });
    (fetchSubmissions as jest.Mock).mockResolvedValue({
      soapNotes: {
        Subjective: [],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      },
    });
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({ forms: [] });
    (createSubmission as jest.Mock).mockResolvedValue({
      _id: 'submission-1',
      status: 'submitted',
    });
    (linkAppointmentForms as jest.Mock).mockResolvedValue(undefined);
    (useResolvedMerckIntegrationForPrimaryOrg as jest.Mock).mockReturnValue({ isEnabled: false });
  });

  it('renders header without fetching SOAP submissions by default', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
    expect(screen.getByText('Status: UPCOMING')).toBeInTheDocument();
    expect(screen.getByText(/Upcoming:/)).toBeInTheDocument();
    expect(screen.getByText('appointment-info-section')).toBeInTheDocument();
    expect(fetchSubmissions).not.toHaveBeenCalled();
  });

  it('shows companion profile photo in the modal header when available', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    const headerImage = screen
      .getAllByTestId('mock-next-image')
      .find((node) => node.getAttribute('data-alt') === 'pet image');

    expect(headerImage).toBeDefined();
    expect(headerImage).toHaveAttribute('data-src', 'https://example.com/buddy.png');
  });

  it('falls back to species avatar in the modal header when profile photo is missing', () => {
    const noPhotoAppointment = {
      ...appointment,
      companion: {
        ...appointment.companion,
        species: 'cat',
        photoUrl: '',
      },
    };

    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={noPhotoAppointment}
      />
    );

    const headerImage = screen
      .getAllByTestId('mock-next-image')
      .find((node) => node.getAttribute('data-alt') === 'pet image');

    expect(headerImage).toBeDefined();
    expect(headerImage?.getAttribute('data-src')).toContain('/avatar/cat.png');
  });

  it('switches to prescription templates section', async () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));

    expect(screen.getByText(/loading forms/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchSubmissions).toHaveBeenCalledWith('appt-1');
    });
  });

  it('includes SOAP category templates in hospital medical records search', async () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));

    expect(
      await screen.findByRole('button', { name: 'Hospital SOAP Template' })
    ).toBeInTheDocument();
  });

  it('passes canEdit false to sections for completed appointments', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'COMPLETED' }}
      />
    );

    expect(appointmentInfoSectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canEdit: false })
    );
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
  });

  it('shows no-show and cancelled state messages in the modal header', () => {
    const { rerender } = render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'NO_SHOW' }}
      />
    );

    expect(screen.getByText(/No show:/)).toBeInTheDocument();

    rerender(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'CANCELLED' }}
      />
    );

    expect(screen.getByText(/Cancelled:/)).toBeInTheDocument();
  });

  it('routes modal quick actions to the matching workspace step', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open medical records in workspace' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/appointments/appt-1/workspace?step=SOAP');
    expect(setShowModal).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Open finance in workspace' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/appointments/appt-1/workspace?step=INVOICE');

    fireEvent.click(screen.getByRole('button', { name: 'Open labs in workspace' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/appointments/appt-1/workspace?step=DIAGNOSTICS');
  });

  it('keeps finance summary tab available', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    expect(screen.getByText('summary-section')).toBeInTheDocument();
  });

  it('renders history section with in-modal navigation callback', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

    expect(screen.getByText('history-section')).toBeInTheDocument();
    expect(historySectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenAppointmentView: expect.any(Function),
      })
    );
  });

  it('closes the modal when close icon is clicked', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('switches to task-related sections', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(screen.getByText('task-section')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Companion parent chat' }));
    expect(screen.getByText('chat-section')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Parent task' }));
    expect(screen.getByText('parent-task-section')).toBeInTheDocument();
  });

  it('switches to finance invoices and labs sections', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invoices' }));
    expect(screen.getByText('details-section')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Labs' }));
    fireEvent.click(screen.getByRole('button', { name: 'idexx-labs' }));
    expect(screen.getByText('labs-section')).toBeInTheDocument();
  });

  it('falls back to default task section when initial view intent is provided', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={appointment}
        initialViewIntent={{ label: 'tasks', subLabel: 'parent-task' }}
      />
    );

    expect(screen.getByText('chat-section')).toBeInTheDocument();
  });

  it('hides merck manuals label when integration is disabled', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    const latestLabels = labelsSpy.mock.calls.at(-1)?.[0] ?? [];
    const prescription = latestLabels.find((label: any) => label.key === 'prescription');
    expect(prescription.labels.some((label: any) => label.key === 'merck-manuals')).toBe(false);
  });

  it('shows merck manuals label when integration is enabled', () => {
    (useResolvedMerckIntegrationForPrimaryOrg as jest.Mock).mockReturnValue({ isEnabled: true });

    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    const latestLabels = labelsSpy.mock.calls.at(-1)?.[0] ?? [];
    const prescription = latestLabels.find((label: any) => label.key === 'prescription');
    expect(prescription.labels.some((label: any) => label.key === 'merck-manuals')).toBe(true);
  });

  it('uses care-plan labels for non-hospital org types', () => {
    orgStoreState.orgsById['org-1'].type = 'BOARDER' as any;

    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    const latestLabels = labelsSpy.mock.calls.at(-1)?.[0] ?? [];
    expect(latestLabels.some((label: any) => label.key === 'care')).toBe(true);
    expect(latestLabels.some((label: any) => label.key === 'prescription')).toBe(false);

    orgStoreState.orgsById['org-1'].type = 'HOSPITAL' as any;
  });

  it('falls back to first sublabel when initial intent sublabel is invalid', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={appointment}
        initialViewIntent={{ label: 'finance', subLabel: 'not-real' }}
      />
    );

    expect(screen.getByText('summary-section')).toBeInTheDocument();
  });

  it('shows form loading error when appointment form fetch fails', async () => {
    (fetchAppointmentForms as jest.Mock).mockRejectedValue(new Error('forms failed'));

    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));

    expect(await screen.findByText('Unable to load forms')).toBeInTheDocument();
  });

  it('submits a selected template for hospital workflow', async () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));
    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'appt-1',
          formId: 'form-1',
        })
      );
    });
    expect(linkAppointmentForms).not.toHaveBeenCalled();
  });

  it('sends selected template to parent for client signer forms', async () => {
    formsStoreState.formsById['form-1'].requiredSigner = 'CLIENT';

    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));
    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to parent' }));

    await waitFor(() => {
      expect(linkAppointmentForms).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          appointmentId: 'appt-1',
          formIds: ['form-1'],
        })
      );
    });
    expect(createSubmission).not.toHaveBeenCalled();
  });

  const renderModal = (props: any = {}) =>
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={appointment}
        {...props}
      />
    );

  const openMedicalRecordsSoap = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));
  };

  it('renders workspace-state summaries for progressing, checked-in, requested, and unknown statuses', () => {
    const { rerender } = renderModal({
      activeAppointment: { ...appointment, status: 'IN_PROGRESS' },
    });
    expect(
      screen.getByText(
        /Continue in the workspace for clinical records, labs, treatment, and billing/
      )
    ).toBeInTheDocument();

    rerender(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'CHECKED_IN' }}
      />
    );
    expect(
      screen.getByText(/checked in and ready to continue in the workspace/)
    ).toBeInTheDocument();

    rerender(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'REQUESTED' }}
      />
    );
    expect(screen.getByText(/request is waiting for confirmation/)).toBeInTheDocument();

    rerender(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'SOMETHING_UNKNOWN' }}
      />
    );
    expect(screen.getByText('Review appointment details and related records.')).toBeInTheDocument();
  });

  it('maps display-name species to their avatar image types when no photo is present', () => {
    const { rerender } = render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...appointment,
          companion: { ...appointment.companion, species: 'canine', photoUrl: '' },
        }}
      />
    );
    let headerImage = screen
      .getAllByTestId('mock-next-image')
      .find((node) => node.getAttribute('data-alt') === 'pet image');
    expect(headerImage?.getAttribute('data-src')).toContain('avatar/dog.png');

    rerender(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...appointment,
          companion: { ...appointment.companion, species: 'reptile', photoUrl: '' },
        }}
      />
    );
    headerImage = screen
      .getAllByTestId('mock-next-image')
      .find((node) => node.getAttribute('data-alt') === 'pet image');
    expect(headerImage?.getAttribute('data-src')).toContain('avatar/dog.png');
  });

  it('defaults org type to HOSPITAL when the appointment organisation is unknown', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, organisationId: 'org-unknown' }}
      />
    );

    const latestLabels = labelsSpy.mock.calls.at(-1)?.[0] ?? [];
    expect(latestLabels.some((label: any) => label.key === 'prescription')).toBe(true);
  });

  it('navigates to companion history and closes the modal from the header history action', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Open companion history' }));

    expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('/companions/history'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('renders nothing and skips form loading when there is no active appointment', async () => {
    render(<AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={null} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchAppointmentForms).not.toHaveBeenCalled());
  });

  it('resets to the default tab when a different appointment opens without an intent', async () => {
    const { rerender } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    expect(screen.getByText('summary-section')).toBeInTheDocument();

    rerender(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, id: 'appt-2' }}
      />
    );

    await waitFor(() => expect(screen.getByText('appointment-info-section')).toBeInTheDocument());
  });

  it('falls back to the first label when the active label disappears after an org change', async () => {
    const { rerender } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    orgStoreState.orgsById['org-1'].type = 'BOARDER' as any;

    rerender(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    await waitFor(() => expect(screen.getByText('appointment-info-section')).toBeInTheDocument());
  });

  it('falls back to the first sublabel when the initial intent omits a sublabel', () => {
    renderModal({ initialViewIntent: { label: 'finance' } });

    expect(screen.getByText('summary-section')).toBeInTheDocument();
  });

  it('maps a care intent to the prescription tab for hospital orgs', async () => {
    renderModal({ initialViewIntent: { label: 'care', subLabel: 'forms' } });

    expect(await screen.findByRole('button', { name: 'pick-template' })).toBeInTheDocument();
  });

  it('maps a prescription intent to the care tab for non-hospital orgs', async () => {
    orgStoreState.orgsById['org-1'].type = 'BOARDER' as any;

    renderModal({ initialViewIntent: { label: 'prescription', subLabel: 'forms' } });

    expect(await screen.findByText('No past form submissions.')).toBeInTheDocument();
  });

  it('resolves in-modal history navigation intents to labels and sublabels', () => {
    renderModal();

    const openView = appointmentInfoSectionSpy.mock.calls.at(-1)?.[0]?.onOpenAppointmentView;
    expect(typeof openView).toBe('function');

    act(() => openView({ label: 'info', subLabel: 'overview' }));
    expect(screen.getByText('history-section')).toBeInTheDocument();

    act(() => openView({ label: 'info' }));
    expect(screen.getByText('appointment-info-section')).toBeInTheDocument();

    act(() => openView({ label: 'finance', subLabel: 'not-real' }));
    expect(screen.getByText('summary-section')).toBeInTheDocument();

    act(() => openView({ label: 'no-such-label' }));
    expect(screen.getByText('summary-section')).toBeInTheDocument();
  });

  it('normalizes service cost values of every type when computing invoice totals', () => {
    const { rerender } = renderModal();

    const costs: unknown[] = [10, '15.5', 'abc', null, true];
    costs.forEach((cost) => {
      servicesReturn = [{ id: 'svc-1', cost }];
      rerender(
        <AppointmentInfoModal
          showModal
          setShowModal={setShowModal}
          activeAppointment={appointment}
        />
      );
    });

    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('reloads appointment forms when the signing overlay closes', async () => {
    signingOverlayOpen = true;
    const { rerender } = renderModal();

    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalled());
    (fetchAppointmentForms as jest.Mock).mockClear();

    signingOverlayOpen = false;
    rerender(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalledTimes(1));
  });

  it('updates template values when a template field changes', async () => {
    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'trigger-form-change' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('marks a vet template submission as signature-required on save', async () => {
    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Vet Signature Template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createSubmission).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-vet' }))
    );
  });

  it('blocks template save when required fields are missing', async () => {
    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Required Field Template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(/Please complete the required field\(s\): Full Name/)
    ).toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('shows an error when template submission fails', async () => {
    (createSubmission as jest.Mock).mockRejectedValue(new Error('save failed'));

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to submit form. Please try again.')).toBeInTheDocument();
  });

  it('shows a template-not-found error when the selected template disappears', async () => {
    const { rerender } = renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));

    formsStoreState.formIds = [];
    rerender(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Template not found')).toBeInTheDocument();
  });

  it('shows an org-not-found error when sending a client template without an organisation', async () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, organisationId: undefined }}
      />
    );
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Client Signer Template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to parent' }));

    expect(await screen.findByText('Organisation not found.')).toBeInTheDocument();
    expect(linkAppointmentForms).not.toHaveBeenCalled();
  });

  it('shows an error when sending a client template to the parent fails', async () => {
    (linkAppointmentForms as jest.Mock).mockRejectedValue(new Error('link failed'));

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Client Signer Template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to parent' }));

    expect(await screen.findByText('Failed to send form. Please try again.')).toBeInTheDocument();
  });

  it('fills and submits an editable appointment form entry', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { _id: 'form-1', name: 'Entry Form', requiredSigner: '', schema: [] },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'trigger-form-change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createSubmission).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-1' }))
    );
  });

  it('marks an editable vet form entry submission as signature-required on save', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: {
            _id: 'form-vet',
            name: 'Vet Entry',
            requiredSigner: 'VET',
            schema: [{ type: 'signature', id: 'sig', label: 'Signature' }],
          },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createSubmission).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-vet' }))
    );
  });

  it('blocks editable form entry save when required fields are missing', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: {
            _id: 'form-required',
            name: 'Required Entry',
            requiredSigner: '',
            schema: [{ type: 'text', id: 'name', label: 'Full Name', required: true }],
          },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(/Please complete the required field\(s\): Full Name/)
    ).toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('shows an error when editable form entry submission fails', async () => {
    (createSubmission as jest.Mock).mockRejectedValue(new Error('save failed'));
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { _id: 'form-1', name: 'Entry Form', requiredSigner: '', schema: [] },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to submit form. Please try again.')).toBeInTheDocument();
  });

  it('updates an existing form entry when its template is re-submitted', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { _id: 'form-1', name: 'Existing Form', requiredSigner: '', schema: [] },
          submission: { _id: 'existing-sub', formId: 'form-1', answers: {} },
          status: 'completed',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createSubmission).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-1' }))
    );
  });

  it('renders signature badges, client-signer notices, and handles status updates', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: {
            _id: 'form-vet',
            name: 'Vet Form',
            requiredSigner: 'VET',
            schema: [{ type: 'signature', id: 'sig', label: 'Signature' }],
          },
          submission: {
            _id: 'sub-1',
            formId: 'form-vet',
            answers: {},
            signing: { status: 'NOT_STARTED' },
          },
          status: 'completed',
        },
        {
          form: {
            _id: 'form-client',
            name: 'Signed Client Form',
            requiredSigner: 'CLIENT',
            schema: [],
          },
          submission: {
            _id: 'sub-2',
            formId: 'form-client',
            answers: {},
            signing: { status: 'SIGNED' },
          },
          status: 'completed',
        },
        {
          form: {
            _id: 'form-client-2',
            name: 'Pending Client Form',
            requiredSigner: 'CLIENT',
            schema: [],
          },
          submission: { _id: 'sub-3', formId: 'form-client-2', answers: {} },
          status: 'pending',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    expect(await screen.findByText('Signature Pending')).toBeInTheDocument();
    expect(screen.getByText('Signed by pet parent.')).toBeInTheDocument();
    expect(
      screen.getByText('Sent to pet parent. It will update when they sign the document.')
    ).toBeInTheDocument();

    const actionButtons = screen.getAllByRole('button', { name: 'signature-actions' });
    expect(actionButtons).toHaveLength(1);
    fireEvent.click(actionButtons[0]);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('applies signature metadata to fetched SOAP submissions', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { _id: 'form-1', name: 'Matched Form', requiredSigner: '', schema: [] },
          submission: { _id: 's2', formId: 'form-1', answers: {}, signing: { status: 'SIGNED' } },
          status: 'completed',
        },
      ],
    });
    (fetchSubmissions as jest.Mock).mockResolvedValue({
      soapNotes: {
        Subjective: [
          { _id: 's1', formId: 'form-vet', answers: {} },
          { _id: 's2', formId: 'form-1', answers: {}, signing: { status: 'SIGNED' } },
          { formId: 'form-1', answers: {} },
          { answers: {} },
        ],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      },
    });

    renderModal();
    openMedicalRecordsSoap();

    await waitFor(() => expect(fetchSubmissions).toHaveBeenCalledWith('appt-1'));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('clears SOAP form state when fetching submissions fails', async () => {
    (fetchSubmissions as jest.Mock).mockRejectedValue(new Error('soap failed'));

    renderModal();
    openMedicalRecordsSoap();

    await waitFor(() => expect(fetchSubmissions).toHaveBeenCalledWith('appt-1'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  const flushAsync = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it('falls back to the "other" avatar when the companion species is null', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...appointment,
          companion: { ...appointment.companion, species: null, photoUrl: '' },
        }}
      />
    );

    const headerImage = screen
      .getAllByTestId('mock-next-image')
      .find((node) => node.getAttribute('data-alt') === 'pet image');

    // 'other' image type resolves to the dog fallback asset.
    expect(headerImage?.getAttribute('data-src')).toContain('avatar/dog.png');
  });

  it('uses the groomer category fallback for unrecognised org types', async () => {
    orgStoreState.orgsById['org-1'].type = 'SHELTER' as any;
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: {
            _id: 'form-2',
            name: 'Groomer - Service Request & Preferences',
            requiredSigner: '',
            schema: [],
          },
          submission: null,
          status: 'pending',
        },
      ],
    });
    formsStoreState.formsById['form-2'].category = 'Service Request & Preferences';
    // A form id with no matching entry in the store exercises the empty-flatMap branch.
    formsStoreState.formIds = [...DEFAULT_FORM_IDS, 'ghost-id'];

    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    // Non-hospital orgs surface the "Care plan" grouping, exercising the fallback path.
    const latestLabels = labelsSpy.mock.calls.at(-1)?.[0] ?? [];
    expect(latestLabels.some((label: any) => label.key === 'care')).toBe(true);
    await flushAsync();
    formsStoreState.formsById['form-2'].category = 'SOAP';
  });

  it('renders varied custom form entry shapes (missing signer, missing id, vet without schema, pdf-signed)', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          // requiredSigner missing -> `?? ''` fallback, and not VET
          form: { _id: 'entry-nosigner', name: 'No Signer Entry', schema: [] },
          submission: null,
          status: 'pending',
        },
        {
          // form._id missing -> formId falls back to name; schema missing -> `?? []`
          form: { name: 'No Id Entry', requiredSigner: '', schema: undefined },
          submission: null,
          status: 'pending',
        },
        {
          // VET but no signature field in schema -> hasSignatureField([]) === false
          form: {
            _id: 'entry-vet-noschema',
            name: 'Vet No Schema',
            requiredSigner: 'VET',
            schema: undefined,
          },
          submission: null,
          status: 'pending',
        },
        {
          // Signed via signing.pdf.url even though status is not SIGNED
          form: {
            _id: 'entry-pdf',
            name: 'Pdf Signed Entry',
            requiredSigner: 'VET',
            schema: [{ type: 'signature', id: 'sig', label: 'Signature' }],
          },
          submission: {
            _id: 'sub-pdf',
            formId: 'entry-pdf',
            answers: {},
            signing: { status: 'NOT_STARTED', pdf: { url: 'https://example.com/signed.pdf' } },
          },
          status: 'completed',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    expect(await screen.findByText('No Signer Entry')).toBeInTheDocument();
    expect(screen.getByText('No Id Entry')).toBeInTheDocument();
    expect(screen.getByText('Vet No Schema')).toBeInTheDocument();
    expect(screen.getByText('Pdf Signed Entry')).toBeInTheDocument();
    await flushAsync();
  });

  it('submits an editable entry (no form id, empty companion identifiers) and updates it in place', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { name: 'Editable No Id', requiredSigner: '', schema: undefined },
          submission: null,
          status: 'pending',
        },
      ],
    });

    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...appointment,
          companion: { name: 'Orphan', breed: 'Mixed', species: 'dog' },
        }}
      />
    );
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ companionId: '', parentId: '' })
      )
    );
    await flushAsync();
  });

  it('returns early from an entry save when the signed-in user is missing', async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ attributes: null });
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { _id: 'form-1', name: 'No User Entry', requiredSigner: '', schema: [] },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await flushAsync();

    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('labels an unknown template selection with the raw id and blocks its save', async () => {
    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-unknown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Template not found')).toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
    await flushAsync();
  });

  it('returns early from a template save when the appointment has no id', async () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, id: undefined }}
      />
    );
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flushAsync();

    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('returns early from a client-template send when the appointment has no id', async () => {
    formsStoreState.formsById['form-1'].requiredSigner = 'CLIENT';

    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, id: undefined }}
      />
    );
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'pick-template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to parent' }));
    await flushAsync();

    expect(linkAppointmentForms).not.toHaveBeenCalled();
  });

  it('sends a client template that has no _id using its value as the form id', async () => {
    formsStoreState.formsById['form-client-noid'] = {
      name: 'Client No Id Template',
      category: 'SOAP',
      schema: [],
      requiredSigner: 'CLIENT',
    };
    formsStoreState.formIds = [...DEFAULT_FORM_IDS, 'form-client-noid'];

    renderModal();
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'Client No Id Template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to parent' }));

    await waitFor(() =>
      expect(linkAppointmentForms).toHaveBeenCalledWith(
        expect.objectContaining({ formIds: ['Client No Id Template'] })
      )
    );
    await flushAsync();
  });

  it('saves a hospital template whose requiredSigner is undefined', async () => {
    formsStoreState.formsById['form-nosigner'] = {
      _id: 'form-nosigner',
      name: 'No Signer Template',
      category: 'SOAP',
      schema: [],
    };
    formsStoreState.formIds = [...DEFAULT_FORM_IDS, 'form-nosigner'];

    // Companion without id/parent exercises the empty-string identifier fallbacks.
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...appointment,
          companion: { name: 'Orphan', breed: 'Mixed', species: 'dog' },
        }}
      />
    );
    openMedicalRecordsSoap();

    fireEvent.click(await screen.findByRole('button', { name: 'No Signer Template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ formId: 'form-nosigner', companionId: '', parentId: '' })
      )
    );
    await flushAsync();
  });

  it('hides the template picker for completed appointments and shows the empty-state', async () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, status: 'COMPLETED' }}
      />
    );
    openMedicalRecordsSoap();

    expect(await screen.findByText('No past form submissions.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'pick-template' })).not.toBeInTheDocument();
  });

  it('clears the applied intent when the modal is hidden', async () => {
    const { rerender } = render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={appointment}
        initialViewIntent={{ label: 'finance', subLabel: 'summary' }}
      />
    );

    expect(screen.getByText('summary-section')).toBeInTheDocument();

    rerender(
      <AppointmentInfoModal
        showModal={false}
        setShowModal={setShowModal}
        activeAppointment={appointment}
        initialViewIntent={{ label: 'finance', subLabel: 'summary' }}
      />
    );

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    await flushAsync();
  });

  it('falls back to the patient record when the companion is absent', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...appointment,
          companion: undefined,
          patient: { id: 'pat-1', name: 'PatientPet', breed: 'Beagle', species: 'dog' },
        }}
      />
    );

    expect(screen.getByText('PatientPet')).toBeInTheDocument();
    expect(screen.getByText('Beagle')).toBeInTheDocument();
  });

  it('ignores workspace quick actions when the appointment has no id', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={setShowModal}
        activeAppointment={{ ...appointment, id: undefined }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open finance in workspace' }));

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(setShowModal).not.toHaveBeenCalled();
  });

  it('applies signature metadata across matched submissions, pdf/document signing, and unknown forms', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValue({
      forms: [
        {
          form: { _id: 'form-vet', name: 'Meta Vet Form', requiredSigner: 'VET', schema: [] },
          submission: { submissionId: 'meta-1', formId: 'form-vet', answers: {} },
          status: 'completed',
        },
        {
          form: {
            _id: 'form-unknown',
            name: 'Meta Unknown Form',
            requiredSigner: 'VET',
            schema: [{ type: 'signature', id: 'sig' }],
          },
          submission: { submissionId: 'meta-2', formId: 'unknown-form', answers: {} },
          status: 'completed',
        },
      ],
    });
    (fetchSubmissions as jest.Mock).mockResolvedValue({
      soapNotes: {
        Subjective: [
          // Matched to a custom-form entry via submissionId (no _id on the SOAP note)
          {
            submissionId: 'meta-1',
            formId: 'form-vet',
            answers: {},
            signing: { status: 'SIGNED' },
          },
          // Matched via submissionId to an entry whose form is unknown to formsById
          { submissionId: 'meta-2', formId: 'unknown-form', answers: {} },
          // hasSigningData through signing.documentId only
          { _id: 'doc-only', formId: 'form-1', answers: {}, signing: { documentId: 'doc-9' } },
          // hasSigningData through signing.pdf.url on a VET form
          {
            _id: 'pdf-only',
            formId: 'form-vet',
            answers: {},
            signing: { pdf: { url: 'https://x/y.pdf' } },
          },
          // signatureRequired flag drives requiresSignature
          { _id: 'flagged', formId: 'form-vet', answers: {}, signatureRequired: true },
        ],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      },
    });

    renderModal();
    openMedicalRecordsSoap();

    await waitFor(() => expect(fetchSubmissions).toHaveBeenCalledWith('appt-1'));
    await flushAsync();

    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });
});
