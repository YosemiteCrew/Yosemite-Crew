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

const basePermit: ImportPermit = {
  purpose: "distribution-sale",
  productId: "product-1",
  holderId: "importer-1",
  status: "active",
  issuedOn: "2026-06-01",
  useBy: "2026-06-30",
  shipmentIds: [],
};

const baseShipment = {
  id: "shipment-1",
  arrivalOn: "2026-06-15",
  importerId: "importer-1",
  productId: "product-1",
  intendedPurpose: "distribution-sale" as const,
  originCountry: "CA",
  destinationCountry: "US",
  carrier: "Air Canada",
  transferSchedule: null,
};

describe("canUsePermitForShipment", () => {
  it("allows the first shipment on the permit's last usable day", () => {
    expect(canUsePermitForShipment(basePermit, baseShipment)).toEqual({
      allowed: true,
    });
  });

  it("refuses a permit with no usable date", () => {
    expect(
      canUsePermitForShipment({ ...basePermit, useBy: null }, baseShipment),
    ).toEqual({ allowed: false, reason: "permit-date-required" });
  });

  it("refuses an arrival after the permit date", () => {
    expect(
      canUsePermitForShipment(basePermit, {
        ...baseShipment,
        arrivalOn: "2026-07-01",
      }),
    ).toEqual({ allowed: false, reason: "permit-expired" });
  });

  it("refuses an arrival before the permit issuance date", () => {
    expect(
      canUsePermitForShipment(basePermit, {
        ...baseShipment,
        arrivalOn: "2026-05-31",
      }),
    ).toEqual({ allowed: false, reason: "permit-not-yet-issued" });
  });

  it.each(["suspended", "revoked"] as const)(
    "refuses a %s permit",
    (status) => {
      expect(
        canUsePermitForShipment({ ...basePermit, status }, baseShipment),
      ).toEqual({
        allowed: false,
        reason: "permit-not-active",
      });
    },
  );

  it("refuses an importer other than the permit holder", () => {
    expect(
      canUsePermitForShipment(basePermit, {
        ...baseShipment,
        importerId: "affiliate-2",
      }),
    ).toEqual({ allowed: false, reason: "permit-holder-mismatch" });
  });

  it("refuses a shipment with a different product than the permit", () => {
    expect(
      canUsePermitForShipment(basePermit, {
        ...baseShipment,
        productId: "product-2",
      }),
    ).toEqual({ allowed: false, reason: "product-mismatch" });
  });

  it("refuses a shipment with a different intended purpose than the permit", () => {
    expect(
      canUsePermitForShipment(basePermit, {
        ...baseShipment,
        intendedPurpose: "research-evaluation",
      }),
    ).toEqual({ allowed: false, reason: "purpose-mismatch" });
  });

  it("refuses a second shipment without a covering authorisation", () => {
    expect(
      canUsePermitForShipment(
        { ...basePermit, shipmentIds: ["shipment-1"] },
        { ...baseShipment, id: "shipment-2" },
      ),
    ).toEqual({
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    });
  });

  it("allows the original shipment when rechecked after being recorded", () => {
    const permitWithRecordedShipment: ImportPermit = {
      ...basePermit,
      shipmentIds: ["shipment-1"],
    };
    expect(
      canUsePermitForShipment(permitWithRecordedShipment, baseShipment),
    ).toEqual({ allowed: true });
  });

  it("allows only the shipments and dates named by a successive-shipment authorisation", () => {
    const successivePermit: ImportPermit = {
      ...basePermit,
      shipmentIds: ["shipment-1"],
      successiveShipmentAuthorisation: {
        shipmentIds: ["shipment-2"],
        validFrom: "2026-06-01",
        validUntil: "2026-06-30",
      },
    };
    expect(
      canUsePermitForShipment(successivePermit, {
        ...baseShipment,
        id: "shipment-2",
      }),
    ).toEqual({ allowed: true });
    expect(
      canUsePermitForShipment(successivePermit, {
        ...baseShipment,
        id: "shipment-3",
      }),
    ).toEqual({
      allowed: false,
      reason: "successive-shipment-authorisation-required",
    });
    expect(
      canUsePermitForShipment(successivePermit, {
        ...baseShipment,
        id: "shipment-2",
        arrivalOn: "2026-06-01",
      }),
    ).toEqual({
      allowed: true,
    });
    expect(
      canUsePermitForShipment(successivePermit, {
        ...baseShipment,
        id: "shipment-2",
        arrivalOn: "2026-06-30",
      }),
    ).toEqual({
      allowed: true,
    });
    expect(
      canUsePermitForShipment(successivePermit, {
        ...baseShipment,
        id: "shipment-2",
        arrivalOn: "2026-07-01",
      }),
    ).toEqual({
      allowed: false,
      reason: "permit-expired",
    });
  });

  it("refuses malformed arrival and permit dates", () => {
    expect(() =>
      canUsePermitForShipment(basePermit, {
        ...baseShipment,
        arrivalOn: "tomorrow",
      }),
    ).toThrow(RangeError);
    expect(() =>
      canUsePermitForShipment(
        { ...basePermit, useBy: "2026-02-30" },
        baseShipment,
      ),
    ).toThrow(RangeError);
    expect(() =>
      canUsePermitForShipment(
        { ...basePermit, issuedOn: "not-a-date" },
        baseShipment,
      ),
    ).toThrow(RangeError);
  });

  describe("transit-only permits", () => {
    const transitPermit: ImportPermit = {
      ...basePermit,
      purpose: "transit-only",
    };
    const transitShipment = {
      ...baseShipment,
      intendedPurpose: "transit-only" as const,
      originCountry: "CA",
      destinationCountry: "MX",
      carrier: "FedEx",
      transferSchedule: {
        transferPort: "LAX",
        scheduledDeparture: "2026-06-20",
        forwardingAccount: "FWD-123",
      },
    };

    it("allows a valid transit shipment", () => {
      expect(canUsePermitForShipment(transitPermit, transitShipment)).toEqual({
        allowed: true,
      });
    });

    it("refuses transit shipment with same origin and destination", () => {
      expect(
        canUsePermitForShipment(transitPermit, {
          ...transitShipment,
          destinationCountry: "CA",
        }),
      ).toEqual({ allowed: false, reason: "transit-routing-invalid" });
    });

    it("refuses transit shipment without carrier", () => {
      expect(
        canUsePermitForShipment(transitPermit, {
          ...transitShipment,
          carrier: undefined,
        }),
      ).toEqual({
        allowed: false,
        reason: "transit-carrier-confinement-required",
      });
    });

    it("refuses transit shipment without transfer schedule", () => {
      expect(
        canUsePermitForShipment(transitPermit, {
          ...transitShipment,
          transferSchedule: null,
        }),
      ).toEqual({ allowed: false, reason: "transit-schedule-required" });
    });

    it("refuses transit shipment with distribution-sale purpose", () => {
      expect(
        canUsePermitForShipment(transitPermit, {
          ...transitShipment,
          intendedPurpose: "distribution-sale",
        }),
      ).toEqual({ allowed: false, reason: "purpose-mismatch" });
    });
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
        productIsLicensed: true,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows a domestic serial only for an in-vitro research return held by its producer with all conditions met", () => {
    expect(
      canImportDomesticSerial({
        purpose: "research-evaluation",
        madeAtUsEstablishment: true,
        inVitroReturn: true,
        permitHolderIsProducer: true,
        productIsLicensed: true,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: false,
      }),
    ).toEqual({ allowed: true });
  });

  it.each([
    {
      name: "wrong purpose (distribution-sale)",
      input: {
        purpose: "distribution-sale" as const,
        inVitroReturn: true,
        permitHolderIsProducer: true,
        productIsLicensed: true,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: false,
      },
      reason: "domestic-serial-not-importable",
    },
    {
      name: "not in-vitro return",
      input: {
        purpose: "research-evaluation" as const,
        inVitroReturn: false,
        permitHolderIsProducer: true,
        productIsLicensed: true,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: false,
      },
      reason: "domestic-serial-not-importable",
    },
    {
      name: "holder is not producer",
      input: {
        purpose: "research-evaluation" as const,
        inVitroReturn: true,
        permitHolderIsProducer: false,
        productIsLicensed: true,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: false,
      },
      reason: "domestic-serial-not-importable",
    },
    {
      name: "unlicensed product",
      input: {
        purpose: "research-evaluation" as const,
        inVitroReturn: true,
        permitHolderIsProducer: true,
        productIsLicensed: false,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: false,
      },
      reason: "unlicensed-product",
    },
    {
      name: "quantity exceeds small lot",
      input: {
        purpose: "research-evaluation" as const,
        inVitroReturn: true,
        permitHolderIsProducer: true,
        productIsLicensed: true,
        isSmallQuantity: false,
        endangersLivestockOrPoultry: false,
      },
      reason: "quantity-exceeds-small-lot",
    },
    {
      name: "endangers livestock or poultry",
      input: {
        purpose: "research-evaluation" as const,
        inVitroReturn: true,
        permitHolderIsProducer: true,
        productIsLicensed: true,
        isSmallQuantity: true,
        endangersLivestockOrPoultry: true,
      },
      reason: "endangers-livestock-poultry",
    },
  ])("refuses domestic serial when $name", ({ input, reason }) => {
    expect(
      canImportDomesticSerial({ ...input, madeAtUsEstablishment: true }),
    ).toEqual({ allowed: false, reason });
  });

  it("keeps each imported serial quarantined until that shipment and serial is released", () => {
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-1",
        serialNumber: "serial-A",
      }),
    ).toBe("quarantined");
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-2",
        serialNumber: "serial-B",
        release: {
          shipmentId: "shipment-1",
          serialNumbers: ["serial-A"],
          releasedOn: "2026-06-10",
        },
      }),
    ).toBe("quarantined");
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-1",
        serialNumber: "serial-B",
        release: {
          shipmentId: "shipment-1",
          serialNumbers: ["serial-A"],
          releasedOn: "2026-06-10",
        },
      }),
    ).toBe("quarantined");
    expect(
      importedSerialAvailability({
        purpose: "distribution-sale",
        shipmentId: "shipment-1",
        serialNumber: "serial-A",
        release: {
          shipmentId: "shipment-1",
          serialNumbers: ["serial-A"],
          releasedOn: "2026-06-10",
        },
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
          serialNumber: "serial-A",
          release: {
            shipmentId: "shipment-1",
            serialNumbers: ["serial-A"],
            releasedOn: "2026-06-10",
          },
        }),
      ).toBe("quarantined");
    },
  );
});

