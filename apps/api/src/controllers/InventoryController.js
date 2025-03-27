const { Inventory, ProcedurePackage } = require('../models/Inventory');

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Add Inventory >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const InventoryControllers = {
  AddInventory: async (req, res) => {
    try {
      const { userId } = req.query;
      const {
        category,
        barcode,
        itemName,
        genericName,
        manufacturer,
        itemCategory,
        batchNumber,
        sku,
        strength,
        quantity,
        manufacturerPrice,
        markup,
        price,
        stockReorderLevel,
        expiryDate,
      } = req.body;

      const formattedExpiryDate = expiryDate
        ? new Date(expiryDate).toISOString().split('T')[0]
        : null;
      const inventory = new Inventory({
        bussinessId: userId,
        category,
        barcode,
        itemName,
        genericName,
        manufacturer,
        itemCategory,
        batchNumber,
        sku,
        strength,
        quantity,
        manufacturerPrice,
        markup,
        price,
        stockReorderLevel,
        expiryDate: formattedExpiryDate,
      });
      await inventory.save();
      res.status(200).json({ message: 'Inventory Added Successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  getInventory: async (req, res) => {
    try {
      const {
        searchItem,
        skip = 0,
        limit = 5,
        expiryDate,
        category,
        userId, // Add userId from query params
      } = req.query;
  
      const sortBy = 'expiryDate';
      const order = 'asc';
      console.log('Received Query Params:', req.query);
  
      let matchStage = {};
      let searchConditions = [];
  
      // Add userId to matchStage (mapped to bussinessID in the database)
      if (userId) {
        matchStage.bussinessId = userId; // Ensure this matches your database field name
      }
  
      if (searchItem) {
        const searchNumber = Number(searchItem);
        console.log('searchNumber:', searchNumber);
  
        if (!isNaN(searchNumber)) {
          searchConditions.push(
            { stockReorderLevel: searchNumber },
            { quantity: searchNumber }
          );
        }
  
        searchConditions.push(
          { itemName: { $regex: searchItem, $options: 'i' } },
          { genericName: { $regex: searchItem, $options: 'i' } },
          { sku: { $regex: searchItem, $options: 'i' } },
          { barcode: { $regex: searchItem, $options: 'i' } }
        );
  
        matchStage.$or = searchConditions;
      }
  
      if (category) {
        matchStage.category = { $regex: category, $options: 'i' };
      }
  
      if (expiryDate) {
        matchStage.expiryDate = { $lte: expiryDate };
      }
  
      const sortOrder = order === 'desc' ? -1 : 1;
  
      const inventory = await Inventory.aggregate([
        { $match: matchStage },
        { $sort: { [sortBy]: sortOrder } },
        {
          $facet: {
            metadata: [{ $count: 'totalItems' }],
            data: [
              { $skip: parseInt(skip) || 0 },
              { $limit: parseInt(limit) || 10 },
            ],
          },
        },
        {
          $addFields: {
            totalItems: {
              $ifNull: [{ $arrayElemAt: ['$metadata.totalItems', 0] }, 0],
            },
            totalPages: {
              $ceil: {
                $divide: [
                  {
                    $ifNull: [{ $arrayElemAt: ['$metadata.totalItems', 0] }, 0],
                  },
                  parseInt(limit) || 10,
                ],
              },
            },
          },
        },
      ]);
  
      res.status(200).json({
        totalItems: inventory[0]?.totalItems || 0,
        totalPages: inventory[0]?.totalPages || 0,
        inventory: inventory[0]?.data || [],
        currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      });
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ message: 'Server error', error });
    }
  },

  AddProcedurePackage: async (req, res) => {
    try {
      const { userId } = req.query;
      const { packageName, category, description, packageItems } = req.body;
      console.log('Received Procedure Package:', req.body);

      const procedurePackage = new ProcedurePackage({
        bussinessId: userId,
        packageName,
        category,
        description,
        packageItems,
      });
      await procedurePackage.save();
      res.status(200).json({ message: 'Procedure Package Added Successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  getToViewItemsDetaild: async (req, res) => {
    try {
      const { userId } = req.query;
      const { itemId } = req.query;
      const inventory = await Inventory.findOne({
        _id: itemId,
        bussinessId: userId,
      })
        .lean()
        .exec();
      if (!inventory) {
        res.status(404).json({ message: 'Item not found' });
      }
      res.status(200).json({ inventory });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  getProceurePackage: async (req, res) => {
    try {
      const { userId, skip, limit } = req.query;
      console.log("getProceurePackage", userId, skip, limit);

      const procedurePackage = await ProcedurePackage.aggregate([
        { $match: { bussinessId: userId } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'totalItems' }],
            data: [
              { $skip: parseInt(skip) || 0 },
              { $limit: parseInt(limit) || 5 },
              {
                $addFields: {
                  totalSubtotal: {
                    $sum: '$packageItems.subtotal',
                  },
                  formattedUpdatedAt: {
                    $dateToString: {
                      format: '%d %b %Y',
                      date: '$updatedAt',
                      timezone: 'UTC',
                    },
                  },
                },
              },
            ],
          },
        },
        {
          $addFields: {
            totalItems: {
              $ifNull: [{ $arrayElemAt: ['$metadata.totalItems', 0] }, 0],
            },
            totalPages: {
              $ceil: {
                $divide: [
                  {
                    $ifNull: [{ $arrayElemAt: ['$metadata.totalItems', 0] }, 0],
                  },
                  parseInt(limit) || 5,
                ],
              },
            },
          },
        },
      ]);

      res.status(200).json({ procedurePackage });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  GetProcedurePackageByid: async (req, res) => {
    try {
      const { userId, id } = req.query;
      const procedurePackage = await ProcedurePackage.findOne({
        _id: id,
        bussinessId: userId,
      })
        .lean()
        .exec();
      if (!procedurePackage) {
        res.status(404).json({ message: 'Procedure Package not found' });
      }
      res.status(200).json({ procedurePackage });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  updateProcedurePackage: async (req, res) => {
    try {
      const { userId, id } = req.query;
      const { packageName, category, description, packageItems } = req.body;

      const procedurePackage = await ProcedurePackage.findOneAndUpdate(
        { _id: id, bussinessId: userId },
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
        return res.status(404).json({ message: 'Procedure Package not found' });
      }

      res.status(200).json({ procedurePackage });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  // Delete Procedure Package
  deleteProcedureitems: async (req, res) => {
    try {
      const { userId, id } = req.query;
      const procedurePackage = await ProcedurePackage.findOneAndUpdate(
        {
          'packageItems._id': id,
          bussinessId: userId,
        },
        { $pull: { packageItems: { _id: id } } },
        { new: true }
      ).lean();
      if (!procedurePackage) {
        return res.status(404).json({ message: 'Procedure Package not found' });
      }
      res
        .status(200)
        .json({ message: 'Procedure Package deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  deleteProcedurePackage: async (req, res) => {
    try {
      const { userId, id } = req.query;
      const procedurePackage = await ProcedurePackage.findOneAndDelete({
        _id: id,
        bussinessId: userId,
      })
        .lean()
        .exec();
      if (!procedurePackage) {
        return res.status(404).json({ message: 'Procedure Package not found' });
      }
      res
        .status(200)
        .json({ message: 'Procedure Package deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  getApproachngExpiryGraphs: async (req, res) => {
    try {
      const { userId } = req.query;
      const today = new Date();
      console.log('getApproachngExpiryGraphs:', userId);

      const response = await Inventory.aggregate([
        { $match: { bussinessId: userId } },
        {
          $addFields: {
            expiryDateConverted: { $toDate: '$expiryDate' },
          },
        },
        {
          $addFields: {
            daysUntilExpiry: {
              $dateDiff: {
                startDate: today,
                endDate: '$expiryDateConverted',
                unit: 'day',
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
                  { case: { $lte: ['$daysUntilExpiry', 7] }, then: '7 days' },
                  {
                    case: {
                      $and: [
                        { $gt: ['$daysUntilExpiry', 7] },
                        { $lte: ['$daysUntilExpiry', 15] },
                      ],
                    },
                    then: '15 days',
                  },
                  {
                    case: {
                      $and: [
                        { $gt: ['$daysUntilExpiry', 15] },
                        { $lte: ['$daysUntilExpiry', 30] },
                      ],
                    },
                    then: '30 days',
                  },
                  {
                    case: {
                      $and: [
                        { $gt: ['$daysUntilExpiry', 30] },
                        { $lte: ['$daysUntilExpiry', 60] },
                      ],
                    },
                    then: '60 days',
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
            category: '$_id',
            totalCount: 1,
          },
        },
        { $sort: { category: 1 } },
      ]);

      res.status(200).json({ data: response });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  inventoryOverView: async (req, res) => {
    try {
      const { userId } = req.query;
      console.log("userId",userId);
      const inventory = await Inventory.aggregate([
        {
          $match: { bussinessId: userId },
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalValue: { $sum: '$price' },
            lowStockCount: { 
              $sum: { 
                $cond: { if: { $and: [{ $lte: ['$quantity', 10] }, { $gt: ['$quantity', 0] }] }, then: 1, else: 0 } 
              } 
            },
            outOfStockCount: { 
              $sum: { 
                $cond: { if: { $eq: ['$quantity', 0] }, then: 1, else: 0 } 
              } 
            },
          },
        },
      ]);
    
      res.status(200).json({ inventory });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
    
  },
};

module.exports = InventoryControllers;
