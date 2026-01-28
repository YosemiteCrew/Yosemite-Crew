import React, { useMemo } from "react";
import { CompanionParent } from "@/app/pages/Companions/types";
import CompanionDocumentsSection from "@/app/components/Documents/CompanionDocumentsSection";

type DocumentsType = {
  companion: CompanionParent;
};

const Documents = ({ companion }: DocumentsType) => {
  const companionId = useMemo(() => companion.companion.id, [companion]);
  return <CompanionDocumentsSection companionId={companionId} />;
};

export default Documents;
