class InventoryFHIRParser {
  constructor(FHIRdata) {
    this.FHIRdata = FHIRdata;
  }
  convertToNormaldata() {
    const groupedData = [];

    this.FHIRdata.entry.map((entry) => {
      groupedData.push({
        label: entry.resource.code.text,
        value: entry.resource.id,
      });
    });
    return groupedData;
  }

  toFHIR() {
    console.log("this.FHIRdata.entry", this.FHIRdata);
    return [this.FHIRdata].map((item) => ({
      resourceType: "Basic",
      id: item.bussinessId,
      code: {
        coding: [
          {
            system: "http://example.org/fhir/inventory",
            code: this._slugify(item.itemName || "unknown"),
            display: item.itemName || "unknown",
          },
        ],
        text: item.itemName || "unknown",
      },

      extension: this._buildExtensions(item),
    }));
  }

  _buildExtensions(item) {
    const extensions = [];

    for (const [key, value] of Object.entries(item)) {
      if (key === "_id" || key === "__v") continue;
      if (value !== undefined && value !== null && value !== "") {
        extensions.push({
          url: `http://example.org/fhir/StructureDefinition/${this._slugify(key)}`,
          valueString: value.toString(),
        });
      }
    }

    return extensions;
  }

  _slugify(text) {
    return text.toLowerCase().replace(/\s+/g, "-");
  }

  toFHIRBundle() {
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: this.toFHIR().map((resource) => ({
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      })),
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
class InventoryBundleFHIRConverter {
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
      InventoryFHIRParser.fromFHIR(entry.resource)
    );

    return {
      totalItems,
      totalPages,
      currentPage,
      inventory,
    };
  }
}

class ApproachingExpiryReportConverter {
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

export {
  InventoryFHIRParser,
  InventoryBundleFHIRConverter,
  ApproachingExpiryReportConverter,
};
