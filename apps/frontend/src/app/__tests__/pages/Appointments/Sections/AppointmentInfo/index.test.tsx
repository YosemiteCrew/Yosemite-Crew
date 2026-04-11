import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const labelsSpy = jest.fn();
let labelsRenderCount = 0;

const appointmentInfoSectionSpy = jest.fn();
const historySectionSpy = jest.fn();
const orgStoreState = {
  orgsById: {
    'org-1': { type: 'HOSPITAL' },
  },
};
const formsStoreState = {
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
  },
  formIds: ['form-1', 'form-2'],
};
const services: Array<{ id: string; cost: string }> = [];

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
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
  useServicesForPrimaryOrgSpecialities: jest.fn(() => services),
}));

jest.mock('@/app/stores/signingOverlayStore', () => ({
  useSigningOverlayStore: jest.fn((selector: any) => selector({ open: false })),
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
  default: () => <div>form-renderer</div>,
}));

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
  };

  beforeEach(() => {
    appointmentInfoSectionSpy.mockClear();
    historySectionSpy.mockClear();
    labelsSpy.mockClear();
    labelsRenderCount = 0;
    setShowModal.mockClear();
    formsStoreState.formsById['form-1'].requiredSigner = '';
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

  it('fetches submissions and renders header', async () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
    expect(screen.getByText('appointment-info-section')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSubmissions).toHaveBeenCalledWith('appt-1');
    });
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

  it('switches to prescription templates section', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={setShowModal} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Medical Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'SOAP' }));

    expect(screen.getByText(/loading forms/i)).toBeInTheDocument();
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
});
