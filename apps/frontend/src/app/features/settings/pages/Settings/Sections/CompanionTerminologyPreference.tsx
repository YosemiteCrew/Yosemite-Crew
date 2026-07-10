import React, { useState, useRef } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
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

  const handleSave = async () => {
    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }

    const localSaved = setCompanionTerminologyForOrg(primaryOrgId, selection);
    try {
      await patchUserProfile(primaryOrgId, {
        personalDetails: {
          ...profile?.personalDetails,
          pmsPreferences: {
            ...pmsPreferences,
            animalTerminology: selection,
          },
        },
      });
      if (localSaved) {
        notify('success', {
          title: 'Terminology updated',
          text: 'Animal terminology preference has been saved.',
        });
      } else {
        notify('success', {
          title: 'Terminology updated',
          text: 'Saved to profile. Local cache refresh may require reloading.',
        });
      }
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
          Animal terminology
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5! py-5!">
        <div data-terminology-lock="true">
          <LabelDropdown
            placeholder="How should pets be named?"
            options={getCompanionTerminologyOptions()}
            defaultOption={selection}
            onSelect={(option) => setSelection(option.value as CompanionTerminologyOption)}
          />
        </div>
        <div className="w-full flex justify-end!">
          <Primary href="#" text="Save terminology" onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default CompanionTerminologyPreference;
