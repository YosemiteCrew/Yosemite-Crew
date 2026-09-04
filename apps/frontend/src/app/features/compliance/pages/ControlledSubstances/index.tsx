'use client';
import React, { Suspense, useState } from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useNotify } from '@/app/hooks/useNotify';
import ControlledSubstanceRegister, {
  type ControlledSubstanceDateRange,
} from '@/app/features/compliance/components/ControlledSubstanceRegister';
import { useControlledSubstanceLogs } from '@/app/features/compliance/hooks/useControlledSubstanceLogs';
import {
  createControlledSubstanceLog,
  getControlledSubstanceErrorMessage,
} from '@/app/features/compliance/services/controlledSubstanceService';
import type { CreateControlledSubstanceLogInput } from '@/app/features/compliance/types/controlledSubstance';

const PAGE_SKELETON = <PageSkeleton variant="list" />;

const ControlledSubstancesContent = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { notify } = useNotify();
  const { can } = usePermissions();
  const canRecord = can({
    anyOf: [PERMISSIONS.PRESCRIPTION_EDIT_ANY, PERMISSIONS.PRESCRIPTION_EDIT_OWN],
  });

  const [dateRange, setDateRange] = useState<ControlledSubstanceDateRange>({});
  const { logs, loading, error, reload } = useControlledSubstanceLogs(
    primaryOrgId ?? undefined,
    dateRange
  );

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (input: CreateControlledSubstanceLogInput): Promise<boolean> => {
    if (!primaryOrgId) return false;
    setCreating(true);
    setCreateError(null);
    try {
      await createControlledSubstanceLog(primaryOrgId, input);
      notify('success', {
        title: 'Entry logged',
        text: 'The controlled substance entry has been recorded.',
      });
      reload();
      setCreating(false);
      return true;
    } catch (err) {
      setCreateError(getControlledSubstanceErrorMessage(err, 'Unable to log the entry.'));
      setCreating(false);
      return false;
    }
  };

  return (
    <ControlledSubstanceRegister
      entries={logs}
      loading={loading}
      error={error}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      canRecord={canRecord}
      creating={creating}
      createError={createError}
      onCreate={handleCreate}
    />
  );
};

const ControlledSubstances = () => (
  <PermissionGate
    anyOf={[PERMISSIONS.PRESCRIPTION_VIEW_ANY, PERMISSIONS.PRESCRIPTION_VIEW_OWN]}
    deniedResource="Controlled drugs"
  >
    <ControlledSubstancesContent />
  </PermissionGate>
);

const ProtectedControlledSubstances = () => (
  <ProtectedRoute skeleton={PAGE_SKELETON}>
    <OrgGuard skeleton={PAGE_SKELETON}>
      <Suspense fallback={PAGE_SKELETON}>
        <ControlledSubstances />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedControlledSubstances;
