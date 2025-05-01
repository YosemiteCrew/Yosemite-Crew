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

function convertFHIRBundleToNormalFormat(fhirBundle) {
  return {
    metadata: {
      page: parseInt(fhirBundle.meta?.tag?.find(t => t.system.includes("currentPage"))?.code || "1"),
      limit: parseInt(fhirBundle.meta?.tag?.find(t => t.system.includes("itemsPerPage"))?.code || "10")
    },
    totalItems: fhirBundle.total,
    totalPages: parseInt(fhirBundle.meta?.tag?.find(t => t.system.includes("totalPages"))?.code || "1"),
    data: fhirBundle.entry.map(({ resource }) => {
      const packageData = {
        _id: resource.id,
        packageName: resource.title,
        category: resource.category?.[0]?.coding?.[0]?.code || "",
        description: resource.description,
        bussinessId: resource.subject?.identifier?.value,
        createdAt: resource.created,
        updatedAt: resource.meta?.lastUpdated,
        formattedUpdatedAt: resource.extension?.find(ext => ext.url.includes("formattedUpdatedAt"))?.valueString,
        totalSubtotal: resource.extension?.find(ext => ext.url.includes("totalSubtotal"))?.valueMoney?.value,
        packageItems: (resource.contained || []).map((item) => ({
          _id: item.id,
          name: item.suppliedItem?.itemCodeableConcept?.text,
          itemType: item.suppliedItem?.quantity?.unit,
          quantity: item.suppliedItem?.quantity?.value,
          unitPrice: item.extension?.find(ext => ext.url.includes("unitPrice"))?.valueMoney?.value,
          subtotal: item.extension?.find(ext => ext.url.includes("subtotal"))?.valueMoney?.value,
          notes: item.extension?.find(ext => ext.url.includes("notes"))?.valueString
        }))
      };
      return packageData;
    })
  };
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<fhir ProcedurePackage>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
class MedicalPackageFHIR {
  constructor(packageData) {
    // Ensure that resourceType is correctly set
    this.resourceType = "ProcedureRequest";  // This should be a valid FHIR resource type
    this.id = packageData.packageName;       // Unique identifier for the resource
    this.category = {
      coding: [
        {
          system: "http://example.com/category-system", // Use a valid coding system URL here
          code: packageData.category,
        },
      ],
    };
    this.description = packageData.description;
    this.item = packageData.packageItems.map((item) => new PackageItemFHIR(item));
  }

  toFHIR() {
    return {
      resourceType: this.resourceType, // This is the key property!
      id: this.id,
      category: this.category,
      description: this.description,
      item: this.item.map((item) => item.toFHIR()),
    };
  }
}

class PackageItemFHIR {
  constructor(itemData) {
    this.medicationCodeableConcept = {
      coding: [
        {
          system: "http://example.com/medication-system", // Use a valid medication system URL here
          code: itemData.name,
        },
      ],
    };
    this.itemType = itemData.itemType;
    this.quantity = {
      value: itemData.quantity,  // Ensure quantity is numeric and has a unit
      unit: "count", // Specify the unit (could be count, mg, etc.)
    };
    this.unitPrice = itemData.unitPrice;
    this.subtotal = itemData.subtotal;
    this.notes = itemData.notes;
  }

  toFHIR() {
    return {
      medicationCodeableConcept: this.medicationCodeableConcept,
      itemType: this.itemType,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      subtotal: this.subtotal,
      notes: this.notes,
    };
  }
}
//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FHIR ProcedurePackageItem For Update>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
class ProcedurePackageFHIR {
  constructor(data) {
    this.data = data;
  }

  toFHIR() {
    const { id, packageName, description, packageItems } = this.data;

    return {
      resourceType: "ChargeItemDefinition",
      id,
      status: "active",
      title: packageName,
      description,
      code: {
        coding: [
          {
            system: "http://example.org/procedure-packages",
            code: id,
            display: packageName
          }
        ]
      },
      propertyGroup: [
        {
          applicability: [
            {
              description: "Applicable to veterinary surgical procedures"
            }
          ],
          priceComponent: packageItems.map(item => ({
            type: "base",
            code: { text: `${item.name} - ${item.itemType}` },
            factor: item.quantity,
            amount: {
              value: item.unitPrice,
              currency: "INR"
            },
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/package-item-notes",
                valueString: item.notes
              }
            ]
          }))
        }
      ]
    };
  }
}


export {
  InventoryFHIRParser,
  InventoryBundleFHIRConverter,
  ApproachingExpiryReportConverter,
  convertFHIRBundleToNormalFormat,
  MedicalPackageFHIR,
  ProcedurePackageFHIR
};
