import React, { useState } from "react";
import { Secondary } from "@/app/ui/primitives/Buttons";
import { getPaymentLink } from "@/app/features/billing/services/invoiceService";

type InvoicePaymentActionsProps = {
  invoiceId?: string;
  stripeReceiptUrl?: string;
};

const InvoicePaymentActions = ({
  invoiceId,
  stripeReceiptUrl,
}: InvoicePaymentActionsProps) => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      if (!invoiceId) return;
      const url = await getPaymentLink(invoiceId);
      if (typeof url === "string") {
        setGeneratedLink(url);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleCopy = async () => {
    try {
      if (!generatedLink) return;
      await navigator.clipboard.writeText(generatedLink);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDownload = () => {
    globalThis.open(stripeReceiptUrl, "_blank");
  };

  if (stripeReceiptUrl) {
    return <Secondary text="Download" href="#" onClick={handleDownload} />;
  }

  return (
    <>
      {generatedLink ? (
        <Secondary text="Copy link" href="#" onClick={handleCopy} />
      ) : null}
      <Secondary
        text="Generate & Mail link"
        href="#"
        onClick={handleGenerate}
        isDisabled={!invoiceId}
      />
    </>
  );
};

export default InvoicePaymentActions;
