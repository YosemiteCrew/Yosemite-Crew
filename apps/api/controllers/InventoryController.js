const { default: mongoose } = require("mongoose");
const { Inventory, ProcedurePackage } = require("../models/Inventory");
const FHIRConverter = require("../utils/DoctorsHandler");
const { validateFHIR } = require("../Fhirvalidator/FhirValidator");
const {
  ProductCategoryFHIRConverter,
  InventoryBundleFHIRConverter,
  InventoryFHIRConverter,
  ApproachingExpiryReportConverter,
  convertProcedurePackagesToFHIRBundle,
  NormalProcedurePackage,
  NormalProcedurePackageToUpdate,
  ProcedurePackageFHIR,
  MedicalPackage,
} = require("../utils/InventoryFhirHandler");
const {
  InventoryCategory,
  InventoryItemCategory,
  InventoryManufacturer,
} = require("../models/AddInventoryCotegory");
const { Fhir } = require("fhir");
const { text } = require("body-parser");
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Add Inventory >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const { ObjectId } = require("mongoose").Types;
const InventoryControllers = {
  AddInventory: async (req, res) => {
    try {
      const { expiryDate } = req.body;

      const respon = new ProductCategoryFHIRConverter(
        req.body
      ).convertToNormalToAddInventoryData();
     
      const getbarcode = await Inventory.findOne({ barcode: respon.barcode });
      if (getbarcode) {
        return res
          .status(400)
          .send({ message: `${respon.barcode} barcode already exist` });
      }

      const getbatchNumber = await Inventory.findOne({
        batchNumber: respon.batchNumber,
      });
      if (getbatchNumber) {
        return res
          .status(400)
          .json({ message: `${respon.batchNumber} batchNumber already exist` });
      }
      const getsku = await Inventory.findOne({ sku: respon.sku });
      if (getsku) {
        return res
          .status(400)
          .json({ message: `${respon.sku} sku already exist` });
      }

      const formattedExpiryDate = expiryDate
        ? new Date(expiryDate).toISOString().split("T")[0]
        : null;
      const inventory = new Inventory(respon);
      await inventory.save();
      res.status(200).json({ message: "Inventory Added Successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server Error" });
    }
  },
  getInventory: async (req, res) => {
    try {
      const {
        searchItem,
        skip = 0,
        limit = 5,
        expiryDate,
        searchCategory,
        userId, // Add userId from query params
      } = req.query;

      if (!userId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Missing required parameter: userId",
              },
            },
          ],
        });
      }

      const sortBy = "expiryDate";
      const order = "asc";
      // console.log("Received Query Params:", req.query);

      let matchStage = {};
      let searchConditions = [];

      // Add userId to matchStage (mapped to bussinessID in the database)
      if (userId) {
        matchStage.bussinessId = userId; // Ensure this matches your database field name
      }

      if (searchItem) {
        const searchNumber = Number(searchItem);
        // console.log("searchNumber:", searchNumber);

        if (!isNaN(searchNumber)) {
          searchConditions.push(
            { stockReorderLevel: searchNumber },
            { quantity: searchNumber }
          );
        }

        searchConditions.push(
          { itemName: { $regex: searchItem, $options: "i" } },
          { genericName: { $regex: searchItem, $options: "i" } },
          { sku: { $regex: searchItem, $options: "i" } },
          { barcode: { $regex: searchItem, $options: "i" } }
        );

        matchStage.$or = searchConditions;
      }

      if (searchCategory) {
        matchStage.category = { $regex: searchCategory, $options: "i" };
      }

      if (expiryDate) {
        matchStage.expiryDate = { $gte: expiryDate };
      }

      const sortOrder = order === "desc" ? -1 : 1;

      const inventory = await Inventory.aggregate([
        { $match: matchStage },
        { $sort: { [sortBy]: sortOrder } },
        {
          $facet: {
            metadata: [{ $count: "totalItems" }],
            data: [
              { $skip: parseInt(skip) || 0 },
              { $limit: parseInt(limit) || 10 },
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
                $unwind: {
                  path: "$categoryy",
                  preserveNullAndEmptyArrays: true,
                },
              },

              {
                $lookup: {
                  from: "inventoryitemcategories", // assuming same for itemCategory
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
                  from: "inventorymanufacturers", // make sure this is the correct collection
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
                  {
                    $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0],
                  },
                  parseInt(limit) || 10,
                ],
              },
            },
          },
        },
      ]);

      const fhirdata = InventoryBundleFHIRConverter.toFHIR({
        totalItems: inventory[0]?.totalItems || 0,
        totalPages: inventory[0]?.totalPages || 0,
        inventory: inventory[0]?.data || [],
        currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      });

      // console.log("inventorymaindata", validateFHIR(fhirdata));
      res.status(200).json(fhirdata);

      // console.log("inventoryy", JSON.stringify(fhirdata, null, 2));
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Server error", error });
    }
  },

  AddProcedurePackage: async (req, res) => {
    try {
      const { bussinessId } = req.query;

      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Invalid hospitalId format",
              },
            },
          ],
        });
      }
      const data = new MedicalPackage(req.body).toNormalFormat();
  //  console.log("iiiii",req.body);
  //     console.log("hhihhhiihhiihihih",validateFHIR(req.body));
    
      const { packageName, category, description, packageItems } = data;
      // console.log("444444444444444444444444",packageName, category, description, packageItems)
      const procedurePackage = new ProcedurePackage({
        bussinessId: bussinessId,
        packageName,
        category,
        description,
        packageItems,
      });
      await procedurePackage.save();
      res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "informational",
            details: {
              text: "Procedure package added successfully",
            },
          },
        ],
      });
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            details: {
              text: `${error.message}`,
            },
          },
        ],
      });
    }
  },

  getToViewItemsDetaild: async (req, res) => {
    try {
      const { userId, itemId } = req.query;
      if (!userId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Missing required parameter: userId",
              },
            },
          ],
        });
      } else if (!itemId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Missing required parameter: itemId",
              },
            },
          ],
        });
      }

      // Check userId format (UUID v4)
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
        });
      }

      // Check itemId (MongoDB ObjectId)
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid MongoDB itemId" },
            },
          ],
        });
      }

      const inventory = await Inventory.aggregate([
        { $match: { _id: new ObjectId(itemId), bussinessId: userId } },
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
      ]);

      if (!inventory || inventory.length === 0) {
        return res.status(404).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              details: {
                text: "Inventory item not found",
              },
            },
          ],
        });
      }

      const newdata = InventoryFHIRConverter.toFHIR(inventory[0]);

      return res.status(200).json(newdata);
    } catch (error) {
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "Internal server error",
            },
            diagnostics: error.message,
          },
        ],
      });
    }
  },
  getProceurePackage: async (req, res) => {
    try {
      const { userId, skip, limit } = req.query.params;

      const procedurePackage = await ProcedurePackage.aggregate([
        { $match: { bussinessId: userId } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: "totalItems" }],
            data: [
              { $skip: parseInt(skip) || 0 },
              { $limit: parseInt(limit) || 5 },
              {
                $addFields: {
                  categoryObjId: { $toObjectId: "$category" },
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
                  localField: "categoryObjId",
                  foreignField: "_id",
                  as: "categoryInfo",
                },
              },
              {
                $addFields: {
                  category: {
                    $arrayElemAt: ["$categoryInfo.category", 0],
                  },
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
            totalItems: {
              $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0],
            },
            totalPages: {
              $ceil: {
                $divide: [
                  {
                    $ifNull: [{ $arrayElemAt: ["$metadata.totalItems", 0] }, 0],
                  },
                  parseInt(limit) || 5,
                ],
              },
            },
          },
        },
      ]);
      const data = convertProcedurePackagesToFHIRBundle(procedurePackage[0]);
  
      res.status(200).json({ data });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  GetProcedurePackageByid: async (req, res) => {
    try {
      const { userId, id } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
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
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  updateProcedurePackage: async (req, res) => {
    try {
      const { hospitalId, id } = req.query;

      if (typeof hospitalId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(hospitalId)) {
        return res.status(400).json({ 
          resourceType: "OperationOutcome",
          issue:[
            {
              severity: "invalid",
              code: "error",
              details: {
                text:"invalid hospitalId format"
              }
            }
          ]
        });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          resourceType: "OperationOutcome",
          issue:[
            {
              severity: "invalid",
              code: "error",
              details: {
                text:'Invalid MongoDB ID'
              }
            }
          ]
         });
      }
     

      const response = new ProcedurePackageFHIR(req.body);
      const { packageName, category, description, packageItems } =
        response.fhirData.data;

      const procedurePackage = await ProcedurePackage.findOneAndUpdate(
        { _id: id, bussinessId: hospitalId },
        {
          packageName,
          category,
          description,
          packageItems: packageItems.map((item) => ({
            _id: item._id,
            name: item.name,
            itemType: item.itemType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            notes: item.notes,
          })),
        },
        { new: true }
      )
        .lean()
        .exec();

      if (!procedurePackage) {
        return res.status(404).json({ 
          resourceType: "OperationOutcome",
          issue:[
            {
              severity: "information",
              code: "informational",
              details: {
                text: "procedure pacakage not found",
              }
            }
          ]
         });
      }

      res.status(200).json({ 
        resourceType: "OperationOutcome",
      issue:[
        {
          severity: "Information",
          code: "informational",
          details: {
            text: "Package Update Successfully",
          }
        }
      ]
      });
    } catch (error) {
      res.status(500).json({ 
        resourceType:"OperationOutcome",
        issue:[
          {
            severity: "Invalid",
            code:"error",
            details: {
              text:`${error.message}`
            }
          }
        ]
       });
    }
  },
  // Delete Procedure Package
  deleteProcedureitems: async (req, res) => {
    try {
      const { userId, id } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid MongoDB ID" });
      }

      const procedurePackage = await ProcedurePackage.findOneAndUpdate(
        {
          "packageItems._id": id,
          bussinessId: userId,
        },
        { $pull: { packageItems: { _id: id } } },
        { new: true }
      ).lean();
      if (!procedurePackage) {
        return res.status(404).json({ message: "Procedure Package not found" });
      }
      res
        .status(200)
        .json({ message: "Procedure Package deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  deleteProcedurePackage: async (req, res) => {
    try {
      const { userId } = req.query;
      const { id } = req.params;

      console.log("");
  
      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ 
          resourceType: "OperationOutecome",
          issue:[
            {
              severity: "invalid",
              code: "error",
              details: {
                text: "invalid hospitalId format",
              }
            }
          ]
        });
      }
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          resourceType:"OperationOutcome",
          issue:[
            {
              severity: "invalid",
              code:"error",
              details: {
                text: "invalid mongoDbId format",
              }
            }
          ]
        });
      }
  
      const procedurePackage = await ProcedurePackage.findOneAndDelete({
        _id: id,
        bussinessId: userId,
      }).lean();
  
      if (!procedurePackage) {
        return res.status(404).json({ 
          resourceType:'OperationOutcome',
          issue:[
            {
              severity:"information",
              code:"informational",
              details: {
                text:"procedurePackage not available"
              }
            }
          ],
         });
      }
  
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          severity: "information",
          code: "deleted",
          details:{
            text:"Procedure Package deleted successfully",
          }
        }]
      });
    } catch (error) {
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code: "exception",
          details: {text:error.message}
        }]
      });
    }
  },  
  getApproachngExpiryGraphs: async (req, res) => {
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
              details: {
                text: "Missing required parameter: userId",
              },
            },
          ],
        });
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
        userId: userId,
      });

      res.status(200).json(fhirdata);
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "Internal server error",
            },
            diagnostics: error.message,
          },
        ],
      });
    }
  },

  inventoryOverView: async (req, res) => {
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

      const response = new FHIRConverter(
        inventory[0]
      ).InventoryOverviewConvertToFHIR();
     
      res.status(200).json(response);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};

module.exports = InventoryControllers;
