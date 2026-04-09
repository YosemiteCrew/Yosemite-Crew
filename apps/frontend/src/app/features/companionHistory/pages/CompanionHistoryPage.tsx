'use client';

import React, { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import Back from '@/app/ui/primitives/Icons/Back';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
import {
  useCompanionsParentsForPrimaryOrg,
  useLoadCompanionsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import Image from 'next/image';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { useCompanionStore } from '@/app/stores/companionStore';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

const FALLBACK_BACK_PATH = '/companions';
const APPOINTMENTS_BACK_PATH = '/appointments';

const resolveSafeBackPath = (candidate: string | null, source: string | null): string => {
  if (candidate?.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }
  if (source === 'appointments') {
    return APPOINTMENTS_BACK_PATH;
  }
  return FALLBACK_BACK_PATH;
};

const CompanionHistoryPage = () => {
  useLoadCompanionsForPrimaryOrg();
  const companions = useCompanionsParentsForPrimaryOrg();
  const companionsStatus = useCompanionStore((s) => s.status);
  const router = useRouter();
  const searchParams = useSearchParams();
  const replaceCompanionText = useCompanionTerminologyText();

  const companionId = String(searchParams.get('companionId') ?? '').trim();
  const source = String(searchParams.get('source') ?? '')
    .trim()
    .toLowerCase();
  const backTo = String(searchParams.get('backTo') ?? '').trim();
  const backPath = resolveSafeBackPath(backTo || null, source || null);
  const hasCompanionId = Boolean(companionId);

  const activeCompanion = useMemo(
    () => companions.find((item) => item.companion.id === companionId) ?? null,
    [companions, companionId]
  );
  const historyTitle = useMemo(
    () => replaceCompanionText('Companion Overview'),
    [replaceCompanionText]
  );

  const handleBack = useCallback(() => {
    startRouteLoader();
    router.push(backPath);
  }, [router, backPath]);

  if (companionsStatus === 'loading') {
    return (
      <ProtectedRoute>
        <OrgGuard>
          <YosemiteLoader
            variant="fullscreen-translucent"
            size={150}
            testId="companions-history-loader"
          />
        </OrgGuard>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Back onClick={handleBack} />
              <div className="text-heading-1 text-text-primary">{historyTitle}</div>
            </div>

            {activeCompanion ? (
              <div className="flex items-center gap-3 rounded-2xl border border-card-border bg-white px-3 py-2">
                <Image
                  alt="companion avatar"
                  src={getSafeImageUrl(
                    activeCompanion.companion.photoUrl,
                    activeCompanion.companion.type.toLowerCase() as ImageType
                  )}
                  className="h-9 w-9 rounded-full object-cover"
                  height={36}
                  width={36}
                />
                <div className="flex flex-col leading-tight">
                  <div className="text-body-3-emphasis text-text-primary">
                    {formatCompanionNameWithOwnerLastName(
                      activeCompanion.companion.name,
                      activeCompanion.parent
                    )}
                  </div>
                  <div className="text-caption-1 text-text-secondary">
                    {activeCompanion.companion.breed} / {activeCompanion.companion.type}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {hasCompanionId ? null : (
            <div className="rounded-2xl border border-card-border bg-white px-4 py-6 text-body-3 text-text-secondary">
              Companion id is missing. Please open overview from Appointments or Companions.
            </div>
          )}

          {hasCompanionId ? (
            <div className="rounded-2xl border border-card-border bg-white p-4">
              <CompanionHistoryTimeline companionId={companionId} showDocumentUpload />
            </div>
          ) : null}
        </div>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default CompanionHistoryPage;
