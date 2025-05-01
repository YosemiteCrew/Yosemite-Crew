const express = require("express");
const { AdminController } = require("../controllers/ApiAdminControllers");
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post("/addCategory", AdminController.AddInventoryCategory);
router.post("/addManufacturer", AdminController.AddInventoryManufacturer);
router.post("/addItemCategory", AdminController.AddInventoryItemCategory);
router.get("/GetAddInventoryCategory",verifyTokenAndRefresh,AdminController.GetAddInventoryCategory)
router.post("/addProcedurePackage",AdminController.CreateProcedurepackageCategory)
router.get("/procedureCategory",verifyTokenAndRefresh,AdminController.ProcedurePacakageCategorys)
router.post("/breeds",AdminController.Breeds)
router.get("/breeds",AdminController.Breed)
module.exports = router;

