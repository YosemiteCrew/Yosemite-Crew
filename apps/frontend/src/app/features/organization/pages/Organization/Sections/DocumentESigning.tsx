import React from "react";
import AccordionButton from "@/app/ui/primitives/Accordion/AccordionButton";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions";
import DocSigningPortal from "@/app/features/docSigning/components/DocSigningPortal";

const DocumentESigning = () => {
  return (
    <PermissionGate allOf={[PERMISSIONS.DOCUMENT_VIEW_ANY]}>
      <AccordionButton title="Document e-signing" showButton={false} keepMounted>
        <DocSigningPortal embedded />
      </AccordionButton>
    </PermissionGate>
  );
};

export default DocumentESigning;
