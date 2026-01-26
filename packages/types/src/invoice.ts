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

export type PaymentCollectionMethod = "PAYMENT_INTENT" | "PAYMENT_LINK";

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

  paymentCollectionMethod: PaymentCollectionMethod;

  currency: Currency;            

  discountTotal?: number;
  taxTotal?: number;

  stripeChargeId?: string;
  stripeReceiptUrl?: string;
  stripePaymentIntentId?: string;
  stripePaymentLinkId?: string; 
  stripeInvoiceId?: string;      
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
  stripeCheckoutUrl?: string;

  status: InvoiceStatus;

  metadata?: Record<string, string | number | boolean>;
  paidAt?: Date
  createdAt: Date;
  updatedAt: Date;
}

const EXT_STRIPE_INVOICE_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-invoice-id";
const EXT_STRIPE_PI_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id";
const EXT_STRIPE_PL_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-link-id";
const EXT_STRIPE_CUSTOMER_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-customer-id";
const EXT_STRIPE_CHARGE_ID = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-charge-id";
const EXT_STRIPE_RECEIPT_URL = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-receipt-url";
const EXT_STRIPE_CHECKOUT_SESSION_ID =
  "https://yosemitecrew.com/fhir/StructureDefinition/stripe-checkout-session-id";
const EXT_STRIPE_CHECKOUT_URL = "https://yosemitecrew.com/fhir/StructureDefinition/stripe-checkout-url";
const EXT_PAYMENT_COLLECTION_METHOD =
  "https://yosemitecrew.com/fhir/StructureDefinition/payment-collection-method";
