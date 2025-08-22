import {  Types } from "mongoose";

export type InventoryType = {
  businessId?: string;
   barCode: string;
  category: string | Types.ObjectId;
  itemName: string;
  genericName?: string;
  department: string;
  sexType?: string;
  manufacturer: string;
  itemCategory: string;
  speciesSpecific1?: string;
  speciesSpecific2?: string;
  onHand: string;
  perQtyPrice: number;
  batchNumber?: string;
  sku?: string;
  strength?: string;
  quantity: number;
  manufacturerPrice: number;
  markup: number;
  upc?: string;
  price: number;
  stockReorderLevel: number;
  expiryDate: string;    // ISO 8601 format
};



export type ProcedureItemType = {
    _id?: string;
  name?: string;
  itemType?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  notes?: string;
};

export type ProcedurePackageType = {
  businessId?: string;
  packageName?: string;
  category?: string;
  description?: string;
  packageItems?: ProcedureItemType[];
};

export type InputData = {
  entry: {
    resource: {
      resourceType: "Basic"; // since you are checking for it
      code?: {
        text?: string;
      };
      extension?: {
        url: string;
        valueString: string | number;
      }[];
    };
  }[];
};


export type searchConditions = {
  itemName: string;
  genericName: string;
  sku: number;
  barcode:number
}



export type AggregatedInventoryItem = {
  _id: string;
  barcode: string;
  batchNumber: string;
  sku: string;
  itemName: string;
  genericName: string;
  itemCategory: string;
  manufacturer: string;
  quantity: number;
  strength: string;
  markup: number;
  manufacturerPrice: number;
  price: number;
  stockReorderLevel: number;
  category: string;
  bussinessId: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
};

export type AggregationResult = {
  totalItems: number;
  totalPages: number;
  inventory: AggregatedInventoryItem[];
}[];
export type SupplyItem = {
  _id: string;
  bussinessId: string;
  category: string;
  barcode: string;
  itemName: string;
  genericName: string;
  manufacturer: string;
  itemCategory: string;
  batchNumber: string;
  sku: string;
  strength: string;
  quantity: number;
  manufacturerPrice: number;
  markup: number;
  price: number;
  stockReorderLevel: number;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
};


// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< for OverView >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>




export type InventoryOverviewType = {
  totalQuantity?: number;
  totalValue?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
};

export type InventoryOverviewFHIRObservation = {
  resourceType: "Observation";
  id: string;
  status: "final";
  code: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  valueQuantity: {
    value: number;
    unit: string;
  };
  text: {
    status: "generated";
    div: string;
  };
};

type InventoryOverviewFHIRBundleEntry = {
  resource: InventoryOverviewFHIRObservation;
};

export type InventoryOverviewFHIRBundle = {
  resourceType: "Bundle";
  type: "collection";
  entry: InventoryOverviewFHIRBundleEntry[];
};
interface FhirExtension {
  url: string;
  valueIdentifier: {
    system: string;
    value: string;
  };
}
type FhirBasicResource= {
  resourceType: "Basic";
  id: string;
  code: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  extension: FhirExtension[];
}

type FhirEntry = {
  resource: FhirBasicResource;
}
export type  FhirBundle = {
  resourceType: "Bundle";
  type: string;
  entry: FhirEntry[];
}
export type CategoryJson = {
  _id: string;
  category: string;
  businessId: string;
}

export type InventoryItem = {
  _id: string;
  itemName?: string;
  manufacturer?: string;
  dosageAdministration?: string;
  quantity?: number;
  genericName?: string;
  sku?: string;
  category?: string;
  itemCategory?: string;
  manufacturerPrice?: number;
  price?: number;
  manufacturingDate?: string;
  expiryDate?: string;
};

export type InventoryTypes = {
  totalItems?: number;
  totalPages?: number;
  currentPage?: number;
  data?: InventoryItem[];
};
