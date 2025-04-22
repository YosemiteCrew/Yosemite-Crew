const express = require("express");
const { AdminController } = require("../controllers/AdminController");

const router = express.Router();

router.post("/addCotegory", AdminController.AddInventoryCotegory);
router.post("/addManufacturer", AdminController.AddInventoryManufacturer);
router.post("/addItemCotegory", AdminController.AddInventoryItemCotegory);
router.get("/GetAddInventoryCotegory",AdminController.GetAddInventoryCotegory)
module.exports = router;
