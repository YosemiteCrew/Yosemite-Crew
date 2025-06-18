export default class ProductCategoryFHIRConverter {
  constructor(data) {
    this.data = data;
  }

  toFHIR() {
    return this.data.map((item) => {
      const category =
        item.itemCategory?.trim() ||
        item.category?.trim() ||
        item.manufacturer?.trim();
      const businessId = item.bussinessId?.trim();

      return {
        resourceType: "Basic",
        id: item._id.toString(),
        code: {
          coding: [
            {
              system: "http://example.org/fhir/item-category",
              code: this._slugify(category),
              display: category,
            },
          ],
          text: category,
        },
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/business-id",
            valueIdentifier: {
              system: "http://example.org/fhir/business-id",
              value: businessId,
            },
          },
        ],
      };
    });
  }

  toFHIRBundle() {
    const entries = this.toFHIR().map((resource) => ({
      resource,
    }));

    return {
      resourceType: "Bundle",
      type: "collection",
      entry: entries,
    };
  }

  _slugify(text) {
    return text?.toLowerCase().replace(/\s+/g, "-");
  }

}

export class InventoryFHIRConverter {
  static toFHIR(item) {
    return {
      resourceType: "SupplyItem",
      id: item._id,
      identifier: [
        {
          system: "http://example.com/fhir/barcode",
          value: item.barcode,
        },
        {
          system: "http://example.com/fhir/batchNumber",
          value: item.batchNumber,
        },
        {
          system: "http://example.com/fhir/sku",
          value: item.sku,
        },
      ],
      manufacturer: {
        display: item.manufacturer,
      },
      quantity: {
        value: item.quantity,
        unit: "units",
      },
      code: {
        coding: [
          {
            system: "http://example.com/fhir/itemCategory",
            code: item.itemCategory,
            display: item.itemName,
          },
        ],
        text: item.genericName,
      },
      extension: [
        {
          url: "http://example.com/fhir/StructureDefinition/strength",
          valueString: item.strength,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/markup",
          valueDecimal: item.markup,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/manufacturerPrice",
          valueDecimal: item.manufacturerPrice,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/price",
          valueDecimal: item.price,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/stockReorderLevel",
          valueInteger: item.stockReorderLevel,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/category",
          valueString: item.category,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/bussinessId",
          valueString: item.bussinessId,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/expiryDate",
          valueDate: item.expiryDate,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/createdAt",
          valueDateTime: item.createdAt,
        },
        {
          url: "http://example.com/fhir/StructureDefinition/updatedAt",
          valueDateTime: item.updatedAt,
        },
      ],
    };
  }

