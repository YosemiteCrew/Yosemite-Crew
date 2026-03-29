import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentInfoModal from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import { fetchSubmissions } from '@/app/features/appointments/services/soapService';

const appointmentInfoSectionSpy = jest.fn();
const historySectionSpy = jest.fn();

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/widgets/Labels/Labels', () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel, setActiveSubLabel }: any) => (
    <div>
      {labels.map((label: any) => (
        <button key={label.key} type="button" onClick={() => setActiveLabel(label.key)}>
          {label.name}
        </button>
      ))}
      <button type="button" onClick={() => setActiveSubLabel('history')}>
        History
      </button>
      <button type="button" onClick={() => setActiveSubLabel('forms')}>
        Templates
      </button>
    </div>
  ),
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

jest.mock('@/app/features/appointments/services/soapService', () => ({
  fetchSubmissions: jest.fn(),
  createSubmission: jest.fn(),
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  fetchAppointmentForms: jest.fn().mockResolvedValue([]),
  submitAppointmentForm: jest.fn(),
  getAppointmentFormSubmission: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

describe('AppointmentInfo modal', () => {
  beforeAll(() => {
    (console.error as jest.Mock).mockImplementation(() => {});
  });

  const appointment: any = {
    id: 'appt-1',
    companion: {
      name: 'Buddy',
      breed: 'Labrador',
    },
  };

  beforeEach(() => {
    appointmentInfoSectionSpy.mockClear();
    historySectionSpy.mockClear();
    (fetchSubmissions as jest.Mock).mockResolvedValue({
      soapNotes: {
        Subjective: [],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      },
    });
  });

  it('fetches submissions and renders header', async () => {
    render(
      <AppointmentInfoModal showModal setShowModal={jest.fn()} activeAppointment={appointment} />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
    expect(screen.getByText('appointment-info-section')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSubmissions).toHaveBeenCalledWith('appt-1');
    });
  });

  it('switches to prescription templates section', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={jest.fn()} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prescription' }));
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));

    expect(screen.getByText(/loading forms/i)).toBeInTheDocument();
  });

  it('passes canEdit false to sections for completed appointments', () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={jest.fn()}
        activeAppointment={{ ...appointment, status: 'COMPLETED' }}
      />
    );

    expect(appointmentInfoSectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canEdit: false })
    );
  });

  it('keeps finance summary tab available', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={jest.fn()} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    expect(screen.getByText('summary-section')).toBeInTheDocument();
  });

  it('renders history section with in-modal navigation callback', () => {
    render(
      <AppointmentInfoModal showModal setShowModal={jest.fn()} activeAppointment={appointment} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(screen.getByText('history-section')).toBeInTheDocument();
    expect(historySectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenAppointmentView: expect.any(Function),
      })
    );
  });
});
