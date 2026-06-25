import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SoapStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SoapStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { saveSoapNote } from '@/app/features/appointments/services/workspaceClinicalService';

expect.extend(toHaveNoViolations);

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  saveSoapNote: jest.fn(),
}));

const APPT = 'appt-soap';
const APPOINTMENT_REASON = 'Limping after a long hike';
const APPOINTMENT_SERVICE = 'Orthopaedic consult';
const APPOINTMENT_SPECIALITY = 'Surgery';

const onRecordVitals = jest.fn();
const onSaveAndNext = jest.fn();

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const seedAndGet = () => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');
  useAppointmentWorkspaceStore.setState((state) => ({
    encountersById: {
      ...state.encountersById,
      [APPT]: {
        ...state.encountersById[APPT],
        leadName: 'Dr. Tim Apple',
        soapTemplates: [
          { id: 'tpl-default', name: 'Default SOAP', isDefault: true },
          { id: 'tpl-ortho', name: 'Orthopaedic exam', serviceId: 'svc-ortho' },
        ],
      },
    },
  }));
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

describe('SoapStep', () => {
  beforeEach(() => {
    reset();
    onRecordVitals.mockClear();
    onSaveAndNext.mockClear();
    (saveSoapNote as jest.Mock).mockResolvedValue({ id: 'soap-saved' });
  });

  const renderSoapStep = (encounter = seedAndGet()) =>
    render(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        appointmentService={APPOINTMENT_SERVICE}
        appointmentSpeciality={APPOINTMENT_SPECIALITY}
        encounter={encounter}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );

  it('renders the four SOAP sections and chief complaint', () => {
    renderSoapStep();
    expect(screen.getByText('Chief Complaint')).toBeInTheDocument();
    expect(screen.getByText(APPOINTMENT_REASON)).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText(APPOINTMENT_SERVICE)).toBeInTheDocument();
    expect(screen.getByText('Speciality')).toBeInTheDocument();
    expect(screen.getByText(APPOINTMENT_SPECIALITY)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Chief complaint' })).not.toBeInTheDocument();
    expect(screen.getByText('Subjective (History)')).toBeInTheDocument();
    expect(screen.getByText('Objective (Examination)')).toBeInTheDocument();
    expect(screen.getByText('Assessment (Differential)')).toBeInTheDocument();
    expect(screen.getAllByText('Plan').length).toBeGreaterThan(0);
  });

  it('shows an empty state when no SOAP notes have been recorded', () => {
    renderSoapStep();
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText('No SOAP notes recorded yet.')).toBeInTheDocument();
  });

  it('keeps SOAP template search between chief complaint and subjective', () => {
    renderSoapStep();
    const chiefComplaint = screen.getByText('Chief Complaint');
    const search = screen.getByLabelText(/search for soap template/i);
    const subjective = screen.getByText('Subjective (History)');
    expect(chiefComplaint.compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(search.compareDocumentPosition(subjective)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('searches and applies a SOAP template', () => {
    renderSoapStep();
    const search = screen.getByLabelText(/search for soap template/i);
    fireEvent.change(search, { target: { value: 'Ortho' } });
    fireEvent.click(screen.getByText('Orthopaedic exam'));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.soap[0]?.templateId).toBe(
      'tpl-ortho'
    );
  });

  it('records the SOAP note, clears the form, and advances on Save & Next', () => {
    onSaveAndNext.mockClear();
    seedAndGet();
    // A draft note must exist before it can be signed/recorded.
    useAppointmentWorkspaceStore.getState().upsertSoap(APPT, { subjective: '<p>history</p>' });
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    const { rerender } = render(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    // The note is signed (recorded) and the parent advance callback fires.
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    expect(updated.soap[0]?.status).toBe('COMPLETED');
    rerender(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={updated}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );
    // The signed note moves to history; the form clears and stays editable so a
    // new SOAP can be started.
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText(/By Dr\. Tim Apple/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Next' })).not.toBeDisabled();
  });

  it('uses the current author name for the optimistic signed SOAP note', async () => {
    onSaveAndNext.mockClear();
    seedAndGet();
    useAppointmentWorkspaceStore.getState().upsertSoap(APPT, { subjective: '<p>history</p>' });
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    const { rerender } = render(
      <SoapStep
        appointmentId={APPT}
        organisationId="org-1"
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        authorId="current-user"
        authorName="Dr Current User"
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => expect(onSaveAndNext).toHaveBeenCalledTimes(1));
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    rerender(
      <SoapStep
        appointmentId={APPT}
        organisationId="org-1"
        appointmentReason={APPOINTMENT_REASON}
        encounter={updated}
        authorId="current-user"
        authorName="Dr Current User"
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );

    expect(screen.getByText(/By Dr Current User/)).toBeInTheDocument();
    expect(screen.queryByText(/By Dr\. Tim Apple/)).not.toBeInTheDocument();
  });

  it('starts a fresh draft after a note is signed', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    // A new edit after signing creates a brand-new draft rather than mutating the
    // signed note.
    store.upsertSoap(APPT, { subjective: '<p>new visit</p>' });
    const soap = store.getEncounter(APPT)!.soap;
    expect(soap.filter((n) => n.status === 'COMPLETED')).toHaveLength(1);
    expect(soap.find((n) => n.status !== 'COMPLETED')?.subjective).toBe('<p>new visit</p>');
  });

  it('keeps Save & Next available after signing without rendering Print to Sign', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    renderSoapStep(store.getEncounter(APPT)!);
    expect(screen.queryByRole('button', { name: 'Print to Sign' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Next' })).toBeInTheDocument();
  });

  it('shows only complaint context and past notes when the step is view-only', () => {
    seedAndGet();
    useAppointmentWorkspaceStore.getState().upsertSoap(APPT, { subjective: '<p>history</p>' });
    useAppointmentWorkspaceStore.getState().signSoap(APPT, 'Dr Tim', false);
    const enc = { ...useAppointmentWorkspaceStore.getState().getEncounter(APPT)!, viewOnly: true };
    renderSoapStep(enc);
    expect(screen.queryByLabelText(/search for soap template/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Subjective (History)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save & Next' })).not.toBeInTheDocument();
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText(/By Dr Tim/)).toBeInTheDocument();
  });

  it('hides editing affordances in view-only mode', () => {
    const enc = { ...seedAndGet(), viewOnly: true };
    renderSoapStep(enc);
    expect(screen.queryByRole('button', { name: /record vitals/i })).not.toBeInTheDocument();
  });

  it('expands a signed note in history to show read-only SOAP fields', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history text</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    const updated = store.getEncounter(APPT)!;
    renderSoapStep(updated);
    fireEvent.click(screen.getByRole('button', { name: /view soap note by dr tim/i }));
    // The signed note's text shows in the expanded history read-out (the form
    // itself has cleared, so the text appears once).
    expect(screen.getByText('history text')).toBeInTheDocument();
    expect(screen.getAllByText(APPOINTMENT_REASON).length).toBeGreaterThanOrEqual(1);
  });

  it('invokes the Record Vitals callback from the Objective section', () => {
    onRecordVitals.mockClear();
    renderSoapStep();
    fireEvent.click(screen.getByRole('button', { name: /record vitals/i }));
    expect(onRecordVitals).toHaveBeenCalledTimes(1);
  });

  it('advances without saving or recording a SOAP note when Save & Next is clicked on an empty draft', () => {
    onSaveAndNext.mockClear();
    renderSoapStep();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
    expect(saveSoapNote).not.toHaveBeenCalled();
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.soap.some((entry) => entry.status === 'COMPLETED')
    ).toBe(false);
  });

  it('surfaces the backend error and does NOT sign or advance when the save fails', async () => {
    // Override the global throwing console.error spy: the handler logs on failure.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (saveSoapNote as jest.Mock).mockRejectedValueOnce(new Error('SOAP save rejected'));
    onSaveAndNext.mockClear();
    seedAndGet();
    useAppointmentWorkspaceStore.getState().upsertSoap(APPT, { subjective: '<p>history</p>' });
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    render(
      <SoapStep
        appointmentId={APPT}
        organisationId="org-1"
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('SOAP save rejected');
    // Critical: a failed save must not advance the step or mark the note COMPLETED.
    expect(onSaveAndNext).not.toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.soap[0]?.status).not.toBe(
      'COMPLETED'
    );
    errorSpy.mockRestore();
  });

  it('renders a custom template structure and blocks save until required custom fields are filled', async () => {
    seedAndGet();
    // Apply a CUSTOM template (structure override) via the store before rendering.
    useAppointmentWorkspaceStore.getState().applySoapTemplate(APPT, {
      id: 'tpl-custom',
      name: 'Mobility',
      customSchema: [
        {
          id: 'grp',
          type: 'group',
          label: 'Mobility',
          fields: [{ id: 'gait', type: 'input', label: 'Gait quality', required: true }],
        },
      ],
    });
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    render(
      <SoapStep
        appointmentId={APPT}
        organisationId="org-1"
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );

    // The custom structure REPLACES the four native editors.
    expect(screen.queryByText('Subjective (History)')).not.toBeInTheDocument();
    expect(screen.getByText('Gait quality')).toBeInTheDocument();

    // A required custom field left empty blocks the save with a validation alert.
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Gait quality/i);
    expect(saveSoapNote).not.toHaveBeenCalled();
    expect(onSaveAndNext).not.toHaveBeenCalled();
  });

  it('falls back to the encounter lead name and omits date/time when not recorded', () => {
    const enc = {
      ...seedAndGet(),
      soap: [
        {
          id: 'soap-old',
          chiefComplaint: '',
          subjective: '<p>legacy</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'COMPLETED' as const,
          createdAt: '',
        },
      ],
    };
    renderSoapStep(enc);
    expect(screen.getByText(/By Dr\. Tim Apple/)).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = renderSoapStep();
    expect(await axe(container)).toHaveNoViolations();
  });
});
