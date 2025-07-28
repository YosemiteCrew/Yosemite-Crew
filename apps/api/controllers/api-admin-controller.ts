import { Request, Response } from "express";

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
  AddInventoryCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      let { category, bussinessId } = req.body;
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid bussinessId format" },
            },
          ],
        });
        return;
      }

      if (
        typeof category !== "string" ||
        category.length < 2 ||
        category.length > 100
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid category name" },
            },
          ],
        });
        return;
      }
      category = category.trim().replace(/[^\w\s\-]/gi, "");

      const getItem = await InventoryCategory.findOne({
        category,
        bussinessId,
      });
      if (getItem) {
        res.status(200).json({ message: `${category} already exist` });
        return;
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
  AddInventoryManufacturer: async (req: Request, res: Response) => {
    try {
      let { manufacturer, bussinessId } = req.body;

      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid bussinessId format" },
            },
          ],
        });
        return;
      }

      if (
        typeof manufacturer !== "string" ||
        manufacturer.length < 2 ||
        manufacturer.length > 100
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid manufacturer name" },
            },
          ],
        });
        return;
      }

      manufacturer = manufacturer.trim().replace(/[^\w\s\-]/gi, "");

      const getItem = await InventoryManufacturer.findOne({
        manufacturer,
        bussinessId,
      });
      if (getItem) {
        res
          .status(200)
          .json({ message: `${manufacturer} already exist` });
        return;
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

  AddInventoryItemCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      let { itemCategory, bussinessId } = req.body;
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid bussinessId format" },
            },
          ],
        });
        return;
      }

      if (
        typeof itemCategory !== "string" ||
        itemCategory.length < 2 ||
        itemCategory.length > 100
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid itemCategory name" },
            },
          ],
        });
        return;
      }

      itemCategory = itemCategory.trim().replace(/[^\w\s\-]/gi, "");

      const getItem = await InventoryItemCategory.findOne({
        bussinessId,
        itemCategory,
      });
      if (getItem) {
        res
          .status(200)
          .json({ message: `${itemCategory} already exist` });
        return;
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

  GetAddInventoryCategory: async (req: Request, res: Response): Promise<void> => {
    const { type } = req.query;
    if (!type) {
      res.status(400).json({ message: "Missing type query params" });
      return;
    }
    switch (type) {
      case "category":
        if (req.method === "GET") {
          try {
            const { bussinessId } = req.query;
            if (!bussinessId) {
              res.status(400).json({ message: "Missing BussinessId" });
              return;
            }
            if (
              typeof bussinessId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
            ) {
              res
                .status(400)
                .json({ message: "Invalid bussinessId format" });
              return;
            }
            const getItem = await InventoryCategory.find({ bussinessId });
            if (getItem) {
              const Response = new ProductCategoryFHIRConverter(
                getItem
              ).toFHIRBundle();
              res.status(200).json(Response);
              return;
            } else {
              res
                .status(400)
                .json({ message: "Failed to get Cotegory" });
              return;
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
              res.status(400).json({ message: "Missing BussinessId" });
              return;
            }
            if (
              typeof bussinessId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
            ) {
              res
                .status(400)
                .json({ message: "Invalid bussinessId format" });
              return;
            }
            const getItem = await InventoryItemCategory.find({ bussinessId });
            if (getItem) {
              const Response = new ProductCategoryFHIRConverter(
                getItem
              ).toFHIRBundle();
              res.status(200).json(Response);
              return;
            } else {
              res
                .status(400)
                .json({ message: "failled to get items category" });
              return;
            }
          } catch (error) {
            res.status(500).json({ message: "server error" });
            return;
          }
        }
        break;
      case "manufacturerCategory":
        if (req.method === "GET") {
          try {
            const { bussinessId } = req.query;
            if (!bussinessId) {
              res.status(400).json({ message: "Missing BussinessId" });
              return;
            }
            if (
              typeof bussinessId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
            ) {
              res
                .status(400)
                .json({ message: "Invalid bussinessId format" });
              return;
            }
            const getItem = await InventoryManufacturer.find({ bussinessId });
            if (getItem) {
              const Response = new ProductCategoryFHIRConverter(
                getItem
              ).toFHIRBundle();
              res.status(200).json(Response);
              return;
            } else {
              res
                .status(400)
                .json({ message: "failled to get manufacturer category" });
              return;
            }
          } catch (error) {
            res.status(500).json({ message: "server error" });
            return;
          }
        }
      default:
        res.status(400).json({ message: "Invalid type query params" });
        return;
    }
  },

  CreateProcedurepackageCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      let { category, bussinessId } = req.body;

      // Validate bussinessId (UUID v4 format)
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid hospitalId format" },
            },
          ],
        });
        return;
      }

      // Validate category
      if (
        typeof category !== "string" ||
        category.length < 2 ||
        category.length > 100
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid category name" },
            },
          ],
        });
        return;
      }

      // Clean category name
      category = category.trim().replace(/[^\w\s\-]/gi, "");

      // Check for duplicates
      const getItem = await ProcedureCategory.findOne({
        bussinessId,
        category,
      });

      if (getItem) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "duplicate",
              details: { text: `${category} already exists` },
            },
          ],
        });
        return;
      }

      // Create category
      const response = await ProcedureCategory.create({
        bussinessId,
        category,
      });

      res.status(201).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "informational",
            details: { text: `Category '${category}' added successfully.` },
          },
        ],
      });
      return;
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: { text: "Internal Server Error" },
          },
        ],
      });
      return;
    }
  },
  ProcedurePacakageCategorys: async (req: Request, res: Response): Promise<void> => {
    try {
      const { bussinessId } = req.query;

      // Check if bussinessId is missing
      if (!bussinessId) {
        res.status(400).json({
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
        return;
      }
      console.log("hello", bussinessId);
      // Check if bussinessId format is valid UUID
      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        res.status(400).json({
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
        return;
      }

      const getItems = await ProcedureCategory.find({ bussinessId });
      



      if (getItems) {
        const data = new ProductCategoryFHIRConverter(getItems).toFHIRBundle();
          console.log("mil gaya data", data);
        res.status(200).json({ data });
        return;
      }

    } catch (error) {
      res.status(500).json({
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
      return;
    }
  },

  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Appointments Api's>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  Breeds: async (req: Request, res: Response): Promise<void> => {
    try {
      const { category, name } = req.body;

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 50
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing breed name." },
            },
          ],
        });
        return;
      }

      const capitalizeWords = (str: string) =>
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
        res.status(200).json({
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
        return;
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
              text: `${(error as Error).message} network error`,
            },
          },
        ],
      });
    }
  },

  Breed: async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.query;

      if (
        typeof category !== "string" ||
        category.trim().length === 0 ||
        category.length > 50
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing category name." },
            },
          ],
        });
        return;
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
              text: `${(error as Error).message} network error`,
            },
          },
        ],
      });
    }
  },
  // <<<<<<<<<<<<<<<<<<<<<<create Api>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  PurposeOfVisit: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, HospitalId } = req.body;
      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        res.status(400).json({
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
        return;
      }

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 50
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing category name." },
            },
          ],
        });
        return;
      }
      const sanitizedName = name.trim();
      const getData = await PurposeOfVisits.findOne({
        name: sanitizedName,
        HospitalId: HospitalId,
      });

      if (getData) {
        res.status(200).json({
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
        return;
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
            diagnostics: (error as Error).message || "Unknown error",
          },
        ],
      });
    }
  },

  // <<<<<<<<<<<<<<<<<<<<Get Api>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  PurposeOfVisitList: async (req: Request, res: Response): Promise<void> => {



    try {
      const { HospitalId } = req.query;
      if (!HospitalId) {
        res.status(400).json({
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
        return;
      }

      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        res.status(400).json({
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
        return;
      }

      const response = await PurposeOfVisits.find({ HospitalId: HospitalId });

      if (!response) {
        res.status(200).json({
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
        return;
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
              text: `${(error as Error).message} network error`,
            },
          },
        ],
      });
    }
  },
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<AppointmentType Api's For Book Appointment>>>>>>>>>>>>>>>>>>>>>>>>>>

  AppointmentType: async (req: Request, res: Response): Promise<void> => {
    try {
      const { HospitalId, name, category } = req.body;
      if (!HospitalId) {
        res.status(400).json({
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
        return;
      }
      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        res.status(400).json({
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
        return;
      }
      if (
        typeof category !== "string" ||
        category.trim().length === 0 ||
        category.length > 50
      ) {
        res.status(400).json({
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
        return;
      }

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 50
      ) {
        res.status(400).json({
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
        return;
      }
      const capitalizeWords = (str: string) =>
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
        res.status(200).json({
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
        return;
      } else {
        const response = await AppointmentType.create({
          HospitalId: HospitalId,
          name: sanitizedName,
          category: modifyCategory,
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
          return;
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
              text: `${(error as Error).message} network error`,
            },
          },
        ],
      });
    }
  },

  Appointments: async (req: Request, res: Response) => {
    try {
      const { HospitalId, category } = req.query;
      if (!HospitalId) {
        res.status(400).json({
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
        return;
      }
      if (
        typeof HospitalId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(HospitalId)
      ) {
        res.status(400).json({
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
        return;
      }
      if (
        typeof category !== "string" ||
        category.trim().length === 0 ||
        category.length > 50
      ) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: { text: "Invalid or missing category name." },
            },
          ],
        });
        return;
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
        res.status(200).json({
          data,
        });
        return;
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            details: {
              text: `${(error as Error).message} network error`,
            },
          },
        ],
      });
    }
  },
};

export default AdminController;
