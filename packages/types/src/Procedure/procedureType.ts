export interface ProcedurePackageJSON {
  _id: { $oid: string };
  businessId: string;
  packageName: string;
  category: string;
  description: string;
  creatorName?: string;
  packageItems: ProcedurePackageItem[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface ProcedurePackageItem {
  id: number;
  name?: string;
  itemType?: string;
  quantity?: string;
  unitPrice?: number;
  subtotal?: number;
  notes?: string;
  discount?: number;
  tax?: number;
}
