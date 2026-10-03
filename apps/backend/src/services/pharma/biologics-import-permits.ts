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
  productId: string;
  holderId: string;
  status: "active" | "suspended" | "revoked";
  issuedOn: string;
  useBy: string | null;
  shipmentIds: readonly string[];
  successiveShipmentAuthorisation?: ShipmentAuthorisation | null;
};

export type ImportShipment = {
  id: string;
  arrivalOn: string;
  importerId: string;
  productId: string;
  intendedPurpose: BiologicsPermitPurpose;
  originCountry: string;
  destinationCountry: string;
  carrier?: string;
  transferSchedule?: {
    transferPort: string;
    scheduledDeparture: string;
    forwardingAccount: string;
  } | null;
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
        | "successive-shipment-authorisation-required"
        | "permit-not-yet-issued"
        | "purpose-mismatch"
        | "product-mismatch"
        | "transit-routing-invalid"
        | "transit-carrier-confinement-required"
        | "transit-schedule-required";
    };

const parseCalendarDate = (value: string): string => {
  const parsed = addCalendarDays(value, 0);
  return parsed;
};

const authorisesShipment = (
  authorisation: ShipmentAuthorisation | null | undefined,
  shipment: ImportShipment,
): boolean => {
  if (!authorisation) return false;

  try {
    const validFrom = parseCalendarDate(authorisation.validFrom);
    const validUntil = parseCalendarDate(authorisation.validUntil);
    const arrivalOn = parseCalendarDate(shipment.arrivalOn);

    return (
      authorisation.shipmentIds.includes(shipment.id) &&
      arrivalOn >= validFrom &&
      arrivalOn <= validUntil
    );
  } catch {
    return false;
  }
};

const checkPermitDates = (
  permit: ImportPermit,
  shipment: ImportShipment,
): PermitUseDecision | null => {
  addCalendarDays(shipment.arrivalOn, 0);
  if (permit.useBy === null) {
    return { allowed: false, reason: "permit-date-required" };
  }
  addCalendarDays(permit.useBy, 0);
  if (shipment.arrivalOn > permit.useBy) {
    return { allowed: false, reason: "permit-expired" };
  }
  addCalendarDays(permit.issuedOn, 0);
  if (shipment.arrivalOn < permit.issuedOn) {
    return { allowed: false, reason: "permit-not-yet-issued" };
  }
  return null;
};

const checkPermitStatus = (
  permit: ImportPermit,
  shipment: ImportShipment,
): PermitUseDecision | null => {
  if (permit.status !== "active") {
    return { allowed: false, reason: "permit-not-active" };
  }
  if (shipment.importerId !== permit.holderId) {
    return { allowed: false, reason: "permit-holder-mismatch" };
  }
  if (shipment.productId !== permit.productId) {
    return { allowed: false, reason: "product-mismatch" };
  }
  if (shipment.intendedPurpose !== permit.purpose) {
    return { allowed: false, reason: "purpose-mismatch" };
  }
  return null;
};

const checkTransitRequirements = (
  shipment: ImportShipment,
): PermitUseDecision | null => {
  if (shipment.originCountry === shipment.destinationCountry) {
    return { allowed: false, reason: "transit-routing-invalid" };
  }
  if (!shipment.carrier) {
    return { allowed: false, reason: "transit-carrier-confinement-required" };
  }
  if (!shipment.transferSchedule) {
    return { allowed: false, reason: "transit-schedule-required" };
  }
  return null;
};

const checkSuccessiveShipment = (
  permit: ImportPermit,
  shipment: ImportShipment,
): PermitUseDecision | null => {
  if (
    permit.shipmentIds.length > 0 &&
    !permit.shipmentIds.includes(shipment.id) &&
    !authorisesShipment(permit.successiveShipmentAuthorisation, shipment)
  ) {
    return {
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    };
  }
  return null;
};

