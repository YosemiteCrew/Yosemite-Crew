import Delete from "@/app/ui/primitives/Buttons/Delete";
import DeleteConfirmationModal from "@/app/ui/overlays/Modal/DeleteConfirmationModal";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import { deleteOrg } from "@/app/features/organization/services/orgService";
import { PERMISSIONS } from "@/app/lib/permissions";
import React, { useState } from "react";

const ORG_ITEMS_TO_REMOVE = [
  "All organization settings",
  "Rooms, teams, users & roles",
  "Appointments, tasks & history",
  "Inventory, finance & documents",
  "Companions/pet records",
  "Subscription & billing data",
];

const DeleteOrg = () => {
  const [deletePopup, setDeletePopup] = useState(false);

  return (
    <PermissionGate allOf={[PERMISSIONS.ORG_DELETE]}>
      <div className="flex justify-center">
        <Delete
          href="#"
          onClick={() => setDeletePopup(true)}
          text="Delete organization"
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
