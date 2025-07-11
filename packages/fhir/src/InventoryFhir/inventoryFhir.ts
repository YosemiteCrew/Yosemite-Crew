
import type {InventoryType,InputData, InventoryOverviewFHIRBundle, InventoryOverviewType, InventoryOverviewFHIRObservation} from "@yosemite-crew/types";


export function convertToNormalToAddInventoryData(bundle: InputData): InventoryType {
  const inventoryData: InventoryType = {};

  const entry = bundle.entry?.[0]?.resource;
  if (!entry || entry.resourceType !== "Basic") return inventoryData;

  // itemName from code.text
  if (entry.code?.text) {
    inventoryData.itemName = entry.code.text;
  }

  // All values are strings; store them as-is
  entry.extension?.forEach((ext) => {
    const rawKey = ext.url.split("/").pop()
    const rawValue = ext.valueString;

    if (!rawKey || rawValue === undefined) return;
    (inventoryData as any)[rawKey] = rawValue;
  });

  return inventoryData;
}


// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Convert to fhir inventory data >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


export const toInventoryFHIR = (item: InventoryType): any => ({
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
});

export const toInventoryBundleFHIR = (inventoryResponse: {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  inventory: any[];
}): any => {
  const { totalItems, totalPages, currentPage, inventory } = inventoryResponse;

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
      resource: toInventoryFHIR(item),
    })),
  };
};





// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< For OverView >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


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