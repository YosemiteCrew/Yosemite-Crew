import React from 'react';
import ProfileCard from '@/app/features/organization/pages/Organization/Sections/ProfileCard';
import {
  AddressFields,
  BasicFields,
  CheckInFields,
} from '@/app/features/organization/pages/Organization/Sections/profileFields';
import { OrgProfileForm } from '@/app/features/organization/pages/Organization/Sections/useOrgProfileForm';

type OrgProfileEditCardsProps = {
  form: OrgProfileForm;
  canEditOrg: boolean;
  showProfile?: boolean;
};

/**
 * The three editable organization profile cards (identity, address, check-in),
 * shared by the desktop Profile band and the phone Organization screen so both
 * reveal the same edit surface wired to one set of save handlers.
 */
const OrgProfileEditCards = ({
  form,
  canEditOrg,
  showProfile = true,
}: OrgProfileEditCardsProps) => {
  const { formData, handleOrgSave, handleAddressSave, handleCheckInSave } = form;

  return (
    <>
      <ProfileCard
        title="Organization"
        fields={BasicFields}
        org={{ ...formData, country: formData.address?.country }}
        showProfile={showProfile}
        onSave={canEditOrg ? handleOrgSave : undefined}
      />
      <ProfileCard
        title="Address"
        fields={AddressFields}
        org={{ ...formData.address }}
        onSave={canEditOrg ? handleAddressSave : undefined}
      />
      <ProfileCard
        title="Check-in settings"
        fields={CheckInFields}
        org={{
          appointmentCheckInBufferMinutes: formData.appointmentCheckInBufferMinutes ?? 5,
          appointmentCheckInRadiusMeters: formData.appointmentCheckInRadiusMeters ?? 200,
        }}
        onSave={canEditOrg ? handleCheckInSave : undefined}
      />
    </>
  );
};

export default OrgProfileEditCards;
