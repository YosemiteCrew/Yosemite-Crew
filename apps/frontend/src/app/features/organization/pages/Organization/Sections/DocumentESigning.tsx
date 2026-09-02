'use client';
import React, { useState } from 'react';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import SectionCard from '@/app/ui/primitives/SectionCard/SectionCard';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import DocSigningPortal from '@/app/features/docSigning/components/DocSigningPortal';

/*
 * The three e-signing channel switches are gone, along with their Save button.
 *
 * They were `useState(true) / useState(true) / useState(false)` - module-local
 * literals that nothing loaded, so every user of every clinic saw the same
 * invented configuration, with two channels shown as already enabled org-wide.
 * `handleSave` contained a single `notify('success')` whose text asserted the
 * settings "now apply org-wide"; it wrote nothing. Turning a channel off, saving,
 * and returning showed it back on.
 *
 * There is nothing to persist them to: the `Organization` model has no e-signing
 * preference column (it carries only `documensoTeamId` / `documensoApiKey` for
 * the Documenso bridge), and no route under apps/backend/src/routers accepts
 * signing-channel settings. Rather than invent a schema for a product decision
 * that has not been made, the card is now what it honestly is: the entry point
 * to the real signing portal it already embedded underneath.
 */
const DocumentESigning = () => {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <PermissionGate
      allOf={[PERMISSIONS.DOCUMENT_VIEW_ANY]}
      fallback={<Fallback resource="document e-signing settings" />}
    >
      <SectionCard title="E-signing" showButton={false}>
        <div className="overflow-hidden">
          <div className="px-5! py-3! border-b border-[var(--hairline)] text-[11.5px] text-[var(--ink-faint)]">
            How consent documents get signed
          </div>
          <div className="px-5! py-4! flex flex-col gap-3">
            <div className="flex gap-2.5 rounded-xl border border-[var(--divider)] bg-[var(--inset)] px-3.5 py-3">
              <IoShieldCheckmarkOutline
                className="shrink-0 mt-px text-[var(--blue-text)]"
                size={15}
              />
              <span className="text-[11.5px] leading-relaxed text-[var(--ink-body)]">
                Signed documents are sealed with a timestamp and signer identity, stored in the
                medical record.
              </span>
            </div>
          </div>
          <div className="px-5! pb-4! pt-1!">
            <button
              type="button"
              onClick={() => setShowPortal((v) => !v)}
              className="text-[11.5px] font-semibold text-[var(--blue-text)]"
              aria-expanded={showPortal}
            >
              {showPortal ? 'Hide document signing portal' : 'Manage document signing portal'}
            </button>
            {showPortal && (
              <div className="mt-3">
                <DocSigningPortal embedded />
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </PermissionGate>
  );
};

export default DocumentESigning;
