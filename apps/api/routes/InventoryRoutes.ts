import express from 'express';
import InventoryControllers from '../controllers/InventoryController';
import { verifyToken, verifyTokenAndRefresh } from '../middlewares/authMiddleware';
const router = express.Router();

router.post('/addInventory',verifyToken, InventoryControllers.AddInventory);
router.get('/InventoryItem',verifyToken, InventoryControllers.getInventory);
router.post('/AddProcedurePackage',verifyTokenAndRefresh, InventoryControllers.AddProcedurePackage);
// router.get(
//   '/InventoryReport',verifyTokenAndRefresh,
//   InventoryControllers.getToViewItemsDetaild
// );
router.get('/getProceurePackage',verifyTokenAndRefresh, InventoryControllers.getProceurePackage);
router.get('/GetProcedurePackageByid',verifyTokenAndRefresh, InventoryControllers.GetProcedurePackageByid);
router.put('/procedures',verifyTokenAndRefresh, InventoryControllers.updateProcedurePackage);
router.delete(
  '/deleteProcedureitems',verifyTokenAndRefresh,
  InventoryControllers.deleteProcedureitems
);
router.delete('/ProcedurePackage/:id',verifyTokenAndRefresh, InventoryControllers.deleteProcedurePackage);
router.get('/getApproachngExpiryGraphs',verifyTokenAndRefresh,InventoryControllers.getApproachngExpiryGraphs)
router.get('/InventoryReports',verifyTokenAndRefresh,InventoryControllers.inventoryOverView)
export default router;
