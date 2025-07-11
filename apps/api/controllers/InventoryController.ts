import mongoose, {  Types } from "mongoose";
import { Inventory, ProcedurePackage } from "../models/Inventory";
import {
  // ProductCategoryFHIRConverter,
  // InventoryFHIRConverter,
  ApproachingExpiryReportConverter,
} from "../utils/InventoryFhirHandler";
import { Request, Response } from "express";

import { FHIRMedicalPackage, InventoryType, NormalMedicalPackage, ProcedurePackageType, } from "@yosemite-crew/types";
import { convertFHIRPackageToNormal, convertProcedurePackagesToFHIRBundle, convertToNormalToAddInventoryData,convertFhirToNormalToUpdateProcedurePackage, InventoryOverviewConvertToFHIR, toInventoryBundleFHIR, toInventoryFHIR, } from "@yosemite-crew/fhir";




interface QueryParams {
  searchItem?: string;
  skip?: string;
  limit?: string;
  expiryDate?: string;
  searchCategory?: string;
  userId?: string;
  itemId?: string;
  id?: string;
  hospitalId?: string;
  bussinessId: string;
}

interface FHIRResponse {
  resourceType: string;
  issue?: Array<{
    severity: string;
    code: string;
    details: { text: string };
    diagnostics?: string;
  }>;
}


