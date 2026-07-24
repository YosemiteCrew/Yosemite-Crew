import React from 'react';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ProfileDetails from '@/app/features/settings/pages/Settings/Sections/ProfileDetails';
import SecuritySection from '@/app/features/settings/pages/Settings/Sections/SecuritySection';

type ProfileEditModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * "Edit profile" modal reached from the Settings Personal card. Collects the
 * personal-detail editors (identity, address, professional) plus the account
 * security controls that used to sprawl full-width down the page.
 */
const ProfileEditModal = ({ showModal, setShowModal }: ProfileEditModalProps) => (
  <Modal
    showModal={showModal}
    setShowModal={setShowModal}
    variant="centered"
    size="lg"
    aria-label="Edit profile"
  >
    <ModalHeader title="Edit profile" onClose={() => setShowModal(false)} />
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1">
      <ProfileDetails />
      <SecuritySection />
    </div>
  </Modal>
);

export default ProfileEditModal;
