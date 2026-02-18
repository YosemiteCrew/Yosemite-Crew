import Accordion from "@/app/ui/primitives/Accordion/Accordion";
import React, { useState } from "react";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions";
import Fallback from "@/app/ui/overlays/Fallback";
import { useInvoicesForPrimaryOrgAppointment } from "@/app/hooks/useInvoices";
import { Appointment } from "@yosemite-crew/types";
import { formatDateLabel } from "@/app/lib/forms";
import { getStatusStyle } from "@/app/ui/tables/InvoiceTable";
import { toTitle } from "@/app/lib/validators";
import { Secondary } from "@/app/ui/primitives/Buttons";
import { getPaymentLink } from "@/app/features/billing/services/invoiceService";
import { useCurrencyForPrimaryOrg } from "@/app/hooks/useBilling";
import { formatMoney } from "@/app/lib/money";

type DetailsProps = {
  activeAppointment: Appointment;
};

const Details = ({ activeAppointment }: DetailsProps) => {
  const currency = useCurrencyForPrimaryOrg();
  const invoices = useInvoicesForPrimaryOrgAppointment(activeAppointment.id);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>(
    {},
  );

  const handleGenerate = async (id: string | undefined) => {
    try {
      if (!id) {
        return;
      }
      const url = await getPaymentLink(id);
      if (typeof url === "string") {
        setGeneratedLinks((prev) => ({ ...prev, [id]: url }));
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDownload = (link: string | undefined) => {
    globalThis.open(link, "_blank");
  };

  return (
    <PermissionGate
      allOf={[PERMISSIONS.BILLING_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <div className="flex flex-col gap-6">
          {invoices.map((payment, i) => {
            const generatedUrl =
              payment.id == null ? undefined : generatedLinks[payment.id];

            return (
              <Accordion
                key={payment.appointmentId}
                title={"Invoice " + (i + 1)}
                defaultOpen={true}
                showEditIcon={false}
                isEditing={true}
              >
                <div className="flex flex-col">
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Appointent ID:{" "}
                    </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {payment.appointmentId}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Date:{" "}
                    </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatDateLabel(payment.createdAt)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light  justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Subtotal:{" "}
                    </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.subtotal, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light  justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Discount:{" "}
                    </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.discountTotal ?? 0, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Tax:{" "}
                    </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.taxTotal ?? 0, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Amount:{" "}
                    </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.totalAmount, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">
                      Status:{" "}
                    </div>
                    <div
                      className="rounded-2xl px-4 py-2"
                      style={getStatusStyle(payment.status)}
                    >
                      {toTitle(payment.status)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 mt-2">
                    {payment.stripeReceiptUrl ? (
                      <Secondary
                        text="Download"
                        href=""
                        onClick={() => handleDownload(payment.stripeReceiptUrl)}
                      />
                    ) : (
                      <>
                        {generatedUrl ? (
                          <Secondary
                            text="Copy link"
                            href="#"
                            onClick={() => handleCopy(generatedUrl)}
                          />
                        ) : null}
                        <Secondary
                          text="Generate & Mail link"
                          href="#"
                          onClick={() => handleGenerate(payment.id)}
                        />
                      </>
                    )}
                  </div>
                </div>
              </Accordion>
            );
          })}
        </div>
      </div>
    </PermissionGate>
  );
};

export default Details;
