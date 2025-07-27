import {
  InventoryCategory,
  InventoryManufacturer,
  InventoryItemCategory,
  ProcedureCategory,
} from "../models/AddInventoryCotegory";
import {
  Breeds,
  PurposeOfVisits,
  AppointmentType,
} from "../models/AppointmentOption";
import ProductCategoryFHIRConverter from "../utils/InventoryFhirHandler";
const { PurposeOfVisitFHIRConverter } = require("../utils/AdminFhirHandler");

const AdminController = {
  AddInventoryCategory: async (req, res) => {
    try {
      let { category, bussinessId } = req.body;
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
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

      if (
        typeof category !== "string" ||
        category.length < 2 ||
        category.length > 100
      ) {
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
      category = category.trim().replace(/[^\w\s\-]/gi, "");

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
          res.status(200).json({ message: `${category} added successfully` });
        } else {
          res.status(400).json({ message: "Failed to add Inventory Category" });
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  },
  AddInventoryManufacturer: async (req, res) => {
    try {
      let { manufacturer, bussinessId } = req.body;

      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
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

      if (
        typeof manufacturer !== "string" ||
        manufacturer.length < 2 ||
        manufacturer.length > 100
      ) {
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

      manufacturer = manufacturer.trim().replace(/[^\w\s\-]/gi, "");

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
          res
            .status(200)
            .json({ message: `${manufacturer} added Succesfully` });
        } else {
          res
            .status(400)
            .json({ message: "Failed to add Inventory Manufacturer" });
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Server Error" });
    }
  },

  AddInventoryItemCategory: async (req, res) => {
    try {
      let { itemCategory, bussinessId } = req.body;
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
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

      if (
        typeof itemCategory !== "string" ||
        itemCategory.length < 2 ||
        itemCategory.length > 100
      ) {
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

      itemCategory = itemCategory.trim().replace(/[^\w\s\-]/gi, "");

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
          res
            .status(200)
            .json({ message: `${itemCategory} added succesfully` });
        } else {
          res
            .status(400)
            .json({ message: "Failed to add Inventory ItemCotegory" });
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Server Error" });
    }
  },

  // <<<<<<<<<<<<<<<<<<<<<<<<< get Api's Of Cotegory >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  GetAddInventoryCategory: async (req, res) => {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({ message: "Missing type query params" });
    }
    switch (type) {
      case "category":
        if (req.method === "GET") {
          try {
            const { bussinessId } = req.query;
            if (!bussinessId) {
              return res.status(400).json({ message: "Missing BussinessId" });
            }
            if (
              typeof bussinessId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
            ) {
              return res
                .status(400)
                .json({ message: "Invalid bussinessId format" });
            }
            const getItem = await InventoryCategory.find({ bussinessId });
            if (getItem) {
              const Response = new ProductCategoryFHIRConverter(
                getItem
              ).toFHIRBundle();
              return res.status(200).json(Response);
            } else {
              return res
                .status(400)
                .json({ message: "Failed to get Cotegory" });
            }
          } catch (error) {
            res.status(500).json(error);
          }
        }
        break;
      case "itemCategory":
        if (req.method === "GET") {
          try {
            const { bussinessId } = req.query;
            if (!bussinessId) {
              return res.status(400).json({ message: "Missing BussinessId" });
            }
            if (
              typeof bussinessId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
            ) {
              return res
                .status(400)
                .json({ message: "Invalid bussinessId format" });
            }
            const getItem = await InventoryItemCategory.find({ bussinessId });
            if (getItem) {
              const Response = new ProductCategoryFHIRConverter(
                getItem
              ).toFHIRBundle();
              return res.status(200).json(Response);
            } else {
              return res
                .status(400)
                .json({ message: "failled to get items category" });
            }
          } catch (error) {
            return res.status(500).json({ message: "server error" });
          }
        }
        break;
      case "manufacturerCategory":
        if (req.method === "GET") {
          try {
            const { bussinessId } = req.query;
            if (!bussinessId) {
              return res.status(400).json({ message: "Missing BussinessId" });
            }
            if (
              typeof bussinessId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
            ) {
              return res
                .status(400)
                .json({ message: "Invalid bussinessId format" });
            }
            const getItem = await InventoryManufacturer.find({ bussinessId });
            if (getItem) {
              const Response = new ProductCategoryFHIRConverter(
                getItem
              ).toFHIRBundle();
              return res.status(200).json(Response);
            } else {
              return res
                .status(400)
                .json({ message: "failled to get manufacturer category" });
            }
          } catch (error) {
            return res.status(500).json({ message: "server error" });
          }
        }
      default:
        return res.status(400).json({ message: "Invalid type query params" });
    }
  },

  CreateProcedurepackageCategory: async (req, res) => {
    try {
      let { category, bussinessId } = req.body;

      // Validate bussinessId (UUID v4 format)
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
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
      if (
        typeof category !== "string" ||
        category.length < 2 ||
        category.length > 100
      ) {
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
      const getItem = await ProcedureCategory.findOne({
        bussinessId,
        category,
      });

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
      const response = await ProcedureCategory.create({
        bussinessId,
        category,
      });

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
      console.log("hello", bussinessId);
      // Check if bussinessId format is valid UUID
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
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

      const getItems = await ProcedureCategory.find({ bussinessId });
      



      if (getItems) {
        const data = new ProductCategoryFHIRConverter(getItems).toFHIRBundle();
          console.log("mil gaya data", data);
        return res.status(200).json({ data });
      
      }

    } catch (error) {
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
  },

  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Appointments Api's>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  Breeds: async (req, res) => {
    try {
      const { category, name } = req.body;

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 50
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing breed name." },
            },
          ],
        });
      }

      const capitalizeWords = (str) =>
        str
          .trim()
          .split(" ")
          .filter(Boolean)
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");

      const sanitizedName = capitalizeWords(name);
      const modifyCategory = capitalizeWords(category);

      const getData = await Breeds.findOne({ name: sanitizedName });
      if (getData) {
        return res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: `${getData.name} already exists`,
              },
            },
          ],
        });
      }

      const response = await Breeds.create({
        category: modifyCategory,
        name: sanitizedName,
      });

      if (response) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: `${sanitizedName} Saved Successfully`,
              },
            },
          ],
        });
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: `${error.message} network error`,
            },
          },
        ],
      });
    }
  },

  Breed: async (req, res) => {
    try {
      const { category } = req.query;

      if (
        typeof category !== "string" ||
        category.trim().length === 0 ||
        category.length > 50
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing category name." },
            },
          ],
        });
      }

      // Optional: sanitize input (e.g., remove special characters if needed)
      const sanitizedName = category.trim();
      const response = await Breeds.find({
        category: sanitizedName,
      });

      if (response.length > 0) {
        const data = new PurposeOfVisitFHIRConverter(response).toValueSet();
        res.status(200).json({
          message: "fetched breeds successfully",
          data,
        });
      } else {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: "No Breeds Found",
              },
            },
          ],
          data: [],
        });
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: `${error.message} network error`,
            },
          },
        ],
      });
    }
  },
  // <<<<<<<<<<<<<<<<<<<<<<create Api>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  PurposeOfVisit: async (req, res) => {
    try {
      const { name, HospitalId } = req.body;
      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Invalid HospitalId format.",
              },
            },
          ],
        });
      }

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 50
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing category name." },
            },
          ],
        });
      }
      const sanitizedName = name.trim();
      const getData = await PurposeOfVisits.findOne({
        name: sanitizedName,
        HospitalId: HospitalId,
      });

      if (getData) {
        return res.status(200).json({
          resourceType: "operationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: `${getData.name} already exist`,
              },
            },
          ],
        });
      }
      const response = await PurposeOfVisits.create({
        name: sanitizedName,
        HospitalId: HospitalId,
      });
      if (response) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: `${sanitizedName} saved successfully`,
              },
            },
          ],
        });
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: "An unexpected network error occurred.",
            },
            diagnostics: error.message || "Unknown error",
          },
        ],
      });
    }
  },

  // <<<<<<<<<<<<<<<<<<<<Get Api>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  PurposeOfVisitList: async (req, res) => {



    try {
      const { HospitalId } = req.query;
      if (!HospitalId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: "Missing required parameter HospitalId",
              },
            },
          ],
        });
      }

      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Invalid HospitalId format",
              },
            },
          ],
        });
      }

      const response = await PurposeOfVisits.find({ HospitalId: HospitalId });

      if (!response) {
        return res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: "No Data Available",
              },
            },
          ],
        });
      } else {
        const data = new PurposeOfVisitFHIRConverter(
          response,
          HospitalId
        ).toValueSet();
        res.status(200).json({ data });
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: `${error.message} network error`,
            },
          },
        ],
      });
    }
  },
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<AppointmentType Api's For Book Appointment>>>>>>>>>>>>>>>>>>>>>>>>>>

  AppointmentType: async (req, res) => {
    try {
      const { HospitalId, name, category } = req.body;
      if (!HospitalId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: "Missing required parameter: HospitalId",
              },
            },
          ],
        });
      }
      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Invalid HospitalId format.",
              },
            },
          ],
        });
      }
      if (
        typeof category !== "string" ||
        category.trim().length === 0 ||
        category.length > 50
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Invalid or missing category.",
              },
            },
          ],
        });
      }

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 50
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "invalid or missing name.",
              },
            },
          ],
        });
      }
      const capitalizeWords = (str) =>
        str
          .trim()
          .split(" ")
          .filter(Boolean)
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");

      const sanitizedName = capitalizeWords(name);
      const modifyCategory = capitalizeWords(category);
      const getData = await AppointmentType.findOne({
        HospitalId: HospitalId,
        name: sanitizedName,
        category: modifyCategory,
      });
      if (getData) {
        return res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: `${getData.name} already exist`,
              },
            },
          ],
        });
      } else {
        const response = await AppointmentType.create({
          HospitalId: HospitalId,
          name: sanitizedName,
          category: modifyCategory,
        });

        if (response) {
          return res.status(200).json({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "information",
                code: "informational",
                details: {
                  text: `${sanitizedName} saved successfully`,
                },
              },
            ],
          });
        }
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: `${error.message} network error`,
            },
          },
        ],
      });
    }
  },

  Appointments: async (req, res) => {
    try {
      const { HospitalId, category } = req.query;
      if (!HospitalId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: "Missing required parameter: HospitalId",
              },
            },
          ],
        });
      }
      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Invalid HospitalId format.",
              },
            },
          ],
        });
      }
      if (
        typeof category !== "string" ||
        category.trim().length === 0 ||
        category.length > 50
      ) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing category name." },
            },
          ],
        });
      }

      // Optional: sanitize input (e.g., remove special characters if needed)
      const sanitizedName = category.trim();
      const response = await AppointmentType.find({
        HospitalId: HospitalId,
        category: sanitizedName,
      });
      if (response) {
        var data = new PurposeOfVisitFHIRConverter(
          response,
          HospitalId
        ).toValueSet();
        return res.status(200).json({
          data,
        });
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: `${error.message} network error`,
            },
          },
        ],
      });
    }
  },
};

export default AdminController;
