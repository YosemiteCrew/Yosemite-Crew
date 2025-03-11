const express = require('express');
const InventoryControllers = require('../controllers/InventoryController');
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/addInventory',verifyTokenAndRefresh, InventoryControllers.AddInventory);
router.get('/getInventory',verifyTokenAndRefresh, InventoryControllers.getInventory);
router.post('/AddProcedurePackage',verifyTokenAndRefresh, InventoryControllers.AddProcedurePackage);
router.get(
  '/getToViewItemsDetaild',verifyTokenAndRefresh,
  InventoryControllers.getToViewItemsDetaild
);
router.get('/getProceurePackage',verifyTokenAndRefresh, InventoryControllers.getProceurePackage);
router.get('/GetProcedurePackageByid',verifyTokenAndRefresh, InventoryControllers.GetProcedurePackageByid);
router.put('/updateProcedurePackage',verifyTokenAndRefresh, InventoryControllers.updateProcedurePackage);
router.delete(
  '/deleteProcedureitems',verifyTokenAndRefresh,
  InventoryControllers.deleteProcedureitems
);
router.delete('/deleteProcedurePackage',verifyTokenAndRefresh, InventoryControllers.deleteProcedurePackage);
router.get('/getApproachngExpiryGraphs',verifyTokenAndRefresh,InventoryControllers.getApproachngExpiryGraphs)
router.get('/inventoryOverView',verifyTokenAndRefresh,InventoryControllers.inventoryOverView)
module.exports = router;
