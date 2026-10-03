import {
  canBePermitHolder,
  canCloseRefusedShipment,
  canImportDomesticSerial,
  canTransferResearchStock,
  canUsePermitForShipment,
  importedSerialAvailability,
  refusedShipmentDispositionDueOn,
  shipmentApplicationExceptions,
  type ImportPermit,
} from "../../../src/services/pharma/biologics-import-permits";

const permit: ImportPermit = {
  purpose: "distribution-sale",
  holderId: "importer-1",
  status: "active",
  useBy: "2026-06-30",
  shipmentIds: [],
};

const shipment = {
  id: "shipment-1",
  arrivalOn: "2026-06-30",
  importerId: "importer-1",
};

describe("canUsePermitForShipment", () => {
  it("allows the first shipment on the permit's last usable day", () => {
    expect(canUsePermitForShipment(permit, shipment)).toEqual({
      allowed: true,
    });
  });

  it("refuses a permit with no usable date", () => {
    expect(
      canUsePermitForShipment({ ...permit, useBy: null }, shipment),
    ).toEqual({ allowed: false, reason: "permit-date-required" });
  });

  it("refuses an arrival after the permit date", () => {
    expect(
      canUsePermitForShipment(permit, {
        ...shipment,
        arrivalOn: "2026-07-01",
      }),
    ).toEqual({ allowed: false, reason: "permit-expired" });
  });

  it.each(["suspended", "revoked"] as const)(
    "refuses a %s permit",
    (status) => {
      expect(canUsePermitForShipment({ ...permit, status }, shipment)).toEqual({
        allowed: false,
        reason: "permit-not-active",
      });
    },
  );

  it("refuses an importer other than the permit holder", () => {
    expect(
      canUsePermitForShipment(permit, {
        ...shipment,
        importerId: "affiliate-2",
      }),
    ).toEqual({ allowed: false, reason: "permit-holder-mismatch" });
  });

  it("refuses a second shipment without a covering authorisation", () => {
    expect(
      canUsePermitForShipment(
        { ...permit, shipmentIds: ["shipment-1"] },
        { ...shipment, id: "shipment-2" },
      ),
    ).toEqual({
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    });
  });

  it("allows only the shipments and dates named by a successive-shipment authorisation", () => {
    const successivePermit: ImportPermit = {
      ...permit,
      shipmentIds: ["shipment-1"],
      successiveShipmentAuthorisation: {
        shipmentIds: ["shipment-2"],
        validFrom: "2026-06-01",
        validUntil: "2026-06-30",
      },
    };
    expect(
      canUsePermitForShipment(successivePermit, {
        ...shipment,
        id: "shipment-2",
      }),
    ).toEqual({ allowed: true });
    expect(
      canUsePermitForShipment(successivePermit, {
        ...shipment,
        id: "shipment-3",
      }),
    ).toEqual({
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    });
    expect(
      canUsePermitForShipment(successivePermit, {
        ...shipment,
        id: "shipment-2",
        arrivalOn: "2026-05-31",
      }),
    ).toEqual({
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    });
  });

  it("refuses malformed arrival and permit dates", () => {
    expect(() =>
      canUsePermitForShipment(permit, { ...shipment, arrivalOn: "tomorrow" }),
    ).toThrow(RangeError);
    expect(() =>
      canUsePermitForShipment({ ...permit, useBy: "2026-02-30" }, shipment),
    ).toThrow(RangeError);
  });
});

