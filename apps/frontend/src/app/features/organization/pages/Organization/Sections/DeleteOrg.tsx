import { Secondary } from '@/app/ui/primitives/Buttons';
import DeleteConfirmationModal from '@/app/ui/overlays/Modal/DeleteConfirmationModal';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { deleteOrg } from '@/app/features/organization/services/orgService';
import { PERMISSIONS } from '@/app/lib/permissions';
import React, { useState } from 'react';

const ORG_ITEMS_TO_REMOVE = [
  'All organization settings',
  'Rooms, teams, users & roles',
  'Appointments, tasks & history',
  'Inventory, finance & documents',
  'Companions/pet records',
  'Subscription & billing data',
];

const DeleteOrg = () => {
  const [deletePopup, setDeletePopup] = useState(false);

  return (
    <PermissionGate allOf={[PERMISSIONS.ORG_DELETE]}>
      <div className="mt-auto flex items-center gap-3 rounded-[18px] border border-[var(--danger-border)] px-5! py-[14px]!">
        <div className="flex-1">
          <div className="text-[13px] font-bold text-[var(--danger-text)]">Delete organization</div>
          <div className="text-[11.5px] text-[var(--ink-faint)]">
            Removes the clinic and revokes all team access
          </div>
        </div>
        <Secondary
          danger
          href="#"
          text="Delete organization"
          onClick={() => setDeletePopup(true)}
          className="min-h-0! h-[34px]! px-[15px]! text-[12px]! font-bold!"
        />
      </div>
      <DeleteConfirmationModal
        showModal={deletePopup}
        setShowModal={setDeletePopup}
        title="Delete organization"
        confirmationQuestion="Are you sure you want to delete this organization?"
        itemsToRemove={ORG_ITEMS_TO_REMOVE}
        emailPrompt="This cannot be undone. Enter owner email address"
        consentLabel="I understand that all data will be permanently deleted."
        noteText="Deleting the organization will remove all data and cannot be reversed."
        onDelete={deleteOrg}
      />
    </PermissionGate>
  );
};

export default DeleteOrg;
