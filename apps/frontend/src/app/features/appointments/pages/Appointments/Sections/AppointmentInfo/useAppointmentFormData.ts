import { useEffect, useMemo, useState } from 'react';
import type { Appointment, FormSubmission } from '@yosemite-crew/types';
import { fetchSubmissions } from '@/app/features/appointments/services/soapService';
import type { SoapNoteSubmission } from '@/app/features/appointments/types/soap';
import {
  createEmptyFormData,
  type FormDataProps,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';

type Service = { id?: string; cost?: unknown };

type SignatureMeta = (
  submissions: SoapNoteSubmission[] | FormSubmission[] | undefined
) => SoapNoteSubmission[];

type UseAppointmentFormDataOptions = {
  activeAppointment?: Appointment | null;
  services: Service[];
  resolvedActiveLabel: string;
  resolvedActiveSubLabel: string;
  customForms: unknown;
  formsById: unknown;
  withSignatureMeta: SignatureMeta;
  withSignatureMetaRef: React.RefObject<SignatureMeta>;
};

const SOAP_SUB_LABELS = new Set([
  'forms',
  'subjective',
  'objective',
  'assessment',
  'plan',
  'discharge-summary',
]);

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const getTaxPercent = (): number => 0;

/**
 * Owns the appointment form value and its effects (SOAP fetch, signature-meta
 * refresh) and returns it to the consumer, rather than the page threading a bare
 * `useState` setter through effects and children. Invoice totals are derived
 * during render and overlaid onto the value handed to children.
 */
export const useAppointmentFormData = ({
  activeAppointment,
  services,
  resolvedActiveLabel,
  resolvedActiveSubLabel,
  customForms,
  formsById,
  withSignatureMeta,
  withSignatureMetaRef,
}: UseAppointmentFormDataOptions) => {
  const [formData, setFormData] = useState<FormDataProps>(() => createEmptyFormData());

  // Load SOAP submissions for the active prescription tab into the form value.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const appointmentId = activeAppointment?.id;
      if (!appointmentId) {
        setFormData(createEmptyFormData());
        return;
      }
      if (resolvedActiveLabel !== 'prescription' || !SOAP_SUB_LABELS.has(resolvedActiveSubLabel)) {
        return;
      }
      try {
        const soap = await fetchSubmissions(appointmentId);
        if (cancelled) return;
        const applySignatureMeta = withSignatureMetaRef.current;
        setFormData((prev) => ({
          ...prev,
          subjective: applySignatureMeta(soap?.soapNotes?.Subjective),
          objective: applySignatureMeta(soap?.soapNotes?.Objective),
          assessment: applySignatureMeta(soap?.soapNotes?.Assessment),
          plan: applySignatureMeta(soap?.soapNotes?.Plan),
          discharge: applySignatureMeta(soap?.soapNotes?.Discharge),
          total: prev.total ?? '',
          subTotal: prev.subTotal ?? '',
          tax: prev.tax ?? '',
          discount: prev.discount ?? '',
        }));
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to fetch submissions:', e);
        setFormData(createEmptyFormData());
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeAppointment?.id, resolvedActiveLabel, resolvedActiveSubLabel, withSignatureMetaRef]);

  // Re-apply signature metadata to the SOAP fields when the underlying forms change.
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      subjective: withSignatureMeta(prev.subjective),
      objective: withSignatureMeta(prev.objective),
      assessment: withSignatureMeta(prev.assessment),
      plan: withSignatureMeta(prev.plan),
      discharge: withSignatureMeta(prev.discharge),
    }));
  }, [formsById, customForms, withSignatureMeta]);

  // Invoice totals are derived from the line items and the appointment's service
  // cost during render, then overlaid onto the value handed to children so
  // finance summaries stay in sync without storing derived state.
  const derivedInvoiceTotals = useMemo(() => {
    if (!activeAppointment?.id) return null;
    const itemsSubTotal = (formData.lineItems ?? []).reduce(
      (sum, li) => sum + toNumber(li.total),
      0
    );
    const service = services.find((s) => s.id === activeAppointment?.appointmentType?.id);
    const serviceCost = service ? toNumber(service.cost) : 0;
    const subTotal = itemsSubTotal + serviceCost;
    const taxTotal = (subTotal * getTaxPercent()) / 100;
    return {
      subTotal: String(subTotal),
      tax: String(taxTotal),
      total: String(subTotal + taxTotal),
    };
  }, [activeAppointment?.id, activeAppointment?.appointmentType?.id, formData.lineItems, services]);

  const formDataWithTotals = useMemo(
    () => (derivedInvoiceTotals ? { ...formData, ...derivedInvoiceTotals } : formData),
    [formData, derivedInvoiceTotals]
  );

  return { formData, setFormData, formDataWithTotals };
};
