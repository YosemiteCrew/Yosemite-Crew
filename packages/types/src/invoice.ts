import {
  Invoice as FHIRInvoice,
  InvoiceLineItem,
  Currency,
  Extension,
} from "@yosemite-crew/fhirtypes";
import dayjs from "dayjs";

export type InvoiceStatus =
  | "PENDING"          
  | "AWAITING_PAYMENT" 
  | "PAID"             
  | "FAILED"           
  | "CANCELLED"        
  | "REFUNDED";

export type InvoiceItem = {
  id?: string;                
  name: string;               
  description?: string | null;
  quantity: number;           
  unitPrice: number;          
  discountPercent?: number;   
  total: number;              
};

export type Invoice = {
  id?: string;                 
  parentId?: string;           
  companionId?: string;       
  organisationId?: string;
  appointmentId?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxPercent?: number;
  totalAmount: number;       

  currency: Currency;            

  stripePaymentIntentId?: string;
  stripePaymentLinkId?: string; 
  stripeInvoiceId?: string;      
  stripeCustomerId?: string;

  status: InvoiceStatus;

  metadata?: Record<string, string | number | boolean>;

  createdAt: Date;
  updatedAt: Date;
}

const EXT_STRIPE_INVOICE_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-invoice-id";
const EXT_STRIPE_PI_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id";
const EXT_STRIPE_PL_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-link-id";
const EXT_STRIPE_CUSTOMER_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-customer-id";
const EXT_PMS_STATUS = "https://yosemitecrew.com/fhir/StructureDefinition/pms-invoice-status";
const EXT_INVOICE_METADATA = "https://yosemitecrew.com/fhir/StructureDefinition/invoice-metadata";
const EXT_APPOINTMENT_ID = "https://yosemitecrew.com/fhir/StructureDefinition/appointment-id";
const LINE_ITEM_SYSTEM = "https://yosemitecrew.com/fhir/CodeSystem/invoice-line-item";

const statusMap: Record<InvoiceStatus, FHIRInvoice["status"]> = {
  PENDING: "draft",
  AWAITING_PAYMENT: "issued",
  PAID: "balanced",
  FAILED: "entered-in-error",
  CANCELLED: "cancelled",
  REFUNDED: "balanced",
};

const statusMapReverse: Record<FHIRInvoice["status"], InvoiceStatus> = {
  draft: "PENDING",
  issued: "AWAITING_PAYMENT",
  balanced: "PAID",
  cancelled: "CANCELLED",
  "entered-in-error": "FAILED",
};

const buildMetadataExtension = (metadata?: Record<string, string | number | boolean>): Extension | undefined => {
  if (!metadata) return undefined;

  const nested: Extension[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    const entry: Extension = { url: key };
    if (typeof value === "string") {
      entry.valueString = value;
    } else if (typeof value === "number") {
      entry.valueDecimal = value;
    } else if (typeof value === "boolean") {
      entry.valueBoolean = value;
    } else {
      continue;
    }
    nested.push(entry);
  }

  if (!nested.length) return undefined;

  return {
    url: EXT_INVOICE_METADATA,
    extension: nested,
  };
};

const parseMetadataExtension = (extension?: Extension[]): Record<string, string | number | boolean> | undefined => {
  const metadataExt = extension?.find((ext) => ext.url === EXT_INVOICE_METADATA);
  if (!metadataExt?.extension?.length) return undefined;

  const metadata: Record<string, string | number | boolean> = {};
  for (const ext of metadataExt.extension) {
    if (ext.valueString !== undefined) {
      metadata[ext.url] = ext.valueString;
    } else if (ext.valueDecimal !== undefined) {
      metadata[ext.url] = ext.valueDecimal;
    } else if (ext.valueBoolean !== undefined) {
      metadata[ext.url] = ext.valueBoolean;
    }
  }

  return Object.keys(metadata).length ? metadata : undefined;
};

