const express = require('express');
const InventoryControllers = require('../controllers/InventoryController');
const router = express.Router();

router.post('/addInventory', InventoryControllers.AddInventory);
router.get('/getInventory', InventoryControllers.getInventory);
router.post('/AddProcedurePackage', InventoryControllers.AddProcedurePackage);
router.get(
  '/getToViewItemsDetaild',
  InventoryControllers.getToViewItemsDetaild
);
router.get('/getProceurePackage', InventoryControllers.getProceurePackage);
module.exports = router;
