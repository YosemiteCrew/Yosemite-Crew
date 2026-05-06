import Delete from '@/app/ui/primitives/Buttons/Delete';
import DeleteConfirmationModal from '@/app/ui/overlays/Modal/DeleteConfirmationModal';
import { useSignOut } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState, useCallback } from 'react';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useOrgStore } from '@/app/stores/orgStore';
import { useNotify } from '@/app/hooks/useNotify';
import { deleteData } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import axios from 'axios';

const PROFILE_ITEMS_TO_REMOVE = [
  'Personal details',
  'Professional information',
  'Availability & schedule',
  'Assigned tasks & appointment history',
  'Access permissions within all organizations',
];

const DeleteProfile = () => {
  const router = useRouter();
  const { signOut } = useSignOut();
  const [deletePopup, setDeletePopup] = useState(false);
  const { notify } = useNotify();
  const userId = useAuthStore((s) => s.attributes?.sub);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);
  const ownerOrgNames = useMemo(
    () =>
      Object.entries(membershipsByOrgId)
        .filter(
          ([, membership]) =>
            String(membership?.roleDisplay ?? membership?.roleCode ?? '')
              .trim()
              .toLowerCase() === 'owner'
        )
        .map(([orgId]) => orgsById[orgId]?.name)
        .filter((name): name is string => Boolean(name)),
    [membershipsByOrgId, orgsById]
  );
  const hasOwnedOrganizations = ownerOrgNames.length > 0;

  const handleDelete = useCallback(async () => {
    if (!userId) {
      notify('error', {
        title: 'Unable to delete profile',
        text: 'Missing user identity. Please sign in again.',
      });
      return;
    }
    startRouteLoader();
    try {
      await deleteData(`/fhir/v1/user/${userId}`);
      await signOut();
      router.replace('/signin');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        notify('error', {
          title: 'Unable to delete profile',
          text: error.response?.data?.message ?? error.message,
        });
      } else {
        notify('error', {
          title: 'Unable to delete profile',
          text: 'Please try again.',
        });
      }
      stopRouteLoader();
    }
  }, [notify, router, signOut, userId]);

  const handleOpenDelete = () => {
    if (!hasOwnedOrganizations) {
      setDeletePopup(true);
      return;
    }

    notify('warning', {
      title: 'Transfer ownership first',
      text: `You still own ${ownerOrgNames.join(', ')}. Transfer ownership before deleting your profile.`,
    });
  };

  return (
    <>
      <div className="flex justify-center">
        <Delete href="#" onClick={handleOpenDelete} text="Delete profile" />
      </div>
      <DeleteConfirmationModal
        showModal={deletePopup}
        setShowModal={setDeletePopup}
        title="Delete profile"
        confirmationQuestion="Are you sure you want to delete your profile?"
        itemsToRemove={PROFILE_ITEMS_TO_REMOVE}
        emailPrompt="This cannot be undone. Enter your email address"
        consentLabel="I understand that all profile data will be permanently deleted."
        noteText="Deleting the profile will remove all data and cannot be reversed."
        onDelete={handleDelete}
      />
    </>
  );
};

export default DeleteProfile;
