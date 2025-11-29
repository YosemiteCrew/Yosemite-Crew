import { BackboneElement } from './BackboneElement';
import { CodeableConcept } from './CodeableConcept';
import { Extension } from './Extension';
import { Identifier } from './Identifier';
import { Meta } from './Meta';
import { Money } from './Money';
import { Narrative } from './Narrative';
import { Reference } from './Reference';
import { Resource } from './Resource';

/**
 * Invoice containing collected ChargeItems from an Account with calculated total price for billing purpose.
 */
export interface Invoice {
  readonly resourceType: 'Invoice';
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: Resource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
  identifier?: Identifier[];
  status: InvoiceStatus;
  cancelledReason?: string;
  type?: CodeableConcept;
  subject?: Reference;
  recipient?: Reference;
  date?: string;
  participant?: InvoiceParticipant[];
  issuer?: Reference;
  account?: Reference;
  lineItem?: InvoiceLineItem[];
  totalPriceComponent?: InvoiceLineItemPriceComponent[];
  totalNet?: Money;
  totalGross?: Money;
  paymentTerms?: string;
  note?: InvoiceNote[];
}

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'balanced'
  | 'cancelled'
  | 'entered-in-error';

export interface InvoiceParticipant extends BackboneElement {
  role?: CodeableConcept;
  actor?: Reference;
}

export interface InvoiceLineItem extends BackboneElement {
  sequence?: number;
  chargeItemReference?: Reference;
  chargeItemCodeableConcept?: CodeableConcept;
  priceComponent?: InvoiceLineItemPriceComponent[];
}

export type InvoicePriceComponentType =
  | 'base'
  | 'surcharge'
  | 'deduction'
  | 'discount'
  | 'tax'
  | 'informational';

export interface InvoiceLineItemPriceComponent extends BackboneElement {
  type: InvoicePriceComponentType;
  code?: CodeableConcept;
  factor?: number;
  amount?: Money;
}

export interface InvoiceNote {
  id?: string;
  extension?: Extension[];
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}
