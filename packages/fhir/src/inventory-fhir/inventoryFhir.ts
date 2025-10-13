import type { InventoryType } from "@yosemite-crew/types";

export const convertToNormalFromFhirInventoryData = (
  fhirData: any
): InventoryType => {
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
    if (ext.url.includes("#genericName"))
      extensionMap.genericName = ext.valueString;
    if (ext.url.includes("#sku")) extensionMap.sku = ext.valueString;
    if (ext.url.includes("#category")) extensionMap.category = ext.valueString;
    if (ext.url.includes("#itemCategory"))
      extensionMap.itemCategory = ext.valueString;
    if (ext.url.includes("#manufacturerPrice"))
      extensionMap.manufacturerPrice = ext.valueDecimal;
    if (ext.url.includes("#price")) extensionMap.price = ext.valueDecimal;
    if (ext.url.includes("#markup")) extensionMap.markup = ext.valueDecimal;
    if (ext.url.includes("#perQtyPrice"))
      extensionMap.perQtyPrice = ext.valueDecimal;
    if (ext.url.includes("#stockReorderLevel"))
      extensionMap.stockReorderLevel = ext.valueInteger;
    if (ext.url.includes("#department"))
      extensionMap.department = ext.valueString;
    if (ext.url.includes("#sexType")) extensionMap.sexType = ext.valueString;
    if (ext.url.includes("#speciesSpecific1"))
      extensionMap.speciesSpecific1 = ext.valueString;
    if (ext.url.includes("#speciesSpecific2"))
      extensionMap.speciesSpecific2 = ext.valueString;
    if (ext.url.includes("#onHand")) extensionMap.onHand = ext.valueString;
    if (ext.url.includes("#batchNumber"))
      extensionMap.batchNumber = ext.valueString;
    if (ext.url.includes("#upc")) extensionMap.upc = ext.valueString;
    if (ext.url.includes("#expiryDate"))
      extensionMap.expiryDate = ext.valueDate;
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
