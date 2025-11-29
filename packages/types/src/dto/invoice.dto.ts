import { Invoice as FHIRInvoice } from "@yosemite-crew/fhirtypes";
import { Invoice, toFHIRInvoice, fromFHIRInvoice } from "../invoice";

export type InvoiceRequestDTO = FHIRInvoice;
export type InvoiceResponseDTO = FHIRInvoice;

export const fromInvoiceRequestDTO = (
  dto: InvoiceRequestDTO
) : Invoice => {
  if (!dto || dto.resourceType !== "Invoice") {
    throw new Error("Invalid payload. Expected FHIR Invoice resource.");
  }
  return fromFHIRInvoice(dto);
}

export const toInvoiceResponseDTO = (
  invoice: Invoice
) : InvoiceResponseDTO => {
 return toFHIRInvoice(invoice);
}