const buildLineItemPriceComponents = (
  item: InvoiceItem,
  currency: Currency,
): InvoiceLineItem["priceComponent"] => {
  const components: InvoiceLineItem["priceComponent"] = [
    {
      type: "base",
      factor: item.quantity,
      amount: {
        value: item.unitPrice,
        currency,
      },
    },
  ];

  if (item.discountPercent != null) {
    const discountAmount = item.unitPrice * item.quantity * (item.discountPercent / 100);
    components.push({
      type: "discount",
      factor: item.discountPercent / 100,
      amount: {
        value: discountAmount,
        currency,
      },
    });
  }

  components.push({
    type: "informational",
    code: { text: "line-total" },
    amount: {
      value: item.total,
      currency,
    },
  });

  return components;
};

const buildTotalPriceComponents = (invoice: Invoice): FHIRInvoice["totalPriceComponent"] => {
  const components: FHIRInvoice["totalPriceComponent"] = [
    {
      type: "base",
      amount: {
        value: invoice.subtotal,
        currency: invoice.currency,
      },
    },
  ];

  if (invoice.taxPercent != null) {
    components.push({
      type: "tax",
      factor: invoice.taxPercent / 100,
      amount: {
        value: invoice.subtotal * (invoice.taxPercent / 100),
        currency: invoice.currency,
      },
    });
  }

  components.push({
    type: "informational",
    code: { text: "grand-total" },
    amount: {
      value: invoice.totalAmount,
      currency: invoice.currency,
    },
  });

  return components;
};

export function toFHIRInvoice(invoice: Invoice): FHIRInvoice {
  const lineItems: InvoiceLineItem[] = invoice.items.map((item, index) => ({
    sequence: index + 1,
    chargeItemCodeableConcept: {
      text: item.description ?? item.name,
      coding: [
        {
          system: LINE_ITEM_SYSTEM,
          code: item.id ?? item.name,
          display: item.name,
        },
      ],
    },
    priceComponent: buildLineItemPriceComponents(item, invoice.currency),
  }));

  const extensions: Extension[] = [];

  const metadataExt = buildMetadataExtension(invoice.metadata);
  if (metadataExt) extensions.push(metadataExt);

  if (invoice.stripeInvoiceId) {
    extensions.push({
      url: EXT_STRIPE_INVOICE_ID,
      valueString: invoice.stripeInvoiceId,
    });
  }

  if (invoice.stripePaymentIntentId) {
    extensions.push({
      url: EXT_STRIPE_PI_ID,
      valueString: invoice.stripePaymentIntentId,
    });
  }

  if (invoice.stripePaymentLinkId) {
    extensions.push({
      url: EXT_STRIPE_PL_ID,
      valueString: invoice.stripePaymentLinkId,
    });
  }

  if (invoice.stripeCustomerId) {
    extensions.push({
      url: EXT_STRIPE_CUSTOMER_ID,
      valueString: invoice.stripeCustomerId,
    });
  }

  extensions.push({
    url: EXT_PMS_STATUS,
    valueString: invoice.status,
  });

  extensions.push({
    url: EXT_APPOINTMENT_ID,
    valueString: invoice.appointmentId,
  });

  const fhirInvoice: FHIRInvoice = {
    resourceType: "Invoice",
    id: invoice.id,
    status: statusMap[invoice.status] ?? "draft",
    subject: invoice.companionId
      ? {
          reference: `Patient/${invoice.companionId}`,
        }
      : undefined,
    recipient: {
      reference: `RelatedPerson/${invoice.parentId}`,
    },
    issuer: {
      reference: `Organization/${invoice.organisationId}`,
    },
    account: {
      reference: `Appointment/${invoice.appointmentId}`,
    },
    date: dayjs(invoice.createdAt).toISOString(),
    lineItem: lineItems,
    totalPriceComponent: buildTotalPriceComponents(invoice),
    totalNet: {
      value: invoice.subtotal,
      currency: invoice.currency,
    },
    totalGross: {
      value: invoice.totalAmount,
      currency: invoice.currency,
    },
    meta: {
      lastUpdated: dayjs(invoice.updatedAt).toISOString(),
    },
    extension: extensions.length ? extensions : undefined,
  };

  return fhirInvoice;
}

