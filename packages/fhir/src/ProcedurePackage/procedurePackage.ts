import type { ProcedureFHIRBundle, ProcedurePackage, PackageItem, FHIRPackageItem, NormalPackageItem, NormalMedicalPackage, FHIRMedicalPackage, ProcedurePackageJSON, FHIRProcedurePackage } from "@yosemite-crew/types"


export function convertProcedurePackagesToFHIRBundle(apiResponse: {
  data: ProcedurePackage[];
  metadata?: { page?: number; limit?: number };
  totalItems: number;
  totalPages: number;
}): ProcedureFHIRBundle {
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
    entry: data.map((pkg) => ({
      fullUrl: `urn:uuid:${pkg._id}`,
      resource: createFHIRProcedurePackage(pkg),
    })),
  };
}

export function createFHIRProcedurePackage(pkg: ProcedurePackage): any {
  return {
    resourceType: "CarePlan",
    id: pkg._id,
    identifier: [{ use: "official", value: pkg._id }],
    status: "active",
    intent: "plan",
    title: pkg.packageName,
    category: [
      {
        coding: [
          {
            system: "http://example.org/fhir/package-category",
            code: pkg.category,
            display: pkg.category,
          },
        ],
      },
    ],
    description: pkg.description,
    subject: {
      identifier: {
        value: pkg.bussinessId,
      },
    },
    created: pkg.createdAt,
    meta: {
      lastUpdated: pkg.updatedAt,
    },
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/totalSubtotal",
        valueMoney: { value: pkg.totalSubtotal, currency: "INR" },
      },
      {
        url: "http://example.org/fhir/StructureDefinition/formattedUpdatedAt",
        valueString: pkg.formattedUpdatedAt,
      },
    ],
    activity: pkg.packageItems.map((item) => ({
      reference: {
        reference: `SupplyDelivery/${item._id}`,
        display: item.name,
      },
    })),
    contained: pkg.packageItems.map(createFHIRProcedurePackageItem),
  };
}

export function createFHIRProcedurePackageItem(item: PackageItem): any {
  return {
    resourceType: "SupplyDelivery",
    id: item._id,
    identifier: [{ use: "official", value: item._id }],
    suppliedItem: {
      quantity: {
        value: item.quantity,
        unit: item.itemType,
      },
      itemCodeableConcept: {
        text: item.name,
      },
    },
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/unitPrice",
        valueMoney: { value: item.unitPrice, currency: "INR" },
      },
      {
        url: "http://example.org/fhir/StructureDefinition/subtotal",
        valueMoney: { value: item.subtotal, currency: "INR" },
      },
      ...(item.notes
        ? [
          {
            url: "http://example.org/fhir/StructureDefinition/notes",
            valueString: item.notes,
          },
        ]
        : []),
    ],
  };
}



// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<   To convert in normal format procedure package >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>





export function convertFHIRItemToNormal(fhirItem: FHIRPackageItem): NormalPackageItem {
  const code = fhirItem.medicationCodeableConcept?.coding?.[0]?.code || "";

  return {
    id: code,
    name: code,
    itemType: fhirItem.itemType || "", // Default to empty string if itemType is undefined
    quantity: fhirItem.quantity?.value || 0, // Default to 0 if quantity is undefined
    unitPrice: fhirItem.unitPrice || 0, // Default to 0 if unitPrice is undefined
    subtotal: fhirItem.subtotal || 0, // Default to 0 if subtotal is undefined
    notes: fhirItem.notes || "", // Default to empty string if notes is undefined
  };
}

export function convertFHIRPackageToNormal(fhirData: FHIRMedicalPackage): NormalMedicalPackage {
  return {
    packageName: fhirData.id || "", // Default to empty string if id is undefined
    category: fhirData.category?.coding?.[0]?.code || "", // Default to empty string if category is undefined
    description: fhirData.description || "", // Default to empty string if description is undefined
    packageItems: Array.isArray(fhirData.item) ? fhirData.item.map(convertFHIRItemToNormal) : [], // Default to empty array if item is not an array
  };
}
export function convertFhirToNormalToUpdateProcedurePackage(
  fhirData: FHIRMedicalPackage
): NormalMedicalPackage {
  // Extract category from extension
  const categoryExt = fhirData.extension?.find(
    (ext) =>
      ext.url ===
      "http://example.org/fhir/StructureDefinition/procedure-category-id"
  );
  const category = categoryExt?.valueString || "";

  // Map all package items
  const packageItems: NormalPackageItem[] =
    fhirData.propertyGroup?.[0]?.priceComponent.map((component) => {
      const [name = "", itemType = ""] =
        component.code?.text?.split(" - ") ?? [];

      let _id = "";
      let subtotal = 0;
      let notes = "";

      // Handle extensions
      if (component.extension) {
        for (const ext of component.extension) {
          switch (ext.url) {
            case "http://example.org/fhir/StructureDefinition/package-item-id":
              _id = ext.valueString || "";
              break;
            case "http://example.org/fhir/StructureDefinition/package-item-subtotal":
              subtotal = typeof ext.valueDecimal === "number" ? ext.valueDecimal : 0;
              break;
            case "http://example.org/fhir/StructureDefinition/package-item-notes":
              notes = ext.valueString || "";
              break;
          }
        }
      }

      return {
        _id,
        name,
        itemType,
        quantity: component.factor || 0,
        unitPrice: component.amount?.value || 0,
        subtotal,
        notes,
      };
    }) ?? [];

  return {
    packageName: fhirData.title,
    category,
    description: fhirData.description,
    packageItems,
  };
}

export function convertProcedurePackagesToFHIR(
  packages: ProcedurePackageJSON[]
): FHIRProcedurePackage[] {
  return packages.map((pkg) => ({
    resourceType: "PlanDefinition",
    id: pkg._id?.$oid,
    identifier: [
      {
        system: "http://example.org/businessId",
        value: pkg.bussinessId,
      },
    ],
    title: pkg.packageName,
    type: {
      coding: [
        {
          system: "http://example.org/package-category",
          code: pkg.category,
          display: pkg.category,
        },
      ],
    },
    description: pkg.description,
    creatorName: pkg.creatorName,
    action: pkg.packageItems.map((item) => ({
      name: item.name || "",
      itemType: item.itemType || "",
      quantity: item.quantity || "",
      unitPrice: item.unitPrice ?? 0,
      subtotal: item.subtotal ?? 0,
      notes: item.notes || "",
    })),
    updatedAt: pkg.updatedAt,
    createdAt: pkg.createdAt,
  }));
}


export function convertProcedurePackagesFromFHIR(
  fhirPackages: FHIRProcedurePackage[]
): ProcedurePackageJSON[] {
  return fhirPackages.map((fhir) => ({
    _id: { $oid: fhir.id || "" },
    bussinessId:
      fhir.identifier?.find((id) => id.system === "http://example.org/businessId")
        ?.value || "",
    packageName: fhir.title || "",
    category: fhir.type?.coding?.[0]?.code || "",
    description: fhir.description || "",
    creatorName: fhir.creatorName || "",
    packageItems: (fhir.action || []).map((act: any) => ({
      name: act.name || "",
      itemType: act.itemType || "",
      quantity: act.quantity || "",
      unitPrice: typeof act.unitPrice === "number" ? act.unitPrice : undefined,
      subtotal: typeof act.subtotal === "number" ? act.subtotal : undefined,
      notes: act.notes || "",
    })),
    createdAt: fhir.createdAt|| "",
    updatedAt: fhir.updatedAt|| "",
    __v: 0,
  }));
}