const EXT_PAID_AT = "https://yosemitecrew.com/fhir/StructureDefinition/paid-at";
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

  if (invoice.discountTotal != null) {
    components.push({
      type: "discount",
      amount: {
        value: invoice.discountTotal,
        currency: invoice.currency,
      },
    });
  }

  if (invoice.taxPercent != null || invoice.taxTotal != null) {
    const taxableAmount = invoice.subtotal - (invoice.discountTotal ?? 0);
    const taxAmount =
      invoice.taxTotal != null
        ? invoice.taxTotal
        : taxableAmount * ((invoice.taxPercent ?? 0) / 100);

    components.push({
      type: "tax",
      factor: invoice.taxPercent != null ? invoice.taxPercent / 100 : undefined,
      amount: {
        value: taxAmount,
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

  if (invoice.stripeChargeId) {
    extensions.push({
      url: EXT_STRIPE_CHARGE_ID,
      valueString: invoice.stripeChargeId,
    });
  }

  if (invoice.stripeReceiptUrl) {
    extensions.push({
      url: EXT_STRIPE_RECEIPT_URL,
      valueUri: invoice.stripeReceiptUrl,
    });
  }

  if (invoice.stripeCheckoutSessionId) {
    extensions.push({
      url: EXT_STRIPE_CHECKOUT_SESSION_ID,
      valueString: invoice.stripeCheckoutSessionId,
    });
  }

  if (invoice.stripeCheckoutUrl) {
    extensions.push({
      url: EXT_STRIPE_CHECKOUT_URL,
      valueUri: invoice.stripeCheckoutUrl,
    });
  }

  if (invoice.paymentCollectionMethod) {
    extensions.push({
      url: EXT_PAYMENT_COLLECTION_METHOD,
      valueString: invoice.paymentCollectionMethod,
    });
  }

  if (invoice.paidAt) {
    extensions.push({
      url: EXT_PAID_AT,
      valueDateTime: invoice.paidAt.toISOString(),
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
      value: invoice.subtotal - (invoice.discountTotal ?? 0),
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
): {
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  totalAmount: number;
  taxPercent?: number;
  currency: Currency;
} => {
  const baseComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "base");
  const discountComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "discount");
  const taxComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "tax");
  const informationalComponent = fhirInvoice.totalPriceComponent?.find((pc) => pc.type === "informational");
  const lineItemBase = fhirInvoice.lineItem?.[0]?.priceComponent?.find((pc) => pc.type === "base");

  const currency = (
    fhirInvoice.totalGross?.currency ||
    fhirInvoice.totalNet?.currency ||
    baseComponent?.amount?.currency ||
    taxComponent?.amount?.currency ||
    discountComponent?.amount?.currency ||
    lineItemBase?.amount?.currency ||
    "USD"
  ) as Currency;

  const subtotalFromBase = baseComponent?.amount?.value;
  const subtotalFromLineItemBase = lineItems.length
    ? lineItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)
    : undefined;
  const subtotalFromNetAndDiscount =
    fhirInvoice.totalNet?.value != null && discountComponent?.amount?.value != null
      ? fhirInvoice.totalNet.value + discountComponent.amount.value
      : undefined;

  const subtotal =
    subtotalFromBase ??
    subtotalFromLineItemBase ??
    subtotalFromNetAndDiscount ??
    (fhirInvoice.totalNet?.value != null ? fhirInvoice.totalNet.value + (discountComponent?.amount?.value ?? 0) : undefined) ??
    (lineItems.length ? lineItems.reduce((acc, item) => acc + item.total, 0) : 0);

  let discountTotal = discountComponent?.amount?.value;
  if (discountTotal == null && subtotal != null && fhirInvoice.totalNet?.value != null) {
    const inferredDiscount = subtotal - fhirInvoice.totalNet.value;
    discountTotal = inferredDiscount !== 0 ? inferredDiscount : undefined;
  }

  const netAfterDiscount =
    fhirInvoice.totalNet?.value != null ? fhirInvoice.totalNet.value : subtotal - (discountTotal ?? 0);

  let taxTotal =
    taxComponent?.amount?.value ??
    (taxComponent?.factor != null && netAfterDiscount != null ? netAfterDiscount * taxComponent.factor : undefined);

  let totalAmount =
    fhirInvoice.totalGross?.value ??
    informationalComponent?.amount?.value ??
    (netAfterDiscount != null ? netAfterDiscount + (taxTotal ?? 0) : undefined) ??
    subtotal;

  const taxPercent =
    taxComponent?.factor != null
      ? taxComponent.factor * 100
      : taxTotal != null && netAfterDiscount != null
        ? (taxTotal / netAfterDiscount) * 100
        : undefined;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    totalAmount,
    taxPercent,
    currency,
  };
};

export function fromFHIRInvoice(fhirInvoice: FHIRInvoice): Invoice {
  const statusExtension = fhirInvoice.extension?.find((ext) => ext.url === EXT_PMS_STATUS);
  const pmsStatus = (statusExtension?.valueString as InvoiceStatus | undefined) ?? statusMapReverse[fhirInvoice.status] ?? "PENDING";

  const lineItems = parseLineItems(fhirInvoice.lineItem);
  const { subtotal, discountTotal, taxTotal, totalAmount, taxPercent, currency } = parseTotalValues(fhirInvoice, lineItems);

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
    discountTotal,
    taxPercent,
    taxTotal,
    totalAmount,
    currency,
    stripePaymentIntentId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_PI_ID)?.valueString,
    stripePaymentLinkId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_PL_ID)?.valueString,
    stripeInvoiceId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_INVOICE_ID)?.valueString,
    stripeCustomerId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CUSTOMER_ID)?.valueString,
    stripeChargeId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CHARGE_ID)?.valueString,
    stripeReceiptUrl:
      fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_RECEIPT_URL)?.valueUri ??
      fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_RECEIPT_URL)?.valueString,
    stripeCheckoutSessionId: fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CHECKOUT_SESSION_ID)?.valueString,
    stripeCheckoutUrl:
      fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CHECKOUT_URL)?.valueUri ??
      fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CHECKOUT_URL)?.valueUrl ??
      fhirInvoice.extension?.find((ext) => ext.url === EXT_STRIPE_CHECKOUT_URL)?.valueString,
    paymentCollectionMethod: (fhirInvoice.extension?.find((ext) => ext.url === EXT_PAYMENT_COLLECTION_METHOD)
      ?.valueString as PaymentCollectionMethod | undefined) ?? "PAYMENT_INTENT",
    status: pmsStatus,
    metadata,
    paidAt: fhirInvoice.extension?.find((ext) => ext.url === EXT_PAID_AT)?.valueDateTime
      ? new Date(fhirInvoice.extension?.find((ext) => ext.url === EXT_PAID_AT)?.valueDateTime as string)
      : undefined,
    createdAt: fhirInvoice.date ? new Date(fhirInvoice.date) : new Date(),
    updatedAt: fhirInvoice.meta?.lastUpdated ? new Date(fhirInvoice.meta.lastUpdated) : new Date(),
  };
}
