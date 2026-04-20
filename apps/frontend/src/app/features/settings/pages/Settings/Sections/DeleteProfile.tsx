import Delete from '@/app/ui/primitives/Buttons/Delete';
import DeleteConfirmationModal from '@/app/ui/overlays/Modal/DeleteConfirmationModal';
import { useSignOut } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useState, useCallback } from 'react';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';

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

  const handleDelete = useCallback(async () => {
    startRouteLoader();
    try {
      await signOut();
      router.replace('/signin');
    } catch {
      stopRouteLoader();
    }
  }, [signOut, router]);

  return (
    <>
      <div className="flex justify-center">
        <Delete href="#" onClick={() => setDeletePopup(true)} text="Delete profile" />
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