const InventoryControllers = {
  AddInventory: async (req: Request, res: Response) => {
    try {



      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const respon: InventoryType = convertToNormalToAddInventoryData(req.body)
      console.log("expiarydate", respon);
      const getbarcode: unknown = await Inventory.findOne({ barcode: respon.barcode });
      if (getbarcode) {
        return res.status(400).json({ message: `${respon.barcode} barcode already exist` });
      }

      const getbatchNumber = await Inventory.findOne({ batchNumber: respon.batchNumber });
      if (getbatchNumber) {
        return res.status(400).json({ message: `${respon.batchNumber} batchNumber already exist` });
      }

      const getsku = await Inventory.findOne({ sku: respon.sku });
      if (getsku) {
        return res.status(400).json({ message: `${respon.sku} sku already exist` });
      }

      const formattedExpiryDate = respon.expiryDate ? new Date(respon.expiryDate).toISOString().split("T")[0] : null;
      const inventory = new Inventory({ ...respon, expiryDate: formattedExpiryDate });
      await inventory.save();
      res.status(200).json({ message: "Inventory Added Successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server Error", error: error });
    }
  },

  getInventory: async (req: { query: QueryParams }, res: Response): Promise<void> => {
    try {
      const { searchItem, skip = "0", limit = "5", expiryDate, searchCategory, userId } = req.query;

      if (!userId) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Missing required parameter: userId" },
            },
          ],
        });
        return;
      }

      const sortBy = "expiryDate";
      const order = "asc";
      const sortOrder = order === "desc" ? -1 : 1;

      const matchStage: Record<string, unknown> = {
        bussinessId: userId,
      };

      const searchConditions: Record<string, unknown>[] = [];

      if (searchItem) {
        const searchNumber = Number(searchItem);

        if (!isNaN(searchNumber)) {
          searchConditions.push(
            { stockReorderLevel: searchNumber },
            { quantity: searchNumber },
            { sku: searchNumber },
            { barcode: searchNumber }
          );
        }

        searchConditions.push(
          { itemName: { $regex: searchItem, $options: "i" } },
          { genericName: { $regex: searchItem, $options: "i" } }
        );

        matchStage.$or = searchConditions;
      }

      if (searchCategory) {
        matchStage.category = { $regex: searchCategory, $options: "i" };
      }

      if (expiryDate) {
        matchStage.expiryDate = { $gte: expiryDate };
      }

      const inventory = await Inventory.aggregate([
        { $match: matchStage },
        { $sort: { [sortBy]: sortOrder } },
        {
          $facet: {
            metadata: [{ $count: "totalItems" }],
            data: [
              { $skip: parseInt(skip, 10) || 0 },
              { $limit: parseInt(limit, 10) || 10 },
              {
                $addFields: {
                  categoryObjId: { $toObjectId: "$category" },
                  itemCategoryObjId: { $toObjectId: "$itemCategory" },
                  manufacturerObjId: { $toObjectId: "$manufacturer" },
                },
              },
              {
                $lookup: {
                  from: "inventorycategories",
                  localField: "categoryObjId",
                  foreignField: "_id",
                  as: "categoryy",
                },
              },
              {
                $unwind: { path: "$categoryy", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "inventoryitemcategories",
                  localField: "itemCategoryObjId",
                  foreignField: "_id",
                  as: "itemCategoryData",
                },
              },
              {
                $unwind: {
                  path: "$itemCategoryData",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: "inventorymanufacturers",
                  localField: "manufacturerObjId",
                  foreignField: "_id",
                  as: "manufacturerData",
                },
              },
              {
                $unwind: {
                  path: "$manufacturerData",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $addFields: {
                  category: "$categoryy.category",
                  itemCategory: "$itemCategoryData.itemCategory",
                  manufacturer: "$manufacturerData.manufacturer",
                },
              },
              {
                $project: {
                  categoryObjId: 0,
                  itemCategoryObjId: 0,
                  manufacturerObjId: 0,
                  categoryy: 0,
                  itemCategoryData: 0,
                  manufacturerData: 0,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            totalItems: {
              $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0],
            },
            totalPages: {
              $ceil: {
                $divide: [
                  { $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0] },
                  parseInt(limit, 10) || 10,
                ],
              },
            },
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fhirData = toInventoryBundleFHIR({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        totalItems: inventory[0]?.totalItems || 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        totalPages: inventory[0]?.totalPages || 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        inventory: inventory[0]?.data || [],
        currentPage: Math.floor(parseInt(skip, 10) / parseInt(limit, 10)) + 1,
      });

      res.status(200).json(fhirData);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Server error", error });
    }
  },

  AddProcedurePackage: async (
    req: { query: QueryParams; body: unknown },
    res: Response
  ): Promise<void> => {
    try {
      const { bussinessId } = req.query;

      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid hospitalId format" },
            },
          ],
        });
        return;
      }


      const fhirData = req.body as FHIRMedicalPackage;

      const data: NormalMedicalPackage = convertFHIRPackageToNormal(fhirData);
      const { packageName, category, description, packageItems } = data;


      const procedurePackage = new ProcedurePackage({
        bussinessId,
        packageName,
        category,
        description,
        packageItems,
      } as ProcedurePackageType);

      await procedurePackage.save();

      res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "informational",
            details: { text: "Procedure package added successfully" },
          },
        ],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";

      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: { text: message },
          },
        ],
      });
    }
  },


  getToViewItemsDetaild: async (req: { query: QueryParams }, res: Response) => {
    try {
      const { userId, itemId } = req.query;

      if (!userId) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Missing required parameter: userId" },
            },
          ],
        } as FHIRResponse);
      } else if (!itemId) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Missing required parameter: itemId" },
            },
          ],
        } as FHIRResponse);
      }

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid userId format" },
            },
          ],
        } as FHIRResponse);
      }

      if (!mongoose.Types.ObjectId.isValid(itemId as string)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid MongoDB itemId" },
            },
          ],
        } as FHIRResponse);
      }

      const inventory = await Inventory.aggregate([
        { $match: { _id: new Types.ObjectId(itemId), bussinessId: userId } },
        {
          $addFields: {
            categoryObjId: { $toObjectId: "$category" },
            itemCategoryObjId: { $toObjectId: "$itemCategory" },
            manufacturerObjId: { $toObjectId: "$manufacturer" },
          },
        },
        {
          $lookup: {
            from: "inventorycategories",
            localField: "categoryObjId",
            foreignField: "_id",
            as: "categoryy",
          },
        },
        { $unwind: { path: "$categoryy", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "inventoryitemcategories",
            localField: "itemCategoryObjId",
            foreignField: "_id",
            as: "itemCategoryData",
          },
        },
        {
          $unwind: { path: "$itemCategoryData", preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: "inventorymanufacturers",
            localField: "manufacturerObjId",
            foreignField: "_id",
            as: "manufacturerData",
          },
        },
        {
          $unwind: { path: "$manufacturerData", preserveNullAndEmptyArrays: true },
        },
        {
          $addFields: {
            category: "$categoryy.category",
            itemCategory: "$itemCategoryData.itemCategory",
            manufacturer: "$manufacturerData.manufacturer",
          },
        },
        {
          $project: {
            categoryObjId: 0,
            itemCategoryObjId: 0,
            manufacturerObjId: 0,
            categoryy: 0,
            itemCategoryData: 0,
            manufacturerData: 0,
          },
        },
      ]);

      if (!inventory || inventory.length === 0) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              details: { text: "Inventory item not found" },
            },
          ],
        } as FHIRResponse);
      }


      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
      const newdata = toInventoryFHIR(inventory[0]);
      res.status(200).json(newdata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: { text: "Internal server error" },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            diagnostics: error.message,
          },
        ],
      } as FHIRResponse);
    }
  },

  getProceurePackage: async (req: { query: { params: QueryParams } }, res: Response) => {
    try {
      const { userId, skip, limit } = req.query.params;

      const procedurePackage = await ProcedurePackage.aggregate([
        { $match: { bussinessId: userId } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: "totalItems" }],
            data: [
              { $skip: parseInt(skip ?? "0") || 0 },
              { $limit: parseInt(limit ?? "0") || 5 },
              {
                $addFields: {
                  categoryObj: { $toObjectId: "$category" },
                  totalSubtotal: { $sum: "$packageItems.subtotal" },
                  formattedUpdatedAt: {
                    $dateToString: {
                      format: "%d %b %Y",
                      date: "$updatedAt",
                      timezone: "UTC",
                    },
                  },
                },
              },
              {
                $lookup: {
                  from: "procedurecategories",
                  localField: "categoryObj",
                  foreignField: "_id",
                  as: "categoryInfo",
                },
              },
              {
                $addFields: {
                  category: { $arrayElemAt: ["$categoryInfo.category", 0] },
                },
              },
              {
                $project: {
                  categoryInfo: 0,
                  categoryObjId: 0,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            totalItems: { $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0] },
            totalPages: {
              $ceil: {
                $divide: [
                  { $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0] },
                  parseInt(limit ?? "0") || 5,
                ],
              },
            },
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const data = convertProcedurePackagesToFHIRBundle(procedurePackage[0]);
      res.status(200).json({ data });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      res.status(400).json({ message: error.message });
    }
  },

  GetProcedurePackageByid: async (req: { query: QueryParams }, res: Response) => {
    try {
      const { userId, id } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }
      if (!mongoose.Types.ObjectId.isValid(id as string)) {
        return res.status(400).json({ message: "Invalid MongoDB ID" });
      }

      const procedurePackage = await ProcedurePackage.findOne({
        _id: id,
        bussinessId: userId,
      })
        .lean()
        .exec();
      if (!procedurePackage) {
        res.status(404).json({ message: "Procedure Package not found" });
      }
      res.status(200).json({ procedurePackage });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      res.status(400).json({ message: error.message });
    }
  },

  updateProcedurePackage: async (req: { query: QueryParams; body: unknown }, res: Response) => {
    try {
      const { hospitalId, id } = req.query;

      if (typeof hospitalId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(hospitalId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "invalid",
              code: "error",
              details: { text: "invalid hospitalId format" },
            },
          ],
        } as FHIRResponse);
      }
      if (!mongoose.Types.ObjectId.isValid(id as string)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "invalid",
              code: "error",
              details: { text: "Invalid MongoDB ID" },
            },
          ],
        } as FHIRResponse);
      }

     const fhirData = req.body as FHIRMedicalPackage;
     console.log("fhirData",JSON.stringify(fhirData, null, 2));
     
       
      const data: NormalMedicalPackage = convertFhirToNormalToUpdateProcedurePackage(fhirData);
      const { packageName, category, description, packageItems } = data  ;

        console.log("sanitizedItems", data)
        // Update the procedure package
        const procedurePackagee = await ProcedurePackage.findOneAndUpdate(
          { _id: id, bussinessId: hospitalId },
          {
            packageName :typeof packageName === "string" ?packageName:"",
            category: typeof category === "string" ? category:"",
            description: typeof description === "string" ? description:"",
            packageItems: packageItems,
          },
          { new: true }
        ).lean().exec();

      if (!procedurePackagee) {
        return res.status(404).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: { text: "procedure pacakage not found" },
            },
          ],
        } as FHIRResponse);
      }

      res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "Information",
            code: "informational",
            details: { text: "Package Update Successfully" },
          },
        ],
      } as FHIRResponse);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "Invalid",
            code: "error",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            details: { text: `${error.message}` },
          },
        ],
      } as FHIRResponse);
    }
  },

  deleteProcedureitems: async (req: { query: QueryParams }, res: Response) => {
    try {
      const { userId, id } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }
      if (!mongoose.Types.ObjectId.isValid(id as string)) {
        return res.status(400).json({ message: "Invalid MongoDB ID" });
      }

      const procedurePackage = await ProcedurePackage.findOneAndUpdate(
        {
          "packageItems._id": id,
          bussinessId: userId,
        },
        { $pull: { packageItems: { _id: id } } },
        { new: true }
      )
        .lean()
        .exec();

      if (!procedurePackage) {
        return res.status(404).json({ message: "Procedure Package not found" });
      }
      res.status(200).json({ message: "Procedure Package deleted successfully" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      res.status(400).json({ message: error.message });
    }
  },

  deleteProcedurePackage: async (req: { query: QueryParams; params: { id: string } }, res: Response) => {
    try {
      const { userId } = req.query;
      const { id } = req.params;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "invalid",
              code: "error",
              details: { text: "invalid hospitalId format" },
            },
          ],
        } as FHIRResponse);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "invalid",
              code: "error",
              details: { text: "invalid mongoDbId format" },
            },
          ],
        } as FHIRResponse);
      }

      const procedurePackage = await ProcedurePackage.findOneAndDelete({
        _id: id,
        bussinessId: userId,
      })
        .lean()
        .exec();

      if (!procedurePackage) {
        return res.status(404).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: { text: "procedurePackage not available" },
            },
          ],
        } as FHIRResponse);
      }

      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "deleted",
            details: { text: "Procedure Package deleted successfully" },
          },
        ],
      } as FHIRResponse);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            details: { text: error.message },
          },
        ],
      } as FHIRResponse);
    }
  },

  getApproachngExpiryGraphs: async (req: { query: QueryParams }, res: Response) => {
    try {
      const { userId } = req.query;
      const today = new Date();

      if (!userId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Missing required parameter: userId" },
            },
          ],
        } as FHIRResponse);
      }

      const response = await Inventory.aggregate([
        { $match: { bussinessId: userId } },
        {
          $addFields: {
            expiryDateConverted: { $toDate: "$expiryDate" },
          },
        },
        {
          $addFields: {
            daysUntilExpiry: {
              $dateDiff: {
                startDate: today,
                endDate: "$expiryDateConverted",
                unit: "day",
              },
            },
          },
        },
        {
          $match: {
            daysUntilExpiry: { $gte: 0, $lte: 60 },
          },
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lte: ["$daysUntilExpiry", 7] }, then: "7 days" },
                  {
                    case: {
                      $and: [
                        { $gt: ["$daysUntilExpiry", 7] },
                        { $lte: ["$daysUntilExpiry", 15] },
                      ],
                    },
                    then: "15 days",
                  },
                  {
                    case: {
                      $and: [
                        { $gt: ["$daysUntilExpiry", 15] },
                        { $lte: ["$daysUntilExpiry", 30] },
                      ],
                    },
                    then: "30 days",
                  },
                  {
                    case: {
                      $and: [
                        { $gt: ["$daysUntilExpiry", 30] },
                        { $lte: ["$daysUntilExpiry", 60] },
                      ],
                    },
                    then: "60 days",
                  },
                ],
                default: null,
              },
            },
            totalCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            totalCount: 1,
          },
        },
        { $sort: { category: 1 } },
      ]);

      const fhirdata = ApproachingExpiryReportConverter.toFHIR(response, {
        userId,
      });


      res.status(200).json(fhirdata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {

      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: { text: "Internal server error" },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            diagnostics: error.message,
          },
        ],
      } as FHIRResponse);
    }
  },

  inventoryOverView: async (req: { query: QueryParams }, res: Response) => {
    try {
      const { userId } = req.query;

      const inventory = await Inventory.aggregate([
        {
          $match: { bussinessId: userId },
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalValue: { $sum: "$price" },
            lowStockCount: {
              $sum: {
                $cond: {
                  if: {
                    $and: [
                      { $lte: ["$quantity", 10] },
                      { $gt: ["$quantity", 0] },
                    ],
                  },
                  then: 1,
                  else: 0,
                },
              },
            },
            outOfStockCount: {
              $sum: {
                $cond: { if: { $eq: ["$quantity", 0] }, then: 1, else: 0 },
              },
            },
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = InventoryOverviewConvertToFHIR(inventory[0]);
      res.status(200).json(response);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      res.status(400).json({ message: error.message });
    }
  },
};

export default InventoryControllers;