  static fromFHIR(resource) {
    const findExt = (url) => resource.extension?.find((e) => e.url === url);

    return {
      _id: resource.id,
      barcode:
        resource.identifier?.find((i) => i.system.includes("barcode"))?.value ||
        "",
      batchNumber:
        resource.identifier?.find((i) => i.system.includes("batchNumber"))
          ?.value || "",
      sku:
        resource.identifier?.find((i) => i.system.includes("sku"))?.value || "",
      itemName: resource.code?.coding?.[0]?.display || "",
      genericName: resource.code?.text || "",
      itemCategory: resource.code?.coding?.[0]?.code || "",
      manufacturer: resource.manufacturer?.display || "",
      quantity: resource.quantity?.value || 0,
      strength:
        findExt("http://example.com/fhir/StructureDefinition/strength")
          ?.valueString || "",
      markup:
        findExt("http://example.com/fhir/StructureDefinition/markup")
          ?.valueDecimal || 0,
      manufacturerPrice:
        findExt("http://example.com/fhir/StructureDefinition/manufacturerPrice")
          ?.valueDecimal || 0,
      price:
        findExt("http://example.com/fhir/StructureDefinition/price")
          ?.valueDecimal || 0,
      stockReorderLevel:
        findExt("http://example.com/fhir/StructureDefinition/stockReorderLevel")
          ?.valueInteger || 0,
      category:
        findExt("http://example.com/fhir/StructureDefinition/category")
          ?.valueString || "",
      bussinessId:
        findExt("http://example.com/fhir/StructureDefinition/bussinessId")
          ?.valueString || "",
      expiryDate:
        findExt("http://example.com/fhir/StructureDefinition/expiryDate")
          ?.valueDate || "",
      createdAt:
        findExt("http://example.com/fhir/StructureDefinition/createdAt")
          ?.valueDateTime || "",
      updatedAt:
        findExt("http://example.com/fhir/StructureDefinition/updatedAt")
          ?.valueDateTime || "",
    };
  }
}
export class InventoryBundleFHIRConverter {
  static toFHIR(inventoryResponse) {
    const { totalItems, totalPages, currentPage, inventory } =
      inventoryResponse;

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: totalItems,
      meta: {
        tag: [
          {
            system: "http://example.com/fhir/StructureDefinition/totalPages",
            code: `${totalPages}`,
          },
          {
            system: "http://example.com/fhir/StructureDefinition/currentPage",
            code: `${currentPage}`,
          },
        ],
      },
      entry: inventory.map((item) => ({
        resource: InventoryFHIRConverter.toFHIR(item),
      })),
    };
  }

  static fromFHIR(fhirBundle) {
    const totalItems = fhirBundle.total || 0;

    const totalPages = parseInt(
      fhirBundle.meta?.tag?.find(
        (t) =>
          t.system === "http://example.com/fhir/StructureDefinition/totalPages"
      )?.code || "1"
    );

    const currentPage = parseInt(
      fhirBundle.meta?.tag?.find(
        (t) =>
          t.system === "http://example.com/fhir/StructureDefinition/currentPage"
      )?.code || "1"
    );

    const inventory = (fhirBundle.entry || []).map((entry) =>
      InventoryFHIRConverter.fromFHIR(entry.resource)
    );

    return {
      totalItems,
      totalPages,
      currentPage,
      inventory,
    };
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ApproachingExpiryReportConverter graph>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

export class ApproachingExpiryReportConverter {
  /**
   * Convert your custom expiry summary to FHIR InventoryReport format
   * @param {Array} reportData - e.g., [{ category: '7 days', totalCount: 4 }]
   * @param {Object} options - Additional FHIR context like business ID, report period, etc.
   */
  static toFHIR(reportData, options = {}) {
    const now = new Date().toISOString();

    return {
      resourceType: "InventoryReport",
      status: "available",
      countType: "snapshot",
      reportedDateTime: now,
      reporter: {
        identifier: {
          system: "http://yourdomain.com/business",
          value: options.userId || "unknown",
        },
      },
      note: [
        {
          text: "Summary of items approaching expiry within 7/15/30/60 days",
        },
      ],
      extension: reportData.map((entry) => ({
        url: "http://yourdomain.com/fhir/StructureDefinition/expiry-summary",
        extension: [
          {
            url: "category",
            valueString: entry.category,
          },
          {
            url: "totalCount",
            valueInteger: entry.totalCount,
          },
        ],
      })),
    };
  }

  /**
   * Convert FHIR InventoryReport (customized) back to your graph format
   * @param {Object} fhirData - The FHIR InventoryReport resource
   */
  static fromFHIR(fhirData) {
    if (!fhirData.extension || !Array.isArray(fhirData.extension)) return [];

    return fhirData.extension.map((ext) => {
      const category =
        ext.extension.find((e) => e.url === "category")?.valueString || "";
      const totalCount =
        ext.extension.find((e) => e.url === "totalCount")?.valueInteger || 0;
      return { category, totalCount };
    });
  }
}

//  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<    ProcedurePackage >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// FHIR ProcedurePackageItem
export class FHIRProcedurePackageItem {
  constructor({ name, itemType, quantity, unitPrice, subtotal, notes, _id }) {
    this.resourceType = "SupplyDelivery";
    this.id = _id;
    this.identifier = [{ use: "official", value: _id }];
    this.suppliedItem = {
      quantity: {
        value: quantity,
        unit: itemType,
      },
      itemCodeableConcept: {
        text: name,
      },
    };
    this.extension = [
      {
        url: "http://example.org/fhir/StructureDefinition/unitPrice",
        valueMoney: { value: unitPrice, currency: "INR" },
      },
      {
        url: "http://example.org/fhir/StructureDefinition/subtotal",
        valueMoney: { value: subtotal, currency: "INR" },
      },
      {
        url: "http://example.org/fhir/StructureDefinition/notes",
        valueString: notes,
      },
    ];
  }
}

// FHIR ProcedurePackage
export class FHIRProcedurePackage {
  constructor(packageData) {
    this.resourceType = "CarePlan";
    this.id = packageData._id;
    this.identifier = [{ use: "official", value: packageData._id }];
    this.status = "active";
    this.intent = "plan";
    this.title = packageData.packageName;
    this.category = [
      {
        coding: [
          {
            system: "http://example.org/fhir/package-category",
            code: packageData.category,
            display: packageData.category,
          },
        ],
      },
    ];
    this.description = packageData.description;
    this.subject = {
      identifier: {
        value: packageData.bussinessId,
      },
    };
    this.created = packageData.createdAt;
    this.meta = {
      lastUpdated: packageData.updatedAt,
    };
    this.extension = [
      {
        url: "http://example.org/fhir/StructureDefinition/totalSubtotal",
        valueMoney: { value: packageData.totalSubtotal, currency: "INR" },
      },
      {
        url: "http://example.org/fhir/StructureDefinition/formattedUpdatedAt",
        valueString: packageData.formattedUpdatedAt,
      },
    ];
    this.activity = packageData.packageItems.map((item) => ({
      reference: {
        reference: `SupplyDelivery/${item._id}`,
        display: item.name,
      },
    }));
    this.contained = packageData.packageItems.map(
      (item) => new FHIRProcedurePackageItem(item)
    );
  }
}
function convertProcedurePackagesToFHIRBundle(apiResponse) {
  const { data, metadata, totalItems, totalPages } = apiResponse;

  return {
    resourceType: "Bundle",
    type: "collection",
    total: totalItems,
    meta: {
      tag: [
        {
          system: "http://example.org/fhir/StructureDefinition/totalPages",
          code: `${totalPages}`,
        },
        {
          system: "http://example.org/fhir/StructureDefinition/currentPage",
          code: `${metadata?.page || 1}`,
        },
        {
          system: "http://example.org/fhir/StructureDefinition/itemsPerPage",
          code: `${metadata?.limit || 10}`,
        },
      ],
    },
    entry: data.map((packageData) => {
      const fhirPackage = new FHIRProcedurePackage(packageData);
      return {
        fullUrl: `urn:uuid:${fhirPackage.id}`,
        resource: fhirPackage,
      };
    }),
  };
}
export class ProcedurePackageFHIR {
  constructor(fhirData) {
    this.fhirData = fhirData;
  }

  fromFHIR() {
    const { id, title, description, propertyGroup } = this.fhirData;

    const packageItems =
      propertyGroup?.[0]?.priceComponent.map((item, index) => ({
        name: item.code?.text?.split(" - ")[0] || "",
        itemType: item.code?.text?.split(" - ")[1] || "",
        quantity: item.factor,
        unitPrice: item.amount?.value,
        subtotal: item.factor * item.amount?.value,
        notes:
          item.extension?.find((ext) => ext.url.includes("package-item-notes"))
            ?.valueString || "",
        _id: `${id}-${index}`,
        key: index,
      })) || [];

    return {
      id,
      packageName: title,
      category: "", // FHIR doesn’t include this directly; you may need to store this separately
      description,
      packageItems,
    };
  }
}
