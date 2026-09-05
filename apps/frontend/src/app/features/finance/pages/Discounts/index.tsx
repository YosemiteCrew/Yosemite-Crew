'use client';
import React, { Suspense, useState } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationDiscountCap } from '@/app/features/finance/hooks/useOrganisationDiscountCap';
import {
  getDiscountSettingsErrorMessage,
  updateOrganisationDiscountSettings,
} from '@/app/features/finance/services/discountSettingsService';
import {
  MAX_DISCOUNT_PERCENT,
  MIN_DISCOUNT_PERCENT,
  parseCapInput,
} from '@/app/features/finance/pages/Discounts/discountCapInput';

const DISCOUNTS_PAGE_SKELETON = <PageSkeleton variant="settings" />;

const capToInput = (percent: number | null): string => (percent == null ? '' : String(percent));

const DiscountsContent = () => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { maxOverallDiscountPercent, loading, error, setCap, reload } = useOrganisationDiscountCap(
    primaryOrgId ?? undefined
  );

  const [capInput, setCapInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Re-sync the field whenever the loaded/saved cap changes so the input always
  // reflects server truth. Keyed on the cap value, so a local edit is not clobbered.
  const syncedCap = loading ? null : capToInput(maxOverallDiscountPercent);
  const [prevSyncedCap, setPrevSyncedCap] = useState(syncedCap);
  if (prevSyncedCap !== syncedCap) {
    setPrevSyncedCap(syncedCap);
    if (syncedCap !== null) setCapInput(syncedCap);
  }

  const handleSave = async () => {
    if (!primaryOrgId) return;
    const parsed = parseCapInput(capInput);
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const settings = await updateOrganisationDiscountSettings(primaryOrgId, {
        maxOverallDiscountPercent: parsed.value,
      });
      setCap(settings.maxOverallDiscountPercent);
      setCapInput(capToInput(settings.maxOverallDiscountPercent));
      notify('success', {
        title: 'Discount cap updated',
        text:
          settings.maxOverallDiscountPercent == null
            ? 'The overall invoice discount is no longer capped.'
            : `Overall invoice discounts are now capped at ${settings.maxOverallDiscountPercent}%.`,
      });
    } catch (err: unknown) {
      const message = getDiscountSettingsErrorMessage(err, 'Unable to update the discount cap.');
      setFormError(message);
      notify('error', { title: 'Unable to update discount cap', text: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex items-center justify-between w-full flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-page-title">Discounts</h1>
          <GlassTooltip
            content="Set the maximum overall discount anyone can apply to an invoice in the appointment workspace. Per-service and per-product caps are separate limits, set under Organization > Specialities."
            side="bottom"
          >
            <button
              type="button"
              aria-label="Discounts info"
              className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
            >
              <IoInformationCircleOutline size={20} />
            </button>
          </GlassTooltip>
        </div>
        <Secondary href="/finance" text="Back to invoices" ariaLabel="Back to invoices" />
      </div>

      <div className="border border-card-border rounded-2xl max-w-160">
        <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
          <div className="text-body-3 text-text-primary">Overall invoice discount cap</div>
        </div>
        <div className="flex flex-col gap-3 px-6! py-6!">
          <p className="text-body-4 text-text-secondary">
            The most anyone can discount a whole invoice by. Leave it empty for no cap. This is
            independent of the per-service and per-product maximum discounts - the stricter of the
            two wins on each line.
          </p>

          {loading && (
            <div className="h-12 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
          )}

          {!loading && error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-100 p-3">
              <p role="alert" className="text-body-4 text-text-error">
                {error}
              </p>
              <Secondary text="Retry" onClick={reload} ariaLabel="Retry loading the discount cap" />
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-caption-2 font-bold text-text-tertiary">
                  Maximum overall discount
                </span>
                <span className="flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active max-w-60">
                  <input
                    id="max-overall-discount-percent"
                    type="number"
                    inputMode="decimal"
                    min={MIN_DISCOUNT_PERCENT}
                    max={MAX_DISCOUNT_PERCENT}
                    value={capInput}
                    placeholder="No cap"
                    aria-label="Maximum overall discount percent"
                    onChange={(e) => setCapInput(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-body-4 text-text-primary outline-none"
                  />
                  <span className="flex items-center bg-neutral-100 px-3 text-body-4 text-neutral-700">
                    %
                  </span>
                </span>
              </div>

              <p className="text-body-4 text-text-secondary">
                {maxOverallDiscountPercent == null
                  ? 'No cap is configured, so invoices can be discounted by any amount up to 100%.'
                  : `Invoices are currently capped at ${maxOverallDiscountPercent}%.`}
              </p>

              {formError && (
                <p
                  role="alert"
                  className="rounded-2xl bg-danger-100 p-3 text-body-4 text-text-error"
                >
                  {formError}
                </p>
              )}

              <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
                <div className="w-full flex justify-end!">
                  <Primary
                    href="#"
                    text={saving ? 'Saving...' : 'Save discount cap'}
                    isDisabled={saving}
                    onClick={() => void handleSave()}
                  />
                </div>
              </PermissionGate>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Discounts = () => (
  <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
    <DiscountsContent />
  </PermissionGate>
);

const ProtectedDiscounts = () => (
  <ProtectedRoute skeleton={DISCOUNTS_PAGE_SKELETON}>
    <OrgGuard skeleton={DISCOUNTS_PAGE_SKELETON}>
      <Suspense fallback={DISCOUNTS_PAGE_SKELETON}>
        <Discounts />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedDiscounts;
