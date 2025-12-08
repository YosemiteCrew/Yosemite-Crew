import { Request, Response } from "express";
import { FormService, FormServiceError } from "src/services/form.service";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { FormRequestDTO, FormSubmissionRequestDTO } from "@yosemite-crew/types";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

export const FormController = {
  createForm: async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const formRequest = req.body as FormRequestDTO;

      const form = await FormService.create(orgId, formRequest, userId);
      return res.status(201).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in createForm:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getFormForAdmin: async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId;
      const formId = req.params.formId;

      const form = await FormService.getFormForAdmin(orgId, formId);
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in getFormForAdmin:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getFormListForOrganisation: async(req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId;

      const form = await FormService.listFormsForOrganisation(orgId)
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in getFormForAdmin:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getFormForClient: async (req: Request, res: Response) => {
    try {
      const formId = req.params.formId;

      const form = await FormService.getFormForUser(formId);
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in getFormForClient:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  updateForm: async (req: Request, res: Response) => {
    try {
      const formId = req.params.formId;
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const formRequest = req.body as FormRequestDTO;

      const form = await FormService.update(formId, formRequest, userId);
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in updateForm:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  publishForm: async (req: Request, res: Response) => {
    try {
      const formId = req.params.formId;
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const form = await FormService.publish(formId, userId);
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in publishForm:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  unpublishForm: async (req: Request, res: Response) => {
    try {
      const formId = req.params.formId;
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const form = await FormService.unpublish(formId, userId);
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in unpublishForm:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  archiveForm: async (req: Request, res: Response) => {
    try {
      const formId = req.params.formId;
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const form = await FormService.archive(formId, userId);
      return res.status(200).json(form);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in archiveForm:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  submitForm: async (req: Request, res: Response) => {
    try {
      const submissionRequest = req.body as FormSubmissionRequestDTO;
      const authUserId = resolveUserIdFromRequest(req);
      const authUser = await AuthUserMobileService.getByProviderUserId(
        authUserId!,
      );
      if (!authUser) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User not found" });
      }

      const submission = await FormService.submitFHIR(submissionRequest);
      return res.status(201).json(submission);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in submitForm:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getFormSubmissions: async (req: Request, res: Response) => {
    try {
      const submissionId = req.params.formId;

      const submissions = await FormService.getSubmission(submissionId);
      return res.status(200).json(submissions);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in getFormSubmissions:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  listFormSubmissions: async (req: Request, res: Response) => {
    try {
      const formId = req.params.formId;

      const submissions = await FormService.listSubmissions(formId);
      return res.status(200).json(submissions);
    } catch (error) {
      if (error instanceof FormServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unexpected error in listFormSubmissions:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
