'use client';
import React, { useState } from 'react';
import clsx from 'clsx';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import SectionCard from '@/app/ui/primitives/SectionCard/SectionCard';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import DocSigningPortal from '@/app/features/docSigning/components/DocSigningPortal';
import { useNotify } from '@/app/hooks/useNotify';

type ToggleRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
};

const ToggleRow = ({ title, description, checked, onChange }: ToggleRowProps) => (
  <div className="flex items-center justify-between gap-3">
    <span className="min-w-0">
      <span className="block text-[13px] font-bold text-[var(--ink)]">{title}</span>
      <span className="block text-[11.5px] text-[var(--ink-muted)]">{description}</span>
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      onClick={onChange}
      className="relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer"
      style={{
        backgroundColor: checked ? 'var(--blue)' : 'var(--inset)',
        borderColor: checked ? 'var(--blue)' : 'var(--divider)',
      }}
    >
      <span
        className={clsx(
          'inline-block size-5 rounded-full border transition-transform',
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
        )}
        style={{
          backgroundColor: checked ? 'var(--white-text)' : 'var(--screen)',
          borderColor: checked ? 'transparent' : 'var(--hairline)',
        }}
      />
    </button>
  </div>
);

const DocumentESigning = () => {
  const { notify } = useNotify();
  const [signInApp, setSignInApp] = useState(true);
  const [signOnTablet, setSignOnTablet] = useState(true);
  const [requireBeforeSurgery, setRequireBeforeSurgery] = useState(false);
  const [showPortal, setShowPortal] = useState(false);

  const handleSave = () => {
    notify('success', {
      title: 'E-signing preferences updated',
      text: 'Your e-signing channels now apply org-wide.',
    });
  };

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
            <ToggleRow
              title="Sign in the pet parent app"
              description="Send documents to the parent's phone"
              checked={signInApp}
              onChange={() => setSignInApp((v) => !v)}
            />
            <ToggleRow
              title="Sign on clinic tablet"
              description="Front-desk iPad, finger signature"
              checked={signOnTablet}
              onChange={() => setSignOnTablet((v) => !v)}
            />
            <ToggleRow
              title="Require signature before surgery check-in"
              description="Blocks check-in until consent is signed"
              checked={requireBeforeSurgery}
              onChange={() => setRequireBeforeSurgery((v) => !v)}
            />
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
          <div className="px-5! py-3! border-t border-[var(--hairline)] flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-[var(--ink-faint)]">Changes apply org-wide</span>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center h-9 px-4 rounded-full bg-[var(--cta)] text-[var(--cta-text)] text-[12.5px] font-semibold"
            >
              Save
            </button>
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
