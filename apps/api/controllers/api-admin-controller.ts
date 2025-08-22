import { Request, response, Response } from "express";

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
import { convertJsonToFhir, convertToFhirAppointmentTypes, convertToFhirPurposeOfVisit } from "@yosemite-crew/fhir";
import { FhirHealthcareService, FhirPurposeOfVisit, MongoPurposeOfVisit } from "@yosemite-crew/types";
import { validateFHIR } from "../Fhirvalidator/FhirValidator";
// const { PurposeOfVisitFHIRConverter } = require("../utils/AdminFhirHandler");

const AdminController = {
  AddInventoryCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line prefer-const
      let { category, bussinessId } = req.body as { category: string; bussinessId: string };

      // Validate bussinessId (UUID v4 format)
      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
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

      // Validate and sanitize category
      if (typeof category !== "string" || category.length < 2 || category.length > 100) {
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

      // eslint-disable-next-line no-useless-escape
      category = category.trim().replace(/[^\w\s\-]/gi, "");

      // Check for existing category
      const existing = await InventoryCategory.findOne({ category, bussinessId });
      if (existing) {
        res.status(200).json({ message: `${category} already exists` });
        return;
      }

      // Add new category
      const response = await InventoryCategory.create({ category, bussinessId });
      if (response) {
        res.status(200).json({ message: `${category} added successfully` });
      } else {
        res.status(400).json({ message: "Failed to add Inventory Category" });
      }
    } catch (error) {
      console.error("Error adding inventory category:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  AddInventoryManufacturer: async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line prefer-const
      let { manufacturer, bussinessId } = req.body as { manufacturer: string; bussinessId: string };

      // Validate bussinessId (UUID format)
      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
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

      // Validate and sanitize manufacturer
      if (typeof manufacturer !== "string" || manufacturer.length < 2 || manufacturer.length > 100) {
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

      // eslint-disable-next-line no-useless-escape
      manufacturer = manufacturer.trim().replace(/[^\w\s\-]/gi, "");

      // Check if manufacturer already exists
      const existing = await InventoryManufacturer.findOne({ manufacturer, bussinessId });
      if (existing) {
        res.status(200).json({ message: `${manufacturer} already exists` });
        return;
      }

      // Create new manufacturer
      const created = await InventoryManufacturer.create({ manufacturer, bussinessId });

      if (created) {
        res.status(200).json({ message: `${manufacturer} added successfully` });
      } else {
        res.status(400).json({ message: "Failed to add inventory manufacturer" });
      }
    } catch (error) {
      console.error("Error in AddInventoryManufacturer:", error);
      res.status(500).json({ message: "Server error" });
    }
  },


  AddInventoryItemCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line prefer-const
      let { itemCategory, bussinessId } = req.body as { itemCategory: string; bussinessId: string };

      // Validate businessId
      if (typeof bussinessId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(bussinessId)) {
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

      // Validate and sanitize itemCategory
      if (typeof itemCategory !== "string" || itemCategory.length < 2 || itemCategory.length > 100) {
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

      // eslint-disable-next-line no-useless-escape
      itemCategory = itemCategory.trim().replace(/[^\w\s\-]/gi, "");

      // Check if item category already exists
      const existing = await InventoryItemCategory.findOne({ bussinessId, itemCategory });
      if (existing) {
        res.status(200).json({ message: `${itemCategory} already exists` });
        return;
      }

      // Add new item category
      const created = await InventoryItemCategory.create({ itemCategory, bussinessId });

      if (created) {
        res.status(200).json({ message: `${itemCategory} added successfully` });
      } else {
        res.status(400).json({ message: "Failed to add Inventory ItemCategory" });
      }
    } catch (error) {
      console.error("Error in AddInventoryItemCategory:", error);
      res.status(500).json({ message: "Server error" });
    }
  },


  // <<<<<<<<<<<<<<<<<<<<<<<<< get Api's Of Cotegory >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  GetAddInventoryCategory: async (req: Request, res: Response): Promise<void> => {
    const { type } = req.query;
    // console.log("hello", req.query)
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
            const getItem: any = await InventoryCategory.find({ bussinessId }).select('-__v');
            if (getItem) {
              const convertToFHIR = convertJsonToFhir(getItem)
              res.status(200).json(convertToFHIR);
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
          // }
          // break;
          // case "itemCategory":
          //   if (req.method === "GET") {
          //     try {
          //       const { bussinessId } = req.query;
          //       if (!bussinessId) {
          //         res.status(400).json({ message: "Missing BussinessId" });
          //         return;
          //       }
          //       if (
          //         typeof bussinessId !== "string" ||
          //         !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
          //       ) {
          //         res
          //           .status(400)
          //           .json({ message: "Invalid bussinessId format" });
          //         return;
          //       }
          //       const getItem = await InventoryItemCategory.find({ bussinessId });
          //       if (getItem) {
          //         const Response = new ProductCategoryFHIRConverter(
          //           getItem
          //         ).toFHIRBundle();
          //         res.status(200).json(Response);
          //         return;
          //       } else {
          //         res
          //           .status(400)
          //           .json({ message: "failled to get items category" });
          //         return;
          //       }
          //     } catch (error) {
          //       res.status(500).json({ message: "server error" });
          //       return;
          //     }
          //   }
          //   break;
          // case "manufacturerCategory":
          //   if (req.method === "GET") {
          //     try {
          //       const { bussinessId } = req.query;
          //       if (!bussinessId) {
          //         res.status(400).json({ message: "Missing BussinessId" });
          //         return;
          //       }
          //       if (
          //         typeof bussinessId !== "string" ||
          //         !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
          //       ) {
          //         res
          //           .status(400)
          //           .json({ message: "Invalid bussinessId format" });
          //         return;
          //       }
          //       const getItem = await InventoryManufacturer.find({ bussinessId });
          //       if (getItem) {
          //         const Response = new ProductCategoryFHIRConverter(
          //           getItem
          //         ).toFHIRBundle();
          //         res.status(200).json(Response);
          //         return;
          //       } else {
          //         res
          //           .status(400)
          //           .json({ message: "failled to get manufacturer category" });
          //         return;
          //       }
          //     } catch (error) {
          //       res.status(500).json({ message: "server error" });
          //       return;
          //     }
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
      // console.log("hello", bussinessId);
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

      const response: MongoPurposeOfVisit[] = await PurposeOfVisits.find({ HospitalId: HospitalId }).select("-__v -HospitalId");

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = convertToFhirPurposeOfVisit(response) as FhirPurposeOfVisit[]
        res.status(200).json(data);
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
      const { HospitalId, name, category } = req.body as { HospitalId: string, name: string, category: string };

      // ✅ Utility: Capitalize Each Word
      const capitalizeWords = (str: string): string =>
        str
          .trim()
          .split(" ")
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");

      // ✅ Validation Responses
      const sendError = (message: string, severity: "error" | "information" | "fatal", code: string, statusCode: number): void => {
        res.status(statusCode).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity,
              code,
              details: { text: message },
            },
          ],
        });
      };

      // ✅ Validations
      if (!HospitalId) {
        return sendError("Missing required parameter: HospitalId", "information", "informational", 400);
      }
      if (typeof HospitalId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(HospitalId)) {
        return sendError("Invalid HospitalId format.", "error", "invalid", 400);
      }
      if (typeof category !== "string" || category.trim().length === 0 || category.length > 50) {
        return sendError("Invalid or missing category.", "error", "invalid", 400);
      }
      if (typeof name !== "string" || name.trim().length === 0 || name.length > 50) {
        return sendError("Invalid or missing name.", "error", "invalid", 400);
      }

      const sanitizedName = capitalizeWords(name);
      const sanitizedCategory = capitalizeWords(category);

      const existing = await AppointmentType.findOne({
        HospitalId,
        name: sanitizedName,
        category: sanitizedCategory,
      });

      if (existing) {
        return sendError(`${existing.name} already exists`, "information", "informational", 200);
      }

      const newType = await AppointmentType.create({
        HospitalId,
        name: sanitizedName,
        category: sanitizedCategory,
      });

      if (newType) {
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
              text: `${(error as Error).message} - network error`,
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
      }).select("-__v -HospitalId");
      if (response) {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = convertToFhirAppointmentTypes(response as []) as FhirHealthcareService[]
        res.status(200).json(data);
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
