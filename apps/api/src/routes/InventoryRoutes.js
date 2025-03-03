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
router.get('/GetProcedurePackageByid', InventoryControllers.GetProcedurePackageByid);
router.put('/updateProcedurePackage', InventoryControllers.updateProcedurePackage);
router.delete(
  '/deleteProcedureitems',
  InventoryControllers.deleteProcedureitems
);
router.delete('/deleteProcedurePackage', InventoryControllers.deleteProcedurePackage);
router.get('/getApproachngExpiryGraphs',InventoryControllers.getApproachngExpiryGraphs)
router.get('/inventoryOverView',InventoryControllers.inventoryOverView)
module.exports = router;
