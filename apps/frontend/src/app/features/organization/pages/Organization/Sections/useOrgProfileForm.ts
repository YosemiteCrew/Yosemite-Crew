import { useState } from 'react';
import { Organisation } from '@yosemite-crew/types';
import { updateOrg } from '@/app/features/organization/services/orgService';
import { useNotify } from '@/app/hooks/useNotify';

const parseNonNegativeInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

export type OrgProfileForm = {
  formData: Organisation;
  handleOrgSave: (values: Record<string, string>) => Promise<void>;
  handleAddressSave: (values: Record<string, string>) => Promise<void>;
  handleCheckInSave: (values: Record<string, string>) => Promise<void>;
};

/**
 * Shared organization-profile edit state + persistence. Extracted so the desktop
 * Profile band and the phone Organization screen edit the same form with one set
 * of save handlers instead of duplicating the update/notify logic.
 */
export const useOrgProfileForm = (primaryOrg: Organisation): OrgProfileForm => {
  const [formData, setFormData] = useState<Organisation>(primaryOrg);
  const { notify } = useNotify();

  const persist = async (updated: Organisation) => {
    try {
      await updateOrg(updated);
      setFormData(updated);
      notify('success', {
        title: 'Organization updated',
        text: 'Organization details have been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating organization:', error);
      notify('error', {
        title: 'Unable to update organization',
        text: 'Failed to update organization. Please try again.',
      });
    }
  };

  const handleOrgSave = async (values: Record<string, string>) => {
    await persist({
      ...formData,
      ...values,
      address: {
        ...formData.address,
        ...(values.country ? { country: values.country } : {}),
      },
    });
  };

  const handleAddressSave = async (values: Record<string, string>) => {
    await persist({
      ...formData,
      address: {
        ...formData.address,
        ...values,
      },
    });
  };

  const handleCheckInSave = async (values: Record<string, string>) => {
    await persist({
      ...formData,
      appointmentCheckInBufferMinutes: parseNonNegativeInteger(
        values.appointmentCheckInBufferMinutes,
        formData.appointmentCheckInBufferMinutes ?? 5
      ),
      appointmentCheckInRadiusMeters: parseNonNegativeInteger(
        values.appointmentCheckInRadiusMeters,
        formData.appointmentCheckInRadiusMeters ?? 200
      ),
    });
  };

  return { formData, handleOrgSave, handleAddressSave, handleCheckInSave };
};