describe("research transfers", () => {
  const authorisations = [
    {
      destinationId: "trial-site-1",
      productId: "product-1",
      serialNumbers: ["serial-A", "serial-B"],
      authorizedQuantity: 100,
      validFrom: "2026-06-01",
      validUntil: "2026-06-30",
    },
  ];

  it("allows a destination covered on the transfer date with matching product, serials, and quantity", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        productId: "product-1",
        serialNumbers: ["serial-A"],
        quantity: 50,
        transferOn: "2026-06-15",
        authorisations,
      }),
    ).toEqual({ allowed: true });
  });

  it("refuses when destination is not authorised", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-2",
        productId: "product-1",
        serialNumbers: ["serial-A"],
        quantity: 50,
        transferOn: "2026-06-15",
        authorisations,
      }),
    ).toEqual({ allowed: false, reason: "shipping-authorisation-required" });
  });

  it("refuses when transfer date is outside authorisation window", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        productId: "product-1",
        serialNumbers: ["serial-A"],
        quantity: 50,
        transferOn: "2026-07-01",
        authorisations,
      }),
    ).toEqual({ allowed: false, reason: "shipping-authorisation-required" });
  });

  it("refuses when product does not match authorisation", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        productId: "product-2",
        serialNumbers: ["serial-A"],
        quantity: 50,
        transferOn: "2026-06-15",
        authorisations,
      }),
    ).toEqual({ allowed: false, reason: "shipping-authorisation-required" });
  });

  it("refuses when serial is not in authorisation", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        productId: "product-1",
        serialNumbers: ["serial-C"],
        quantity: 50,
        transferOn: "2026-06-15",
        authorisations,
      }),
    ).toEqual({ allowed: false, reason: "shipping-authorisation-required" });
  });

  it("refuses when quantity exceeds authorisation", () => {
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        productId: "product-1",
        serialNumbers: ["serial-A"],
        quantity: 150,
        transferOn: "2026-06-15",
        authorisations,
      }),
    ).toEqual({ allowed: false, reason: "shipping-authorisation-required" });
  });

  it("refuses when authorisation has malformed dates", () => {
    const badAuth = [
      {
        destinationId: "trial-site-1",
        productId: "product-1",
        serialNumbers: ["serial-A"],
        authorizedQuantity: 100,
        validFrom: "not-a-date",
        validUntil: "2026-06-30",
      },
    ];
    expect(
      canTransferResearchStock({
        destinationId: "trial-site-1",
        productId: "product-1",
        serialNumbers: ["serial-A"],
        quantity: 50,
        transferOn: "2026-06-15",
        authorisations: badAuth,
      }),
    ).toEqual({ allowed: false, reason: "shipping-authorisation-required" });
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
