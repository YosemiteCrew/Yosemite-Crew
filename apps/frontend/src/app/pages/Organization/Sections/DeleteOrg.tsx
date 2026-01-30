import Delete from "@/app/components/Buttons/Delete";
import DeleteConfirmationModal from "@/app/components/Modal/DeleteConfirmationModal";
import { PermissionGate } from "@/app/components/PermissionGate";
import { deleteOrg } from "@/app/services/orgService";
import { PERMISSIONS } from "@/app/utils/permissions";
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
