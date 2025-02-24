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
      } = req.query;

      const sortBy = 'expiryDate';
      const order = 'asc';
      console.log('Received Query Params:', req.query);

      let matchStage = {};
      let searchConditions = [];

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
      const inventory = await Inventory.find({
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

      const procedurePackage = await ProcedurePackage.aggregate([
        { $match: { bussinessId: userId } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'totalItems' }],
            data: [
              { $skip: parseInt(skip) || 0 },
              { $limit: parseInt(limit) || 5 },
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
};

module.exports = InventoryControllers;
