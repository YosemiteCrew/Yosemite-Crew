'use client';
import { useCallback, useEffect, useState } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import ProblemList, {
  type ProblemFormValues,
} from '@/app/features/companionHistory/components/ProblemList';
import {
  createPatientProblem,
  fetchPatientProblems,
  resolvePatientProblem,
  type CreatePatientProblemInput,
  type PatientProblem,
} from '@/app/features/companionHistory/services/patientProblemService';

export type ProblemListPanelProps = {
  /** The companion (patient) whose problems to load. */
  companionId: string;
};

// `<input type="date">` yields `YYYY-MM-DD`; the backend validates onsetDate with
// `z.iso.datetime()`, so widen it to a UTC-midnight ISO datetime.
const toIsoDate = (yyyyMmDd: string): string => new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();

const LOAD_ERROR = 'Could not load the problem list. Please try again.';

/**
 * Loads the problem list for a companion and wires create/resolve to the
 * service. Renders nothing when the member cannot view problems (the backend
 * gates the list on `appointments:view`), and gates the create/resolve controls
 * on `appointments:edit`, matching the router's permissions.
 */
const ProblemListPanel = ({ companionId }: ProblemListPanelProps) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const { notify } = useNotify();

  const [problems, setProblems] = useState<PatientProblem[]>([]);
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
    setProblems([]);
    setError(null);
    setLoading(true);
  }

  // Fetch happens off the render path; every setState here is inside an async
  // callback, so it never triggers a synchronous cascade.
  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    fetchPatientProblems({ patientId: companionId })
      .then((list) => {
        if (active) setProblems(list);
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
    async (values: ProblemFormValues): Promise<boolean> => {
      if (!companionId) return false;
      setCreating(true);
      try {
        const payload: CreatePatientProblemInput = {
          patientId: companionId,
          name: values.name,
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          ...(values.severity ? { severity: values.severity } : {}),
          ...(values.onsetDate ? { onsetDate: toIsoDate(values.onsetDate) } : {}),
        };
        const created = await createPatientProblem(payload);
        // A new problem is ACTIVE, so prepending keeps the backend's
        // active-first ordering without a refetch flash.
        setProblems((prev) => [created, ...prev]);
        notify('success', {
          title: 'Problem added',
          text: `${created.name} was added to the problem list.`,
        });
        return true;
      } catch (err) {
        if (!isAuthRedirectError(err)) {
          notify('error', { title: 'Could not add problem', text: 'Please try again.' });
        }
        return false;
      } finally {
        setCreating(false);
      }
    },
    [companionId, notify]
  );

  const handleResolve = useCallback(
    async (problem: PatientProblem): Promise<void> => {
      setResolvingId(problem.id);
      try {
        const updated = await resolvePatientProblem(problem.id);
        setProblems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        notify('success', {
          title: 'Problem resolved',
          text: `${updated.name} was marked resolved.`,
        });
      } catch (err) {
        if (!isAuthRedirectError(err)) {
          notify('error', { title: 'Could not resolve problem', text: 'Please try again.' });
        }
      } finally {
        setResolvingId(null);
      }
    },
    [notify]
  );

  if (!canView) return null;

  return (
    <ProblemList
      problems={problems}
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

export default ProblemListPanel;
