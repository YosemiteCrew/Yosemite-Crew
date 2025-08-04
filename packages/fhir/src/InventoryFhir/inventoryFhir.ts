
import type {InventoryType, InventoryOverviewFHIRBundle, InventoryOverviewType, InventoryOverviewFHIRObservation, FHIRBundle, CategoryJson, InventoryTypes} from "@yosemite-crew/types";



export const convertToNormalFromFhirInventoryData = (fhirData: any): InventoryType => {
  const extensions = fhirData.extension || [];

  const getExtensionValue = (urlKey: string): any => {
    const ext = extensions.find((e: any) => e.url.endsWith(urlKey));
    return ext?.valueString || ext?.valueDecimal || ext?.valueDate || undefined;
  };

  return {
    barCode: getExtensionValue("barCode"),
    category: getExtensionValue("category"),
    itemName: fhirData.code?.text,
    genericName: getExtensionValue("genericName"),
    department: getExtensionValue("department"),
    sexType: getExtensionValue("sexType"),
    manufacturer: fhirData.manufacturer?.display,
    itemCategory: getExtensionValue("itemCategory"),
    speciesSpecific1: getExtensionValue("speciesSpecific1"),
    speciesSpecific2: getExtensionValue("speciesSpecific2"),
    onHand: getExtensionValue("onHand"),
    perQtyPrice: getExtensionValue("perQtyPrice"),
    batchNumber: getExtensionValue("batchNumber"),
    sku: getExtensionValue("sku"),
    strength: getExtensionValue("strength"),
    quantity: Number(fhirData.amount?.value || 0),
    manufacturerPrice: getExtensionValue("manufacturerPrice"),
    markup: getExtensionValue("markup"),
    upc: getExtensionValue("upc"),
    price: getExtensionValue("price"),
    stockReorderLevel: getExtensionValue("stockReorderLevel"),
    expiryDate: getExtensionValue("expiryDate")
      ? new Date(getExtensionValue("expiryDate")).toISOString()
      : "",
  };
};




export const convertToFhirInventoryData = (data: InventoryType): any => {
  return {
    resourceType: "Medication",
    code: {
      text: data.itemName,
    },
    manufacturer: {
      display: data.manufacturer,
    },
    form: {
      text: data.itemCategory, // Using itemCategory for form
    },
    amount: {
      value: data.quantity ? Number(data.quantity) : undefined,
    },
    extension: [
      { url: "http://example.com/fhir/inventory#barCode", valueString: data.barCode },
      { url: "http://example.com/fhir/inventory#category", valueString: data.category },
      { url: "http://example.com/fhir/inventory#genericName", valueString: data.genericName },
      { url: "http://example.com/fhir/inventory#department", valueString: data.department },
      { url: "http://example.com/fhir/inventory#sexType", valueString: data.sexType },
      { url: "http://example.com/fhir/inventory#itemCategory", valueString: data.itemCategory },
      { url: "http://example.com/fhir/inventory#speciesSpecific1", valueString: data.speciesSpecific1 },
      { url: "http://example.com/fhir/inventory#speciesSpecific2", valueString: data.speciesSpecific2 },
      { url: "http://example.com/fhir/inventory#onHand", valueString: data.onHand },
      { url: "http://example.com/fhir/inventory#perQtyPrice", valueDecimal: data.perQtyPrice },
      { url: "http://example.com/fhir/inventory#batchNumber", valueString: data.batchNumber },
      { url: "http://example.com/fhir/inventory#sku", valueString: data.sku },
      { url: "http://example.com/fhir/inventory#strength", valueString: data.strength },
      { url: "http://example.com/fhir/inventory#manufacturerPrice", valueDecimal: data.manufacturerPrice },
      { url: "http://example.com/fhir/inventory#markup", valueDecimal: data.markup },
      { url: "http://example.com/fhir/inventory#upc", valueString: data.upc },
      { url: "http://example.com/fhir/inventory#price", valueDecimal: data.price },
      { url: "http://example.com/fhir/inventory#stockReorderLevel", valueDecimal: data.stockReorderLevel },
      { url: "http://example.com/fhir/inventory#expiryDate", valueDate: data.expiryDate ? new Date(data.expiryDate).toISOString().split("T")[0] : undefined },
    ].filter(ext => ext.valueString !== undefined || ext.valueDecimal !== undefined || ext.valueDate !== undefined),
  };
};


// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Convert to fhir inventory data >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

export const convertToFhirInventory = (inventoryData: InventoryTypes) => {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: inventoryData.totalItems || 0,
    entry: (inventoryData.data || []).map((item) => ({
      resource: {
        resourceType: "Medication",
        id: item._id,
        code: {
          text: item.itemName || "Unknown",
        },
        manufacturer: {
          display: item.manufacturer || "Unknown",
        },
        form: {
          text: item.dosageAdministration || "Unknown",
        },
        amount: {
          value: item.quantity ?? 0,
        },
        extension: [
          {
            url: "http://example.com/fhir/inventory#genericName",
            valueString: item.genericName || "",
          },
          {
            url: "http://example.com/fhir/inventory#sku",
            valueString: item.sku || "",
          },
          {
            url: "http://example.com/fhir/inventory#category",
            valueString: item.category || "",
          },
          {
            url: "http://example.com/fhir/inventory#itemCategory",
            valueString: item.itemCategory || "",
          },
          {
            url: "http://example.com/fhir/inventory#manufacturerPrice",
            valueDecimal: item.manufacturerPrice ?? 0,
          },
          {
            url: "http://example.com/fhir/inventory#price",
            valueDecimal: item.price ?? 0,
          },
          {
            url: "http://example.com/fhir/inventory#manufacturingDate",
            valueDate: item.manufacturingDate || "",
          },
          {
            url: "http://example.com/fhir/inventory#expiryDate",
            valueDate: item.expiryDate || "",
          },
        ],
      },
    })),
    meta: {
      totalPages: inventoryData.totalPages || 1,
      currentPage: inventoryData.currentPage || 1,
    },
  };
};

