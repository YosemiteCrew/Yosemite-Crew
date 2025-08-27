import mongoose from "mongoose";
import { Inventory, ProcedurePackage } from "../models/Inventory";
// import {
//   // ProductCategoryFHIRConverter,
//   // InventoryFHIRConverter,
//   ApproachingExpiryReportConverter,
// } from "../utils/InventoryFhirHandler";
import { Request, Response } from "express";

import { FHIRMedicalPackage, InventoryType, NormalMedicalPackage, ProcedurePackageJSON, ProcedurePackageType, } from "@yosemite-crew/types";
import { convertFHIRPackageToNormal, convertProcedurePackagesToFHIRBundle, convertFromFHIRInventory, convertFhirToNormalToUpdateProcedurePackage, InventoryOverviewConvertToFHIR, convertToFHIRInventory, convertFhirBundleToInventory, convertProcedurePackagesToFHIR } from "@yosemite-crew/fhir";
// import { convertFhirBundleToInventory, convertToFHIRInventory, convertToNormalFromFhirInventoryData } from "@yosemite-crew/fhir/dist/InventoryFhir/inventoryFhir";
import { inventorySchema, validateInventoryData } from "../validators/inventoryValidator";
import AddDoctors from "../models/AddDoctor";


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
  AddInventory: async (req: Request, res: Response): Promise<void> => {
    try {
      // const { businessId } =await req.body;
      const data: InventoryType = convertFromFHIRInventory(req.body);

      // Step 1: Validate input
      const validationError = validateInventoryData(data);
      if (validationError) {
        res.status(400).json({ message: validationError });
        return;
      }

      // Step 2: Check SKU uniqueness
      const existing = await Inventory.findOne({ sku: data.sku });
      if (existing) {
        res.status(400).json({ message: `SKU ${data.sku} already exists.` });
        return;
      }
      // console.log(data, "DAATA")
      // Step 3: Convert expiryDate to Date object
      const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;

      // Step 4: Save inventory
      const newInventory = new Inventory({
        ...data,
        // businessId: businessId,
        expiryDate,
      });

      await newInventory.save();
      res.status(200).json({ message: 'Inventory Added Successfully' });

    } catch (error) {
      console.error('AddInventory Error:', error);
      res.status(500).json({ message: 'Server Error', error });
    }
  },
  getInventory: async (
    req: { query: QueryParams },
    res: Response
  ): Promise<void> => {
    try {
      const {
        searchItem,
        skip = "0",
        limit = "5",
        expiryDate,
        searchCategory = "",
        userId,
      } = req.query;

      // console.log(searchCategory,"SearchCategory")
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
      const sortOrder = 1;

      const matchStage: Record<string, unknown> = { };
      const searchConditions: Record<string, unknown>[] = [];

      // 🔍 Handle search filters
      if (searchItem) {
        const searchNumber = Number(searchItem);

        if (!isNaN(searchNumber)) {
          searchConditions.push(
            { stockReorderLevel: searchNumber },
            { quantity: searchNumber },
            { sku: searchNumber }
          );
        }

        searchConditions.push(
          { itemName: { $regex: searchItem, $options: "i" } },
          { genericName: { $regex: searchItem, $options: "i" } },
          { sku: { $regex: searchItem, $options: "i" } }
        );

        matchStage.$or = searchConditions;
      }

      // 🔍 Case-insensitive category filter
      if (searchCategory) {
        try {
          matchStage.category = new mongoose.Types.ObjectId(searchCategory);
        } catch (err) {
          console.error("Invalid category ObjectId:", searchCategory);
        }
      }

      // 🔍 Expiry date filter
      if (expiryDate) {
        const parsedDate = new Date(expiryDate);
        if (!isNaN(parsedDate.getTime())) {
          matchStage.expiryDate = { $gte: parsedDate };
        }
      }

      // 🔍 Aggregation pipeline
      const inventory = await Inventory.aggregate([
        { $match: matchStage },
        { $sort: { [sortBy]: sortOrder } },
        {
          $facet: {
            metadata: [{ $count: "totalItems" }],
            data: [
              { $skip: parseInt(skip, 10) },
              { $limit: parseInt(limit, 10) },
              {
                $lookup: {
                  from: "inventorycategories",
                  localField: "category",
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
                $addFields: {
                  itemCategory: "$itemCategoryData.category",
                },
              },
              {
                $project: {
                  itemCategoryData: 0,
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
                  parseInt(limit, 10),
                ],
              },
            },
          },
        },
      ]);

      const inventoryDocs = inventory[0]?.data || [];
      // console.log(inventoryDocs, "inventoryDocs");
      // ✅ Pass JSON directly to FHIR converter
      const fhirData = convertToFHIRInventory(inventoryDocs);
      // console.log(fhirData, "fhirdata");

      // ✅ Convert FHIR back to normal inventory (if needed)
      const inventoryData = convertFhirBundleToInventory(fhirData);

      res.status(200).json({
        success: true,
        totalItems: inventory[0]?.totalItems || 0,
        totalPages: inventory[0]?.totalPages || 0,
        fhirData,
        inventoryData,
      });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Server error", error });
    }
  },


  AddProcedurePackage: async (
    req: { query: QueryParams; body: any },
    res: Response
  ): Promise<void> => {
    try {
      const { bussinessId } = req.query;

      // 1. Validate businessId (adjust regex depending on your actual format)
      if (typeof bussinessId !== "string" || bussinessId.trim() === "") {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid businessId format" },
            },
          ],
        });
        return;
      }

      // 2. Extract directly from frontend body
      const { packageName, category, description, packageItems, creatorRole } = req.body;

      // 3. Save to Mongo
      const procedurePackage = new ProcedurePackage({
        bussinessId,
        packageName,
        category,
        description,
        packageItems,
        creatorRole
      } as ProcedurePackageType);

      await procedurePackage.save();

      // 4. Send response
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



  // getToViewItemsDetaild: async (req: { query: QueryParams }, res: Response) => {
  //   try {
  //     const { userId, itemId } = req.query;

  //     if (!userId) {
  //       res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "Missing required parameter: userId" },
  //           },
  //         ],
  //       } as FHIRResponse);
  //     } else if (!itemId) {
  //       res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "Missing required parameter: itemId" },
  //           },
  //         ],
  //       } as FHIRResponse);
  //     }

  //     if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
  //       return res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "Invalid userId format" },
  //           },
  //         ],
  //       } as FHIRResponse);
  //     }

  //     if (!mongoose.Types.ObjectId.isValid(itemId as string)) {
  //       return res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "Invalid MongoDB itemId" },
  //           },
  //         ],
  //       } as FHIRResponse);
  //     }

  //     const inventory = await Inventory.aggregate([
  //       { $match: { _id: new Types.ObjectId(itemId), bussinessId: userId } },
  //       {
  //         $addFields: {
  //           categoryObjId: { $toObjectId: "$category" },
  //           itemCategoryObjId: { $toObjectId: "$itemCategory" },
  //           manufacturerObjId: { $toObjectId: "$manufacturer" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "inventorycategories",
  //           localField: "categoryObjId",
  //           foreignField: "_id",
  //           as: "categoryy",
  //         },
  //       },
  //       { $unwind: { path: "$categoryy", preserveNullAndEmptyArrays: true } },
  //       {
  //         $lookup: {
  //           from: "inventoryitemcategories",
  //           localField: "itemCategoryObjId",
  //           foreignField: "_id",
  //           as: "itemCategoryData",
  //         },
  //       },
  //       {
  //         $unwind: { path: "$itemCategoryData", preserveNullAndEmptyArrays: true },
  //       },
  //       {
  //         $lookup: {
  //           from: "inventorymanufacturers",
  //           localField: "manufacturerObjId",
  //           foreignField: "_id",
  //           as: "manufacturerData",
  //         },
  //       },
  //       {
  //         $unwind: { path: "$manufacturerData", preserveNullAndEmptyArrays: true },
  //       },
  //       {
  //         $addFields: {
  //           category: "$categoryy.category",
  //           itemCategory: "$itemCategoryData.itemCategory",
  //           manufacturer: "$manufacturerData.manufacturer",
  //         },
  //       },
  //       {
  //         $project: {
  //           categoryObjId: 0,
  //           itemCategoryObjId: 0,
  //           manufacturerObjId: 0,
  //           categoryy: 0,
  //           itemCategoryData: 0,
  //           manufacturerData: 0,
  //         },
  //       },
  //     ]);

  //     if (!inventory || inventory.length === 0) {
  //       return res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "not-found",
  //             details: { text: "Inventory item not found" },
  //           },
  //         ],
  //       } as FHIRResponse);
  //     }


  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  //     const newdata = toInventoryFHIR(inventory[0]);
  //     res.status(200).json(newdata);
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } catch (error: any) {
  //     res.status(500).json({
  //       resourceType: "OperationOutcome",
  //       issue: [
  //         {
  //           severity: "error",
  //           code: "exception",
  //           details: { text: "Internal server error" },
  //           // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  //           diagnostics: error.message,
  //         },
  //       ],
  //     } as FHIRResponse);
  //   }
  // },

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
  getAllProcedurePackage: async (req: Request, res: Response): Promise<void> => {
    try {
      const getItems = await ProcedurePackage.find();

      if (!getItems || getItems.length === 0) {
        res.status(404).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "not-found",
              details: { text: `No packages found for category` },
            },
          ],
        });
        return;
      }

      // Enrich items with creatorName
      const enrichedItems = await Promise.all(
        getItems.map(async (pkg: any) => {
          let creatorName = "";

          if (pkg.creatorRole === "vet") {
            // Find doctor by businessId
            const doctor = await AddDoctors.findOne({ businessId: pkg.bussinessId }).select("name");
            creatorName = doctor ? doctor.firstName : "Unknown Vet";
          } else if (pkg.creatorRole === "veterinaryBusiness") {
            creatorName = "Veterinary Business";
          }

          return {
            ...pkg.toObject(),
            creatorName,
          };
        })
      );
      // convert to FHIR format
      const data = convertProcedurePackagesToFHIR(enrichedItems);

      res.status(200).json({ data });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "An internal server error occurred.",
            },
          }
        ],
      });
      return;
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
      // console.log("fhirData", JSON.stringify(fhirData, null, 2));


      const data: NormalMedicalPackage = convertFhirToNormalToUpdateProcedurePackage(fhirData);
      const { packageName, category, description, packageItems } = data;

      // console.log("sanitizedItems", data)
      // Update the procedure package
      const procedurePackagee = await ProcedurePackage.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id), bussinessId: hospitalId },
        {
          packageName: typeof packageName === "string" ? packageName : "",
          category: typeof category === "string" ? category : "",
          description: typeof description === "string" ? description : "",
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

  // getApproachngExpiryGraphs: async (req: { query: QueryParams }, res: Response) => {
  //   try {
  //     const { userId } = req.query;
  //     const today = new Date();

  //     if (!userId) {
  //       return res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "Missing required parameter: userId" },
  //           },
  //         ],
  //       } as FHIRResponse);
  //     }

  //     const response = await Inventory.aggregate([
  //       { $match: { bussinessId: userId } },
  //       {
  //         $addFields: {
  //           expiryDateConverted: { $toDate: "$expiryDate" },
  //         },
  //       },
  //       {
  //         $addFields: {
  //           daysUntilExpiry: {
  //             $dateDiff: {
  //               startDate: today,
  //               endDate: "$expiryDateConverted",
  //               unit: "day",
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $match: {
  //           daysUntilExpiry: { $gte: 0, $lte: 60 },
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: {
  //             $switch: {
  //               branches: [
  //                 { case: { $lte: ["$daysUntilExpiry", 7] }, then: "7 days" },
  //                 {
  //                   case: {
  //                     $and: [
  //                       { $gt: ["$daysUntilExpiry", 7] },
  //                       { $lte: ["$daysUntilExpiry", 15] },
  //                     ],
  //                   },
  //                   then: "15 days",
  //                 },
  //                 {
  //                   case: {
  //                     $and: [
  //                       { $gt: ["$daysUntilExpiry", 15] },
  //                       { $lte: ["$daysUntilExpiry", 30] },
  //                     ],
  //                   },
  //                   then: "30 days",
  //                 },
  //                 {
  //                   case: {
  //                     $and: [
  //                       { $gt: ["$daysUntilExpiry", 30] },
  //                       { $lte: ["$daysUntilExpiry", 60] },
  //                     ],
  //                   },
  //                   then: "60 days",
  //                 },
  //               ],
  //               default: null,
  //             },
  //           },
  //           totalCount: { $sum: 1 },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           category: "$_id",
  //           totalCount: 1,
  //         },
  //       },
  //       { $sort: { category: 1 } },
  //     ]);

  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  //     // const fhirdata = ApproachingExpiryReportConverter.toFHIR(response, {
  //     //   userId,
  //     // });


  //     // res.status(200).json(fhirdata);
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } catch (error: any) {

  //     res.status(500).json({
  //       resourceType: "OperationOutcome",
  //       issue: [
  //         {
  //           severity: "error",
  //           code: "exception",
  //           details: { text: "Internal server error" },
  //           // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  //           diagnostics: error.message,
  //         },
  //       ],
  //     } as FHIRResponse);
  //   }
  // },

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