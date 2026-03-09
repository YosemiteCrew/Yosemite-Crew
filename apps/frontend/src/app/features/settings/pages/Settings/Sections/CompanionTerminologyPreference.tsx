import React, { useEffect, useState } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRouter } from 'next/navigation';
import {
  CompanionTerminologyOption,
  getCompanionTerminologyForOrg,
  getCompanionTerminologyOptions,
  setCompanionTerminologyForOrg,
} from '@/app/lib/companionTerminology';

const CompanionTerminologyPreference = () => {
  const router = useRouter();
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const [selection, setSelection] = useState<CompanionTerminologyOption>(
    getCompanionTerminologyForOrg(primaryOrgId, primaryOrgType)
  );

  useEffect(() => {
    setSelection(getCompanionTerminologyForOrg(primaryOrgId, primaryOrgType));
  }, [primaryOrgId, primaryOrgType]);

  const handleSave = () => {
    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }

    const ok = setCompanionTerminologyForOrg(primaryOrgId, selection);
    if (ok) {
      notify('success', {
        title: 'Terminology updated',
        text: 'Companion naming preference has been saved.',
      });
      router.refresh();
      return;
    }
    notify('error', {
      title: 'Unable to update terminology',
      text: 'Please try again.',
    });
  };

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Companion terminology</div>
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