describe("application and serial controls", () => {
  it.each([
    [{ hasUsResidence: true, hasUsBusinessEstablishment: false }, true],
    [{ hasUsResidence: false, hasUsBusinessEstablishment: true }, true],
    [{ hasUsResidence: false, hasUsBusinessEstablishment: false }, false],
  ])("checks the permit holder's United States presence", (input, expected) => {
    expect(canBePermitHolder(input)).toBe(expected);
  });

  it("raises port and quantity exceptions independently", () => {
    expect(
      shipmentApplicationExceptions({
        expectedPort: "JFK",
        actualPort: "LAX",
        estimatedQuantity: 100,
        actualQuantity: 101,
      }),
    ).toEqual(["port-changed", "quantity-exceeded"]);
    expect(
      shipmentApplicationExceptions({
        expectedPort: "JFK",
        actualPort: "JFK",
        estimatedQuantity: 100,
        actualQuantity: 100,
      }),
    ).toEqual([]);
  });

  it("allows a foreign-made serial", () => {
    expect(
      canImportDomesticSerial({
        purpose: "distribution-sale",
        madeAtUsEstablishment: false,
        inVitroReturn: false,
        permitHolderIsProducer: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows a domestic serial only for an in-vitro research return held by its producer", () => {
    expect(
      canImportDomesticSerial({
        purpose: "research-evaluation",
        madeAtUsEstablishment: true,
        inVitroReturn: true,
        permitHolderIsProducer: true,
      }),
    ).toEqual({ allowed: true });
    for (const input of [
      {
        purpose: "distribution-sale" as const,
        inVitroReturn: true,
        permitHolderIsProducer: true,
      },
      {
        purpose: "research-evaluation" as const,
        inVitroReturn: false,
        permitHolderIsProducer: true,
      },
      {
        purpose: "research-evaluation" as const,
        inVitroReturn: true,
        permitHolderIsProducer: false,
      },
    ]) {
      expect(
        canImportDomesticSerial({ ...input, madeAtUsEstablishment: true }),
      ).toEqual({
        allowed: false,
        reason: "domestic-serial-not-importable",
      });
    }
  });

  it("keeps each imported serial quarantined until that shipment is released", () => {
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-1",
      }),
    ).toBe("quarantined");
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-2",
        release: { shipmentId: "shipment-1", releasedOn: "2026-06-10" },
      }),
    ).toBe("quarantined");
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-1",
        release: { shipmentId: "shipment-1", releasedOn: "2026-06-10" },
      }),
    ).toBe("released");
  });

  it.each(["research-evaluation", "transit-only"] as const)(
    "never releases %s stock to the catalogue",
    (purpose) => {
      expect(
        importedSerialAvailability({
          purpose,
          shipmentId: "shipment-1",
          release: { shipmentId: "shipment-1", releasedOn: "2026-06-10" },
        }),
      ).toBe("quarantined");
    },
  );
});

describe("research transfers", () => {
  const authorisations = [
    {
      destinationId: "trial-site-1",
      validFrom: "2026-06-01",
      validUntil: "2026-06-30",
    },
  ];

  it("allows a destination covered on the transfer date", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        transferOn: "2026-06-30",
        authorisations,
      }),
    ).toEqual({ allowed: true });
  });

  it.each([
    ["trial-site-2", "2026-06-15"],
    ["trial-site-1", "2026-07-01"],
  ])("refuses uncovered destination %s on %s", (destinationId, transferOn) => {
    expect(
      canTransferResearchStock({
        destinationId,
        transferOn,
        authorisations,
      }),
    ).toEqual({
      allowed: false,
      reason: "shipping-authorisation-required",
    });
  });
});

describe("refused shipment disposition", () => {
  it("sets a 30-day deadline only for Distribution and Sale findings", () => {
    expect(
      refusedShipmentDispositionDueOn({
        purpose: "distribution-sale",
        findingOn: "2026-06-01",
      }),
    ).toBe("2026-07-01");
    expect(
      refusedShipmentDispositionDueOn({
        purpose: "research-evaluation",
        findingOn: "2026-06-01",
      }),
    ).toBeNull();
    expect(
      refusedShipmentDispositionDueOn({
        purpose: "transit-only",
        findingOn: "2026-06-01",
      }),
    ).toBeNull();
  });

  it("allows return only to origin after every permit number is removed", () => {
    expect(
      canCloseRefusedShipment({
        kind: "return",
        countryOfOrigin: "CA",
        destinationCountry: "CA",
        permitNumberRemovedFromEveryUnit: true,
      }),
    ).toEqual({ allowed: true });
    expect(
      canCloseRefusedShipment({
        kind: "return",
        countryOfOrigin: "CA",
        destinationCountry: "MX",
        permitNumberRemovedFromEveryUnit: true,
      }),
    ).toEqual({ allowed: false, reason: "return-to-origin-required" });
    expect(
      canCloseRefusedShipment({
        kind: "return",
        countryOfOrigin: "CA",
        destinationCountry: "CA",
        permitNumberRemovedFromEveryUnit: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "permit-number-removal-required",
    });
  });

  it("allows destruction by USDA, not by the importer", () => {
    expect(
      canCloseRefusedShipment({ kind: "destruction", performedBy: "usda" }),
    ).toEqual({ allowed: true });
    expect(
      canCloseRefusedShipment({
        kind: "destruction",
        performedBy: "importer",
      }),
    ).toEqual({ allowed: false, reason: "usda-destruction-required" });
  });
});
