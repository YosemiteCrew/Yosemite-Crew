'use client';
import { useCallback, useEffect, useState } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import AllergyList, {
  type AllergyFormValues,
} from '@/app/features/companionHistory/components/AllergyList';
import {
  createPatientAllergy,
  fetchPatientAllergies,
  resolvePatientAllergy,
  type CreatePatientAllergyInput,
  type PatientAllergy,
} from '@/app/features/companionHistory/services/patientAllergyService';

export type AllergyListPanelProps = {
  /** The companion (patient) whose allergies to load. `companionId === patientId`. */
  companionId: string;
};

// `<input type="date">` yields `YYYY-MM-DD`; the backend validates onsetDate with
// `z.iso.datetime()`, so widen it to a UTC-midnight ISO datetime.
const toIsoDate = (yyyyMmDd: string): string => new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();

const LOAD_ERROR = 'Could not load the allergy list. Please try again.';

/**
 * Loads the allergy list for a companion and wires create/resolve to the
 * service. Renders nothing when the member cannot view allergies (the backend
 * gates the list on `appointments:view:any`), and gates the create/resolve
 * controls on `appointments:edit:any`, matching the router's permissions.
 */
const AllergyListPanel = ({ companionId }: AllergyListPanelProps) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const { notify } = useNotify();

  const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Reset to a loading state when the companion changes, adjusting state during
  // render (React's recommended pattern) rather than synchronously inside an
  // effect. `loadedFor` tracks which companion the current state belongs to.
  const [loadedFor, setLoadedFor] = useState(companionId);
  if (companionId !== loadedFor) {
    setLoadedFor(companionId);
    setAllergies([]);
    setError(null);
    setLoading(true);
  }

  // Fetch happens off the render path; every setState here is inside an async
  // callback, so it never triggers a synchronous cascade.
  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    fetchPatientAllergies({ patientId: companionId })
      .then((list) => {
        if (active) setAllergies(list);
      })
      .catch((err) => {
        if (active && !isAuthRedirectError(err)) setError(LOAD_ERROR);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, companionId]);

  const handleCreate = useCallback(
    async (values: AllergyFormValues): Promise<boolean> => {
      if (!companionId) return false;
      setCreating(true);
      try {
        const payload: CreatePatientAllergyInput = {
          patientId: companionId,
          allergen: values.allergen,
          allergyType: values.allergyType,
          severity: values.severity,
          ...(values.reaction.trim() ? { reaction: values.reaction.trim() } : {}),
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          ...(values.onsetDate ? { onsetDate: toIsoDate(values.onsetDate) } : {}),
        };
        const created = await createPatientAllergy(payload);
        // A new allergy is ACTIVE, so prepending keeps active-first ordering
        // without a refetch flash.
        setAllergies((prev) => [created, ...prev]);
        notify('success', {
          title: 'Allergy added',
          text: `${created.allergen} was added to the allergy list.`,
        });
        return true;
      } catch (err) {
        if (!isAuthRedirectError(err)) {
          notify('error', { title: 'Could not add allergy', text: 'Please try again.' });
        }
        return false;
      } finally {
        setCreating(false);
      }
    },
    [companionId, notify]
  );

  const handleResolve = useCallback(
    async (allergy: PatientAllergy): Promise<void> => {
      setResolvingId(allergy.id);
      try {
        const updated = await resolvePatientAllergy(allergy.id);
        setAllergies((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        notify('success', {
          title: 'Allergy resolved',
          text: `${updated.allergen} was marked resolved.`,
        });
      } catch (err) {
        if (!isAuthRedirectError(err)) {
          notify('error', { title: 'Could not resolve allergy', text: 'Please try again.' });
        }
      } finally {
        setResolvingId(null);
      }
    },
    [notify]
  );

  if (!canView) return null;

  return (
    <AllergyList
      allergies={allergies}
      loading={loading}
      error={error}
      canEdit={canEdit}
      onCreate={handleCreate}
      onResolve={handleResolve}
      creating={creating}
      resolvingId={resolvingId}
    />
  );
};

export default AllergyListPanel;
