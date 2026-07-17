import React, { useState, useRef } from 'react';
import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRouter } from 'next/navigation';
import {
  CompanionTerminologyOption,
  getCompanionTerminologyOptions,
  setCompanionTerminologyForOrg,
} from '@/app/lib/companionTerminology';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { patchUserProfile } from '@/app/features/organization/services/profileService';
import {
  getFallbackAnimalTerminology,
  isValidAnimalTerminology,
  normalizePmsPreferences,
} from '@/app/features/settings/utils/pmsPreferences';

// Short single-word (plural) labels for the inline pill, derived from the shared
// "Singular / Plural" option labels (e.g. "Companion / Companions" -> "Companions").
const toShortLabel = (label: string): string => {
  const plural = label.split('/').at(-1)?.trim();
  return plural && plural.length > 0 ? plural : label;
};

const TERMINOLOGY_PILL_OPTIONS: ReadonlyArray<SegmentedPillOption<CompanionTerminologyOption>> =
  getCompanionTerminologyOptions().map((option) => ({
    value: option.value as CompanionTerminologyOption,
    label: toShortLabel(option.label),
  }));

const CompanionTerminologyPreference = () => {
  const router = useRouter();
  const { notify } = useNotify();
  const profile = usePrimaryOrgProfile();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const fallbackAnimalTerminology = getFallbackAnimalTerminology(primaryOrgType);
  const pmsPreferences = normalizePmsPreferences(
    profile?.personalDetails?.pmsPreferences,
    primaryOrgType
  );
  const profileTerminology: CompanionTerminologyOption = isValidAnimalTerminology(
    profile?.personalDetails?.pmsPreferences?.animalTerminology
  )
    ? profile?.personalDetails?.pmsPreferences?.animalTerminology
    : fallbackAnimalTerminology;
  const [selection, setSelection] = useState<CompanionTerminologyOption>(profileTerminology);
  const prevTerminologyRef = useRef(profileTerminology);
  if (prevTerminologyRef.current !== profileTerminology) {
    prevTerminologyRef.current = profileTerminology;
    setSelection(profileTerminology);
  }

  const handleSelect = async (next: CompanionTerminologyOption) => {
    if (next === selection) return;
    setSelection(next);

    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }

    const localSaved = setCompanionTerminologyForOrg(primaryOrgId, next);
    try {
      await patchUserProfile(primaryOrgId, {
        personalDetails: {
          ...profile?.personalDetails,
          pmsPreferences: {
            ...pmsPreferences,
            animalTerminology: next,
          },
        },
      });
      notify('success', {
        title: 'Terminology updated',
        text: localSaved
          ? 'Animal terminology preference has been saved.'
          : 'Saved to profile. Local cache refresh may require reloading.',
      });
      router.refresh();
      return;
    } catch {
      notify('error', {
        title: 'Unable to update terminology',
        text: 'Please try again.',
      });
    }
  };

  return (
    <div className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <div className="px-5! pt-4! pb-3! border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">
          Companion terminology
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 px-5! py-5!">
        <div className="text-[12.5px] text-[var(--ink-faint)]">
          How patients are named across the app.
        </div>
        <div data-terminology-lock="true">
          <SegmentedPill
            options={TERMINOLOGY_PILL_OPTIONS}
            value={selection}
            onChange={handleSelect}
            ariaLabel="Companion terminology"
          />
        </div>
      </div>
    </div>
  );
};

export default CompanionTerminologyPreference;