/** Checks the rules that determine whether a permit can cover an arrival. */
export const canUsePermitForShipment = (
  permit: ImportPermit,
  shipment: ImportShipment,
): PermitUseDecision => {
  const dateCheck = checkPermitDates(permit, shipment);
  if (dateCheck) return dateCheck;

  const statusCheck = checkPermitStatus(permit, shipment);
  if (statusCheck) return statusCheck;

  if (permit.purpose === "transit-only") {
    const transitCheck = checkTransitRequirements(shipment);
    if (transitCheck) return transitCheck;
  }

  const successiveCheck = checkSuccessiveShipment(permit, shipment);
  if (successiveCheck) return successiveCheck;

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
  | {
      allowed: false;
      reason:
        | "domestic-serial-not-importable"
        | "unlicensed-product"
        | "quantity-exceeds-small-lot"
        | "endangers-livestock-poultry";
    };

export const canImportDomesticSerial = (input: {
  purpose: BiologicsPermitPurpose;
  madeAtUsEstablishment: boolean;
  inVitroReturn: boolean;
  permitHolderIsProducer: boolean;
  productIsLicensed: boolean;
  isSmallQuantity: boolean;
  endangersLivestockOrPoultry: boolean;
}): DomesticSerialDecision => {
  if (!input.madeAtUsEstablishment) return { allowed: true };
  if (input.purpose !== "research-evaluation") {
    return { allowed: false, reason: "domestic-serial-not-importable" };
  }
  if (!input.inVitroReturn) {
    return { allowed: false, reason: "domestic-serial-not-importable" };
  }
  if (!input.permitHolderIsProducer) {
    return { allowed: false, reason: "domestic-serial-not-importable" };
  }
  if (!input.productIsLicensed) {
    return { allowed: false, reason: "unlicensed-product" };
  }
  if (!input.isSmallQuantity) {
    return { allowed: false, reason: "quantity-exceeds-small-lot" };
  }
  if (input.endangersLivestockOrPoultry) {
    return { allowed: false, reason: "endangers-livestock-poultry" };
  }
  return { allowed: true };
};

export type SerialAvailability = "quarantined" | "released";

export type ReleaseRecord = {
  shipmentId: string;
  serialNumbers: readonly string[];
  releasedOn: string;
};

/** A release applies only to the serial on the shipment USDA released. */
export const importedSerialAvailability = (input: {
  purpose: BiologicsPermitPurpose;
  shipmentId: string;
  serialNumber: string;
  release?: ReleaseRecord | null;
}): SerialAvailability => {
  if (input.purpose !== "distribution-sale" || !input.release) {
    return "quarantined";
  }
  addCalendarDays(input.release.releasedOn, 0);
  return input.release.shipmentId === input.shipmentId &&
    input.release.serialNumbers.includes(input.serialNumber)
    ? "released"
    : "quarantined";
};

export type ResearchTransferAuthorisation = {
  destinationId: string;
  productId: string;
  serialNumbers: readonly string[];
  authorizedQuantity: number;
  validFrom: string;
  validUntil: string;
};

export type ResearchTransferDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "shipping-authorisation-required"
        | "product-not-authorised"
        | "serial-not-authorised"
        | "quantity-exceeds-authorisation"
        | "authorisation-date-invalid";
    };

export const canTransferResearchStock = (input: {
  destinationId: string;
  productId: string;
  serialNumbers: readonly string[];
  quantity: number;
  transferOn: string;
  authorisations: readonly ResearchTransferAuthorisation[];
}): ResearchTransferDecision => {
  addCalendarDays(input.transferOn, 0);
  const covered = input.authorisations.some((authorisation) => {
    try {
      const validFrom = parseCalendarDate(authorisation.validFrom);
      const validUntil = parseCalendarDate(authorisation.validUntil);
      const transferOn = parseCalendarDate(input.transferOn);

      if (transferOn < validFrom || transferOn > validUntil) return false;
      if (authorisation.destinationId !== input.destinationId) return false;
      if (authorisation.productId !== input.productId) return false;
      if (input.serialNumbers.length > 0) {
        const allSerialsAuthorised = input.serialNumbers.every((sn) =>
          authorisation.serialNumbers.includes(sn),
        );
        if (!allSerialsAuthorised) return false;
      }
      if (input.quantity > authorisation.authorizedQuantity) return false;
      return true;
    } catch {
      return false;
    }
  });
  if (!covered) {
    return { allowed: false, reason: "shipping-authorisation-required" };
  }
  return { allowed: true };
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
