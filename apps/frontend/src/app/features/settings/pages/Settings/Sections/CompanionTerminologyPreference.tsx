import React, { useEffect, useState } from 'react';
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
  const profileTerminology = isValidAnimalTerminology(
    profile?.personalDetails?.pmsPreferences?.animalTerminology
  )
    ? profile?.personalDetails?.pmsPreferences?.animalTerminology
    : fallbackAnimalTerminology;
  const [selection, setSelection] = useState<CompanionTerminologyOption>(profileTerminology);

  useEffect(() => {
    setSelection(profileTerminology);
  }, [profileTerminology]);

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
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Animal terminology</div>
      </div>
      <div className="flex flex-col gap-3 px-6! py-6!">
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
