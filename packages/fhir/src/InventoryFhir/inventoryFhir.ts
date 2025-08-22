
import type { InventoryType, InventoryOverviewFHIRBundle, InventoryOverviewType, InventoryOverviewFHIRObservation, FHIRBundle, CategoryJson, InventoryTypes } from "@yosemite-crew/types";



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

export const convertToFHIRInventory = (
  data: (InventoryType & { businessId?: string })[]
) => {
  return data.map((item) => ({
    resourceType: "Medication",
    id: item.businessId,
    code: { text: item.itemName },
    manufacturer: { display: item.manufacturer },
    form: { text: item.strength },
    amount: { value: item.quantity },
    extension: [
      { url: "http://example.com/fhir/inventory#barCode", valueString: item.barCode },
      { url: "http://example.com/fhir/inventory#genericName", valueString: item.genericName },
      { url: "http://example.com/fhir/inventory#sku", valueString: item.sku },
      { url: "http://example.com/fhir/inventory#category", valueString: item.category },
      { url: "http://example.com/fhir/inventory#itemCategory", valueString: item.itemCategory },
      { url: "http://example.com/fhir/inventory#manufacturerPrice", valueDecimal: Number(item.manufacturerPrice) },
      { url: "http://example.com/fhir/inventory#price", valueDecimal: Number(item.price) },
      { url: "http://example.com/fhir/inventory#markup", valueDecimal: Number(item.markup) },
      { url: "http://example.com/fhir/inventory#perQtyPrice", valueDecimal: Number(item.perQtyPrice) },
      { url: "http://example.com/fhir/inventory#stockReorderLevel", valueInteger: Number(item.stockReorderLevel) },
      { url: "http://example.com/fhir/inventory#department", valueString: item.department },
      { url: "http://example.com/fhir/inventory#sexType", valueString: item.sexType },
      { url: "http://example.com/fhir/inventory#speciesSpecific1", valueString: item.speciesSpecific1 },
      { url: "http://example.com/fhir/inventory#speciesSpecific2", valueString: item.speciesSpecific2 },
      { url: "http://example.com/fhir/inventory#onHand", valueString: item.onHand },
      { url: "http://example.com/fhir/inventory#batchNumber", valueString: item.batchNumber },
      { url: "http://example.com/fhir/inventory#upc", valueString: item.upc },
      { url: "http://example.com/fhir/inventory#expiryDate", valueDate: item.expiryDate },
    ],
  }));
};



export function convertFhirBundleToInventory(fhirData: any) {
  if (!fhirData || !Array.isArray(fhirData.fhirData)) {
    return { data: [] }; // safeguard
  }

  const convertedData = fhirData.fhirData.map((item: any) =>
    convertFHIRInventoryToNormal(item)
  );

  return { data: convertedData };
}
// Single FHIR → Normal Inventory converter
export function convertFHIRInventoryToNormal(fhirData: any): InventoryType {
  const extensionMap: Record<string, any> = {};
  (fhirData.extension || []).forEach((ext: any) => {
    if (ext.url.includes("#barCode")) extensionMap.barCode = ext.valueString;
    if (ext.url.includes("#genericName")) extensionMap.genericName = ext.valueString;
    if (ext.url.includes("#sku")) extensionMap.sku = ext.valueString;
    if (ext.url.includes("#category")) extensionMap.category = ext.valueString;
    if (ext.url.includes("#itemCategory")) extensionMap.itemCategory = ext.valueString;
    if (ext.url.includes("#manufacturerPrice")) extensionMap.manufacturerPrice = ext.valueDecimal;
    if (ext.url.includes("#price")) extensionMap.price = ext.valueDecimal;
    if (ext.url.includes("#markup")) extensionMap.markup = ext.valueDecimal;
    if (ext.url.includes("#perQtyPrice")) extensionMap.perQtyPrice = ext.valueDecimal;
    if (ext.url.includes("#stockReorderLevel")) extensionMap.stockReorderLevel = ext.valueInteger;
    if (ext.url.includes("#department")) extensionMap.department = ext.valueString;
    if (ext.url.includes("#sexType")) extensionMap.sexType = ext.valueString;
    if (ext.url.includes("#speciesSpecific1")) extensionMap.speciesSpecific1 = ext.valueString;
    if (ext.url.includes("#speciesSpecific2")) extensionMap.speciesSpecific2 = ext.valueString;
    if (ext.url.includes("#onHand")) extensionMap.onHand = ext.valueString;
    if (ext.url.includes("#batchNumber")) extensionMap.batchNumber = ext.valueString;
    if (ext.url.includes("#upc")) extensionMap.upc = ext.valueString;
    if (ext.url.includes("#expiryDate")) extensionMap.expiryDate = ext.valueDate;
  });

  return {
    barCode: extensionMap.barCode || "",
    genericName: extensionMap.genericName || "",
    sku: extensionMap.sku || "",
    category: extensionMap.category || "",
    itemCategory: extensionMap.itemCategory || "",
    manufacturerPrice: extensionMap.manufacturerPrice || 0,
    price: extensionMap.price || 0,
    markup: extensionMap.markup || 0,
    perQtyPrice: extensionMap.perQtyPrice || 0,
    stockReorderLevel: extensionMap.stockReorderLevel || 0,
    department: extensionMap.department || "",
    sexType: extensionMap.sexType || "",
    speciesSpecific1: extensionMap.speciesSpecific1 || "",
    speciesSpecific2: extensionMap.speciesSpecific2 || "",
    onHand: extensionMap.onHand || "",
    batchNumber: extensionMap.batchNumber || "",
    upc: extensionMap.upc || "",
    expiryDate: extensionMap.expiryDate || "",

    // from main FHIR fields
    itemName: fhirData.code?.text || "",
    strength: fhirData.form?.text || "",
    manufacturer: fhirData.manufacturer?.display || "",
    quantity: fhirData.amount?.value || 0,
  };
}