const parseLineItems = (lineItems?: InvoiceLineItem[]): InvoiceItem[] => {
  if (!lineItems?.length) return [];

  return lineItems.map((lineItem) => {
    const baseComponent = lineItem.priceComponent?.find((pc) => pc.type === "base");
    const discountComponent = lineItem.priceComponent?.find((pc) => pc.type === "discount");
    const informationalComponent = lineItem.priceComponent?.find((pc) => pc.type === "informational");

    const quantity = baseComponent?.factor ?? 1;
    const unitPrice = baseComponent?.amount?.value ?? 0;
    const discountPercent = discountComponent?.factor != null ? discountComponent.factor * 100 : undefined;
    const discountAmount = discountComponent?.amount?.value ?? 0;

    const computedTotal = unitPrice * quantity - discountAmount;
    const total = informationalComponent?.amount?.value ?? computedTotal;

    const coding = lineItem.chargeItemCodeableConcept?.coding?.[0];

    return {
      id: coding?.code,
      name: coding?.display ?? coding?.code ?? lineItem.chargeItemCodeableConcept?.text ?? "",
      description: lineItem.chargeItemCodeableConcept?.text,
      quantity,
      unitPrice,
      discountPercent,
      total,
    };
  });
};

const parseTotalValues = (
  fhirInvoice: FHIRInvoice,
  lineItems: InvoiceItem[],
): { subtotal: number; totalAmount: number; taxPercent?: number; currency: Currency } => {
  const baseComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "base");
  const taxComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "tax");
  const informationalComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "informational");
  const lineItemBase = fhirInvoice.lineItem?.[0]?.priceComponent?.find((pc) => pc.type === "base");

  const currency = (
    fhirInvoice.totalGross?.currency ||
    fhirInvoice.totalNet?.currency ||
    baseComponent?.amount?.currency ||
    lineItemBase?.amount?.currency ||
    "USD"
  ) as Currency;

  const subtotal =
    fhirInvoice.totalNet?.value ??
    baseComponent?.amount?.value ??
    lineItems.reduce((acc, item) => acc + item.total, 0);

  const totalAmount =
    fhirInvoice.totalGross?.value ??
    informationalComponent?.amount?.value ??
    subtotal + (taxComponent?.amount?.value ?? 0);

  const taxPercent = taxComponent?.factor != null ? taxComponent.factor * 100 : undefined;

  return {
    subtotal,
    totalAmount,
    taxPercent,
    currency,
  };
};

export function fromFHIRInvoice(fhirInvoice: FHIRInvoice): Invoice {
  const statusExtension = fhirInvoice.extension?.find((ext) => ext.url === EXT_PMS_STATUS);
  const pmsStatus = (statusExtension?.valueString as InvoiceStatus | undefined) ?? statusMapReverse[fhirInvoice.status] ?? "PENDING";

  const lineItems = parseLineItems(fhirInvoice.lineItem);
  const { subtotal, totalAmount, taxPercent, currency } = parseTotalValues(fhirInvoice, lineItems);

  const metadata = parseMetadataExtension(fhirInvoice.extension);

  const getIdFromReference = (reference?: string) => reference?.split("/")[1];

  return {
    id: fhirInvoice.id ?? "",
    parentId: getIdFromReference(fhirInvoice.recipient?.reference) ?? "",
    companionId: getIdFromReference(fhirInvoice.subject?.reference),
    organisationId: getIdFromReference(fhirInvoice.issuer?.reference) ?? "",
    appointmentId:
      fhirInvoice.extension?.find((ext) => ext.url === EXT_APPOINTMENT_ID)?.valueString ??
      getIdFromReference(fhirInvoice.account?.reference) ??
      "",
    items: lineItems,
    subtotal,
    taxPercent,
    totalAmount,
    currency,
    stripePaymentIntentId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_PI_ID)?.valueString,
    stripePaymentLinkId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_PL_ID)?.valueString,
    stripeInvoiceId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_INVOICE_ID)?.valueString,
    stripeCustomerId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CUSTOMER_ID)?.valueString,
    status: pmsStatus,
    metadata,
    createdAt: fhirInvoice.date ? new Date(fhirInvoice.date) : new Date(),
    updatedAt: fhirInvoice.meta?.lastUpdated ? new Date(fhirInvoice.meta.lastUpdated) : new Date(),
  };
}