export const convertFhirBundleToInventory = (fhirBundle: any): InventoryTypes => {
  const extractExtension = (extensions: any[], name: string) => {
    return extensions?.find((ext) => ext.url.endsWith(`#${name}`));
  };

  const data = (fhirBundle.entry || []).map((entry: any) => {
    const resource = entry.resource;
    const extensions = resource.extension || [];

    return {
      bussinessId: resource.id,
      itemName: resource.code?.text || "",
      genericName: extractExtension(extensions, "genericName")?.valueString || "",
      category: extractExtension(extensions, "category")?.valueString || "",
      sku: extractExtension(extensions, "sku")?.valueString || "",
      itemCategory: extractExtension(extensions, "itemCategory")?.valueString || "",
      dosageAdministration: resource.form?.text || "",
      manufacturer: resource.manufacturer?.display || "",
      manufacturerPrice: extractExtension(extensions, "manufacturerPrice")?.valueDecimal || 0,
      price: extractExtension(extensions, "price")?.valueDecimal || 0,
      quantity: resource.amount?.value || 0,
      manufacturingDate: extractExtension(extensions, "manufacturingDate")?.valueDate || "",
      expiryDate: extractExtension(extensions, "expiryDate")?.valueDate || "",
    };
  });

  return {
    totalItems: fhirBundle.total || data.length,
    totalPages: fhirBundle.meta?.totalPages || 1,
    currentPage: fhirBundle.meta?.currentPage || 1,
    data,
  };
};




// // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< For OverView >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


export function InventoryOverviewConvertToFHIR(overview: InventoryOverviewType): InventoryOverviewFHIRBundle {
  const bundle:InventoryOverviewFHIRBundle  = {
    resourceType: "Bundle",
    type: "collection",
    entry: [],
  };

  const overviewData = [
    { key: "totalQuantity" },
    { key: "totalValue" },
    { key: "lowStockCount" },
    { key: "outOfStockCount" },
  ] as const;

  overviewData.forEach(({ key }) => {
    const value = overview[key];
    if (value === undefined || value === null) return;

    const formattedKey = key.replace(/([A-Z])/g, " $1").trim();

    const resource: InventoryOverviewFHIRObservation = {
      resourceType: "Observation",
      id: key,
      status: "final",
      code: {
        coding: [
          {
            system: "http://example.org/fhir/inventory-metrics",
            code: key,
            display: formattedKey,
          },
        ],
        text: formattedKey,
      },
      valueQuantity: {
        value,
        unit: "count",
      },
      text: {
        status: "generated",
        div: `<div>${formattedKey}: ${value}</div>`,
      },
    };

    bundle.entry.push({ resource });
  });

  return bundle;
}

export function convertFhirToJson(fhirBundle: FHIRBundle): CategoryJson[] {
  if (
    !fhirBundle ||
    fhirBundle.resourceType !== "Bundle" ||
    !Array.isArray(fhirBundle.entry)
  ) {
    throw new Error("Invalid FHIR Bundle");
  }

  return fhirBundle.entry.map((entry) => {
    const resource:any = entry.resource;

    const id = resource.id;
    const category = resource.code?.text || "";

    const businessId =
      resource.extension?.find(
        (ext:any) =>
          ext.url ===
          "http://example.org/fhir/StructureDefinition/business-id"
      )?.valueIdentifier?.value || "";

    return {
      _id: id,
      category,
      businessId,
    };
  });
}





// export const toInventoryFHIR = (item: InventoryType): any => ({
//   resourceType: "SupplyItem",
//   id: item._id,
//   identifier: [
//     {
//       system: "http://example.com/fhir/barcode",
//       value: item.barcode,
//     },
//     {
//       system: "http://example.com/fhir/batchNumber",
//       value: item.batchNumber,
//     },
//     {
//       system: "http://example.com/fhir/sku",
//       value: item.sku,
//     },
//   ],
//   manufacturer: {
//     display: item.manufacturer,
//   },
//   quantity: {
//     value: item.quantity,
//     unit: "units",
//   },
//   code: {
//     coding: [
//       {
//         system: "http://example.com/fhir/itemCategory",
//         code: item.itemCategory,
//         display: item.itemName,
//       },
//     ],
//     text: item.genericName,
//   },
//   extension: [
//     {
//       url: "http://example.com/fhir/StructureDefinition/strength",
//       valueString: item.strength,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/markup",
//       valueDecimal: item.markup,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/manufacturerPrice",
//       valueDecimal: item.manufacturerPrice,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/price",
//       valueDecimal: item.price,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/stockReorderLevel",
//       valueInteger: item.stockReorderLevel,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/category",
//       valueString: item.category,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/bussinessId",
//       valueString: item.bussinessId,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/expiryDate",
//       valueDate: item.expiryDate,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/createdAt",
//       valueDateTime: item.createdAt,
//     },
//     {
//       url: "http://example.com/fhir/StructureDefinition/updatedAt",
//       valueDateTime: item.updatedAt,
//     },
//   ],
// });