export const convertFromFHIRInventory = (fhir: any): InventoryType => {
  const getExt = (key: string): string => {
    const ext = fhir.extension?.find((e: any) => e.url.endsWith(key));
    return (
      ext?.valueString ||
      ext?.valueDecimal?.toString() ||
      ext?.valueInteger?.toString() ||
      ext?.valueDate ||
      ""
    );
  };

  return {

    businessId: fhir.id,
    barCode: getExt("barCode"),
    category: getExt("category"),
    itemName: fhir.code?.text || "",
    genericName: getExt("genericName"),
    department: getExt("department"),
    sexType: getExt("sexType"),
    manufacturer: fhir.manufacturer?.display || "",
    itemCategory: getExt("itemCategory"),
    speciesSpecific1: getExt("speciesSpecific1"),
    speciesSpecific2: getExt("speciesSpecific2"),
    onHand: getExt("onHand"),
    perQtyPrice: Number(getExt("perQtyPrice")),
    batchNumber: getExt("batchNumber"),
    sku: getExt("sku"),
    strength: fhir.form?.text || "",
    quantity: Number(fhir.amount?.value || 0),
    manufacturerPrice: Number(getExt("manufacturerPrice")),
    markup: Number(getExt("markup")),
    upc: getExt("upc"),
    price: Number(getExt("price")),
    stockReorderLevel: Number(getExt("stockReorderLevel")),
    expiryDate: getExt("expiryDate"),
  };
};




// // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< For OverView >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


export function InventoryOverviewConvertToFHIR(overview: InventoryOverviewType): InventoryOverviewFHIRBundle {
  const bundle: InventoryOverviewFHIRBundle = {
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
    const resource: any = entry.resource;

    const id = resource.id;
    const category = resource.code?.text || "";

    const businessId =
      resource.extension?.find(
        (ext: any) =>
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


export function convertJsonToFhir(jsonArray: CategoryJson[]): FHIRBundle {
  if (!Array.isArray(jsonArray)) {
    throw new Error("Input must be an array of CategoryJson");
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: jsonArray.map((item) => ({
      resource: {
        resourceType: "Immunization",
        id: item._id,
        status: "completed",
        patient: {
          reference: "Patient/example", // placeholder
          petImageUrl: "",              // placeholder
        },
        vaccineCode: {
          coding: [
            {
              system: "http://example.org/fhir/category",
              code: item.category,
              display: item.category,
            },
          ],
          text: item.category,
        },
        // 👇 Added this so your convertFhirToJson can still read category
        code: {
          text: item.category,
        },
        occurrenceDateTime: new Date().toISOString(),
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/business-id",
            valueIdentifier: {
              value: item.businessId,
            },
          },
        ],
      } as any, // extend with code for compatibility
    })),
  };
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