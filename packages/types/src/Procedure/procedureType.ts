// ✅ Common Types
export type FhirCoding = {
  system?: string;
  code?: string;
  display?: string;
};

export type FhirCodeableConcept = {
  coding: FhirCoding[];
};

export type FhirQuantity = {
  value: number;
  unit?: string;
};

// ✅ FHIR Incoming Types (Single Medical Package)
export type FHIRPackageItem = {
  medicationCodeableConcept: FhirCodeableConcept;
  itemType: string;
  quantity: FhirQuantity;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

export type FHIRMedicalPackage = {
  resourceType: "ProcedureRequest";
  id: string;
  category: FhirCodeableConcept;
  description?: string;
  item: FHIRPackageItem[];
  packageName: string;
  title: string;
  extension?: {
    url: string;
    valueString: string;
  }[];
  propertyGroup?: {
    priceComponent: {
      type: string;
      code?: {
        text?: string;
      };
      factor?: number;
      amount?: {
        value?: number;
        currency?: string;
      };
      extension?: {
        url: string;
        valueString?: string;
        valueDecimal?: number;
      }[];
    }[];
  }[];
};

// ✅ Normal Internal Types
export type NormalPackageItem = {
  id?: string;
   _id?: string;
  name: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

export type NormalMedicalPackage = {
  packageName: string;
  category: string;
  description?: string;
  packageItems: NormalPackageItem[];
};

// ✅ MongoDB / Stored Structure
export type PackageItem = {
  _id: string;
  name: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

export type ProcedurePackage = {
  _id: string;
  packageName: string;
  category: string;
  description: string;
  bussinessId: string;
  createdAt: string;
  updatedAt: string;
  formattedUpdatedAt: string;
  totalSubtotal: number;
  packageItems: PackageItem[];
};

// ✅ Outgoing FHIR Bundle (For Collection Response)
export type FHIRBundleEntry = {
  fullUrl: string;
  resource: FHIRMedicalPackage;
};

export type ProcedureFHIRBundle = {
  resourceType: "Bundle";
  type: "collection";
  total: number;
  meta: {
    tag: {
      system: string;
      code: string;
    }[];
  };
  entry: FHIRBundleEntry[];
};
