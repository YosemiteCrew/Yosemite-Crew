import { addCalendarDays } from "./personal-data-rights";

export const BIOLOGICS_PERMIT_PURPOSES = [
  "research-evaluation",
  "distribution-sale",
  "transit-only",
] as const;

export type BiologicsPermitPurpose = (typeof BIOLOGICS_PERMIT_PURPOSES)[number];

export type ShipmentAuthorisation = {
  shipmentIds: readonly string[];
  validFrom: string;
  validUntil: string;
};

export type ImportPermit = {
  purpose: BiologicsPermitPurpose;
  holderId: string;
  status: "active" | "suspended" | "revoked";
  useBy: string | null;
  shipmentIds: readonly string[];
  successiveShipmentAuthorisation?: ShipmentAuthorisation | null;
};

export type ImportShipment = {
  id: string;
  arrivalOn: string;
  importerId: string;
};

export type PermitUseDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "permit-date-required"
        | "permit-expired"
        | "permit-not-active"
        | "permit-holder-mismatch"
        | "successive-shipment-authorisation-required";
    };

const authorisesShipment = (
  authorisation: ShipmentAuthorisation | null | undefined,
  shipment: ImportShipment,
): boolean =>
  Boolean(
    authorisation &&
    authorisation.shipmentIds.includes(shipment.id) &&
    shipment.arrivalOn >= authorisation.validFrom &&
    shipment.arrivalOn <= authorisation.validUntil,
  );

/** Checks the rules that determine whether a permit can cover an arrival. */
export const canUsePermitForShipment = (
  permit: ImportPermit,
  shipment: ImportShipment,
): PermitUseDecision => {
  addCalendarDays(shipment.arrivalOn, 0);
  if (permit.useBy === null) {
    return { allowed: false, reason: "permit-date-required" };
  }
  addCalendarDays(permit.useBy, 0);
  if (shipment.arrivalOn > permit.useBy) {
    return { allowed: false, reason: "permit-expired" };
  }
  if (permit.status !== "active") {
    return { allowed: false, reason: "permit-not-active" };
  }
  if (shipment.importerId !== permit.holderId) {
    return { allowed: false, reason: "permit-holder-mismatch" };
  }
  if (
    permit.shipmentIds.length > 0 &&
    !authorisesShipment(permit.successiveShipmentAuthorisation, shipment)
  ) {
    return {
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    };
  }
  return { allowed: true };
};

export type ShipmentApplicationCheck = {
  expectedPort: string;
  actualPort: string;
  estimatedQuantity: number;
  actualQuantity: number;
};

export type ShipmentException = "port-changed" | "quantity-exceeded";

export const shipmentApplicationExceptions = (
  check: ShipmentApplicationCheck,
): ShipmentException[] => {
  const exceptions: ShipmentException[] = [];
  if (check.actualPort !== check.expectedPort) exceptions.push("port-changed");
  if (check.actualQuantity > check.estimatedQuantity) {
    exceptions.push("quantity-exceeded");
  }
  return exceptions;
};

export const canBePermitHolder = (organisation: {
  hasUsResidence: boolean;
  hasUsBusinessEstablishment: boolean;
}): boolean =>
  organisation.hasUsResidence || organisation.hasUsBusinessEstablishment;

export type DomesticSerialDecision =
  | { allowed: true }
  | { allowed: false; reason: "domestic-serial-not-importable" };

export const canImportDomesticSerial = (input: {
  purpose: BiologicsPermitPurpose;
  madeAtUsEstablishment: boolean;
  inVitroReturn: boolean;
  permitHolderIsProducer: boolean;
}): DomesticSerialDecision => {
  if (!input.madeAtUsEstablishment) return { allowed: true };
  return input.purpose === "research-evaluation" &&
    input.inVitroReturn &&
    input.permitHolderIsProducer
    ? { allowed: true }
    : { allowed: false, reason: "domestic-serial-not-importable" };
};

export type SerialAvailability = "quarantined" | "released";

/** A release applies only to the serial on the shipment USDA released. */
export const importedSerialAvailability = (input: {
  purpose: BiologicsPermitPurpose;
  shipmentId: string;
  release?: { shipmentId: string; releasedOn: string } | null;
}): SerialAvailability => {
  if (input.purpose !== "distribution-sale" || !input.release) {
    return "quarantined";
  }
  addCalendarDays(input.release.releasedOn, 0);
  return input.release.shipmentId === input.shipmentId
    ? "released"
    : "quarantined";
};

export type ResearchTransferDecision =
  | { allowed: true }
  | { allowed: false; reason: "shipping-authorisation-required" };

export const canTransferResearchStock = (input: {
  destinationId: string;
  transferOn: string;
  authorisations: readonly {
    destinationId: string;
    validFrom: string;
    validUntil: string;
  }[];
}): ResearchTransferDecision => {
  addCalendarDays(input.transferOn, 0);
  const covered = input.authorisations.some(
    (authorisation) =>
      authorisation.destinationId === input.destinationId &&
      input.transferOn >= authorisation.validFrom &&
      input.transferOn <= authorisation.validUntil,
  );
  return covered
    ? { allowed: true }
    : { allowed: false, reason: "shipping-authorisation-required" };
};

export const refusedShipmentDispositionDueOn = (input: {
  purpose: BiologicsPermitPurpose;
  findingOn: string;
}): string | null =>
  input.purpose === "distribution-sale"
    ? addCalendarDays(input.findingOn, 30)
    : null;

export type RefusedShipmentDisposition =
  | {
      kind: "return";
      countryOfOrigin: string;
      destinationCountry: string;
      permitNumberRemovedFromEveryUnit: boolean;
    }
  | { kind: "destruction"; performedBy: "usda" | "importer" };

export type DispositionDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "return-to-origin-required"
        | "permit-number-removal-required"
        | "usda-destruction-required";
    };

export const canCloseRefusedShipment = (
  disposition: RefusedShipmentDisposition,
): DispositionDecision => {
  if (disposition.kind === "destruction") {
    return disposition.performedBy === "usda"
      ? { allowed: true }
      : { allowed: false, reason: "usda-destruction-required" };
  }
  if (disposition.destinationCountry !== disposition.countryOfOrigin) {
    return { allowed: false, reason: "return-to-origin-required" };
  }
  return disposition.permitNumberRemovedFromEveryUnit
    ? { allowed: true }
    : { allowed: false, reason: "permit-number-removal-required" };
};
