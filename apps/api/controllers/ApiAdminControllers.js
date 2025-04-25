const { validateFHIR } = require("../Fhirvalidator/FhirValidator");
const {
  InventoryCategory,
  InventoryManufacturer,
  InventoryItemCategory,
  ProcedureCategory,
} = require("../models/AddInventoryCotegory");
const { ProductCategoryFHIRConverter } = require("../utils/InventoryFhirHandler");

const AdminController = {
  AddInventoryCategory: async (req, res) => {
    try {
      const { category, bussinessId } = req.body;
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
  
      if (typeof category !== "string" || category.length < 2 || category.length > 100) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid category name" },
            },
          ],
        });
      }
  
      category = category.trim().replace(/[^\w\s\-]/gi, '');

      const getItem = await InventoryCategory.findOne({
        category,
        bussinessId,
      });
      if (getItem) {
        return res.status(200).json({ message: `${category} already exist` });
      } else {
        const response = await InventoryCategory.create({
          category,
          bussinessId,
        });

        if (response) {
          res
            .status(200)
            .json({ message: `${category} added successfully` });
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

  AddInventoryItemCategory: async (req, res) => {
    try {
      const { itemCategory, bussinessId } = req.body;
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
  
      if (typeof itemCategory !== "string" || itemCategory.length < 2 || itemCategory.length > 100) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid itemCategory name" },
            },
          ],
        });
      }
  
      itemCategory = itemCategory.trim().replace(/[^\w\s\-]/gi, '');


      const getItem = await InventoryItemCategory.findOne({
        bussinessId,
        itemCategory,
      });
      if (getItem) {
        return res
          .status(200)
          .json({ message: `${itemCategory} already exist` });
      } else {
        const response = await InventoryItemCategory.create({
          itemCategory,
          bussinessId,
        });
        if (response) {
          res.status(200).json({ message: `${itemCategory} added succesfully` });
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

  
GetAddInventoryCategory: async(req, res) => {
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
    case "itemCategory":
      if(req.method === "GET"){
        try {
          const {bussinessId}= req.query;
          if (!bussinessId) {
            return res.status(400).json({message:"Missing BussinessId"});
          }
          if (typeof bussinessId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
            return res.status(400).json({ message: 'Invalid bussinessId format' });
          }
          const getItem = await InventoryItemCategory.find({bussinessId});
          if(getItem) {
           

            const Response = new ProductCategoryFHIRConverter(getItem).toFHIRBundle()
          console.log(validateFHIR(Response));
          return res.status(200).json(Response);
           

            
            
          }else{
            return res.status(400).json({message:"failled to get items category"})
          }
        } catch (error) {
              return res.status(500).json({message:"server error"})          
        }
      }
      break;
      case "manufacturerCategory":
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
              return res.status(400).json({message:"failled to get manufacturer category"})
            }
          } catch (error) {
                return res.status(500).json({message:"server error"})          
          }
        }
    default:
      return res.status(400).json({message:"Invalid type query params"});
    }
  
},

CreateProcedurepackageCategory: async (req, res) => {
  try {
    let { category, bussinessId } = req.body;

    // Validate bussinessId (UUID v4 format)
    if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            details: { text: "Invalid hospitalId format" },
          },
        ],
      });
    }

    // Validate category
    if (typeof category !== "string" || category.length < 2 || category.length > 100) {
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            details: { text: "Invalid category name" },
          },
        ],
      });
    }

    // Clean category name
    category = category.trim().replace(/[^\w\s\-]/gi, "");

    // Check for duplicates
    const getItem = await ProcedureCategory.findOne({ bussinessId, category });

    if (getItem) {
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "duplicate",
            details: { text: `${category} already exists` },
          },
        ],
      });
    }

    // Create category
    const response = await ProcedureCategory.create({ bussinessId, category });

    return res.status(201).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "information",
          code: "informational",
          details: { text: `Category '${category}' added successfully.` },
        },
      ],
    });

  } catch (error) {
    console.error("CreateProcedurepackageCategory error:", error);
    return res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "fatal",
          code: "exception",
          details: { text: "Internal Server Error" },
        },
      ],
    });
  }
},
ProcedurePacakageCategorys: async (req, res) => {
  try {
    const { bussinessId } = req.query;

    // Check if bussinessId is missing
    if (!bussinessId) {
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            details: {
              text: "Missing required query parameter: bussinessId",
            },
          },
        ],
      });
    }

    // Check if bussinessId format is valid UUID
    if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            details: {
              text: "Invalid bussinessId format. Must be a UUID.",
            },
          },
        ],
      });
    }

    const getItems = await ProcedureCategory.find({bussinessId});
    if (getItems) {


      const data = new ProductCategoryFHIRConverter(getItems).toFHIRBundle();
      console.log(data);
      return res.status(200).json({data});
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: {
            text: "An internal server error occurred.",
          },
        },
      ],
    });
  }
}

}

module.exports = { AdminController };
