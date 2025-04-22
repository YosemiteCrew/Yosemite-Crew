const { validateFHIR } = require("../Fhirvalidator/FhirValidator");
const {
  InventoryCategory,
  InventoryManufacturer,
  InventoryItemCategory,
} = require("../models/AddInventoryCotegory");
const { ProductCategoryFHIRConverter } = require("../utils/InventoryFhirHandler");

const AdminController = {
  AddInventoryCotegory: async (req, res) => {
    try {
      const { cotegory, bussinessId } = req.body;
      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid bussinessId format" },
            },
          ],
        });
      }
  
      if (typeof cotegory !== "string" || cotegory.length < 2 || cotegory.length > 100) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid cotegory name" },
            },
          ],
        });
      }
  
      cotegory = cotegory.trim().replace(/[^\w\s\-]/gi, '');

      const getItem = await InventoryCategory.findOne({
        cotegory,
        bussinessId,
      });
      if (getItem) {
        return res.status(200).json({ message: `${cotegory} already exist` });
      } else {
        const response = await InventoryCategory.create({
          cotegory,
          bussinessId,
        });

        if (response) {
          res
            .status(200)
            .json({ message: `${cotegory} added successfully` });
        } else {
          res.status(400).json({ message: "Failed to add Inventory Category" });
        }
      }
    } catch (error) {
      console.error("AddInventoryCotegory Error:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
  AddInventoryManufacturer: async (req, res) => {
    try {
      const { manufacturer, bussinessId } = req.body;

      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid bussinessId format" },
            },
          ],
        });
      }
  
      if (typeof manufacturer !== "string" || manufacturer.length < 2 || manufacturer.length > 100) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid manufacturer name" },
            },
          ],
        });
      }
  
      manufacturer = manufacturer.trim().replace(/[^\w\s\-]/gi, '');

      const getItem = await InventoryManufacturer.findOne({
        manufacturer,
        bussinessId,
      });
      if (getItem) {
        return res
          .status(200)
          .json({ message: `${manufacturer} already exist` });
      } else {
        const response = await InventoryManufacturer.create({
          manufacturer,
          bussinessId,
        });
        if (response) {
          res.status(200).json({ message: `${manufacturer} added Succesfully` });
        } else {
          res
            .status(400)
            .json({ message: "Failed to add Inventory Manufacturer" });
        }
      }
    } catch (error) {
      console.log("AddInventoryManufacturer Error", error);
      res.status(500).json({ message: "Server Error" });
    }
  },

  AddInventoryItemCotegory: async (req, res) => {
    try {
      const { itemCotegory, bussinessId } = req.body;
      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid bussinessId format" },
            },
          ],
        });
      }
  
      if (typeof itemCotegory !== "string" || itemCotegory.length < 2 || itemCotegory.length > 100) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid itemCotegory name" },
            },
          ],
        });
      }
  
      itemCotegory = itemCotegory.trim().replace(/[^\w\s\-]/gi, '');


      const getItem = await InventoryItemCategory.findOne({
        bussinessId,
        itemCotegory,
      });
      if (getItem) {
        return res
          .status(200)
          .json({ message: `${itemCotegory} already exist` });
      } else {
        const response = await InventoryItemCategory.create({
          itemCotegory,
          bussinessId,
        });
        if (response) {
          res.status(200).json({ message: `${itemCotegory} added succesfully` });
        } else {
          res
            .status(400)
            .json({ message: "Failed to add Inventory ItemCotegory" });
        }
      }
    } catch (error) {
      console.log("AddInventoryItemCotegory Error", error);
      res.status(500).json({ message: "Server Error" });
    }
  },

// <<<<<<<<<<<<<<<<<<<<<<<<< get Api's Of Cotegory >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  
GetAddInventoryCotegory: async(req, res) => {
  const {type} = req.query
  if (!type) {
    return res.status(400).json({ message:"Missing type query params"})
  }
switch (type) {
  case "category":
    if(req.method === "GET"){
      try {
        const {bussinessId} = req.query;
        if (!bussinessId) {
          return res.status(400).json({message:"Missing BussinessId"});
        }
        if (typeof bussinessId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
          return res.status(400).json({ message: 'Invalid bussinessId format' });
        }
        const getItem = await InventoryCategory.find({bussinessId});
        if (getItem) {
          console.log(getItem);
          const Response = new ProductCategoryFHIRConverter(getItem).toFHIRBundle()
          console.log(validateFHIR(Response));
          return res.status(200).json(Response);
        }else{
          return res.status(400).json({message: "Failed to get Cotegory"});
        }
      } catch (error) {
        res.status(500).json(error);
      }
    }
    break;
    case "itemCotegory":
      if(req.method === "GET"){
        try {
          const {bussinessId}= req.query;
          if (!bussinessId) {
            return res.status(400).json({message:"Missing BussinessId"});
          }
          if (typeof bussinessId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
            return res.status(400).json({ message: 'Invalid bussinessId format' });
          }
          const getItem = await InventoryItemCotegory.find({bussinessId});
          if(getItem) {
            console.log("---=-=-=-=-=-=-=-=-==-==",getItem);

            const Response = new ProductCategoryFHIRConverter(getItem).toFHIRBundle()
          console.log(validateFHIR(Response));
          return res.status(200).json(Response);
           

            
            
          }else{
            return res.status(400).json({message:"failled to get items cotegory"})
          }
        } catch (error) {
              return res.status(500).json({message:"server error"})          
        }
      }
      break;
      case "manufacturerCotegory":
        if(req.method === "GET"){
          try {
            const {bussinessId}= req.query;
            if (!bussinessId) {
              return res.status(400).json({message:"Missing BussinessId"});
            }
            if (typeof bussinessId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
              return res.status(400).json({ message: 'Invalid bussinessId format' });
            }
            const getItem = await InventoryManufacturer.find({bussinessId});
            if(getItem) {
              console.log("---=-=-=-=-=-=-=-=-==-==",getItem);
  
              const Response = new ProductCategoryFHIRConverter(getItem).toFHIRBundle()
            console.log(validateFHIR(Response));
            return res.status(200).json(Response);
             
  
              
              
            }else{
              return res.status(400).json({message:"failled to get manufacturer cotegory"})
            }
          } catch (error) {
                return res.status(500).json({message:"server error"})          
          }
        }
    default:
      return res.status(400).json({message:"Invalid type query params"});
    }
  
}

};

module.exports = { AdminController };
