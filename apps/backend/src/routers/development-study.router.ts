import { Router, Response } from "express";
import { z } from "zod";
import { DevelopmentStudyService } from "../services/development-study.service.js";
import {
  DevelopmentStudyStatus,
  ExperimentDesignType,
  FactorType,
  FactorRole,
  ExperimentStatus,
  RunStatus,
  ModelType,
  ModelFitStatus,
  PlotType,
} from "@yosemite-crew/types";
import { requireWebAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import {
  withDesignedExperimentOrgPermissions,
  withDevelopmentStudyOrgPermissions,
  withExperimentModelOrgPermissions,
  withExperimentRunOrgPermissions,
  withOrgPermissions,
  withProcessParameterRangeLinkOrgPermissions,
  withProcessParameterRangeOrgPermissions,
} from "../middlewares/rbac.js";

const developmentStudyRouter = Router();
const service = new DevelopmentStudyService();

const sendRequestError = (res: Response, error: unknown, message: string) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ errors: z.flattenError(error).fieldErrors });
  } else {
    res.status(500).json({ error: message });
  }
};

developmentStudyRouter.use(requireWebAuth);

developmentStudyRouter.post(
  "/studies",
  withOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        organisationId: z.uuid(),
        productName: z.string().min(1),
        productCode: z.string().optional(),
        description: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const study = await service.createStudy({
        ...input,
        createdById: req.userId!,
      });
      res.status(201).json(study);
    } catch (error) {
      sendRequestError(res, error, "Failed to create study");
    }
  },
);

developmentStudyRouter.get(
  "/studies",
  withOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { organisationId } = req.query;
      if (!organisationId || typeof organisationId !== "string") {
        res.status(400).json({ error: "organisationId is required" });
        return;
      }
      const studies = await service.getStudiesByOrganisation(organisationId);
      res.json(studies);
    } catch {
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  },
);

developmentStudyRouter.get(
  "/studies/:studyId",
  withDevelopmentStudyOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const study = await service.getStudyById(req.params.studyId);
      if (!study) {
        res.status(404).json({ error: "Study not found" });
        return;
      }
      res.json(study);
    } catch {
      res.status(500).json({ error: "Failed to fetch study" });
    }
  },
);

developmentStudyRouter.patch(
  "/studies/:studyId/status",
  withDevelopmentStudyOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.enum(DevelopmentStudyStatus),
      });
      const { status } = schema.parse(req.body);
      const study = await service.updateStudyStatus(req.params.studyId, status);
      res.json(study);
    } catch (error) {
      sendRequestError(res, error, "Failed to update study status");
    }
  },
);

developmentStudyRouter.post(
  "/studies/:studyId/experiments",
  withDevelopmentStudyOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        designType: z.enum(ExperimentDesignType),
        resolution: z.number().int().positive().optional(),
        aliases: z.any().optional(),
        centrePoints: z.number().int().nonnegative().optional(),
        blocks: z.number().int().positive().optional(),
        replicates: z.number().int().positive().optional(),
        randomSeed: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const experiment = await service.createExperiment({
        studyId: req.params.studyId,
        ...input,
        createdById: req.userId!,
      });
      res.status(201).json(experiment);
    } catch (error) {
      sendRequestError(res, error, "Failed to create experiment");
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const experiment = await service.getExperimentById(
        req.params.experimentId,
      );
      if (!experiment) {
        res.status(404).json({ error: "Experiment not found" });
        return;
      }
      res.json(experiment);
    } catch {
      res.status(500).json({ error: "Failed to fetch experiment" });
    }
  },
);

developmentStudyRouter.get(
  "/studies/:studyId/experiments",
  withDevelopmentStudyOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const experiments = await service.getExperimentsByStudy(
        req.params.studyId,
      );
      res.json(experiments);
    } catch {
      res.status(500).json({ error: "Failed to fetch experiments" });
    }
  },
);

developmentStudyRouter.patch(
  "/experiments/:experimentId/status",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.enum(ExperimentStatus),
      });
      const { status } = schema.parse(req.body);
      const experiment = await service.updateExperimentStatus(
        req.params.experimentId,
        status,
      );
      res.json(experiment);
    } catch (error) {
      sendRequestError(res, error, "Failed to update experiment status");
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/factors",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        displayName: z.string().optional(),
        type: z.enum(FactorType),
        role: z.enum(FactorRole).optional(),
        unit: z.string().optional(),
        lowLevel: z.number().optional(),
        highLevel: z.number().optional(),
        levels: z.any().optional(),
        goal: z.string().optional(),
        isConstant: z.boolean().optional(),
        constantValue: z.number().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      });
      const input = schema.parse(req.body);
      const factor = await service.addFactor({
        experimentId: req.params.experimentId,
        ...input,
      });
      res.status(201).json(factor);
    } catch (error) {
      sendRequestError(res, error, "Failed to add factor");
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/responses",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        displayName: z.string().optional(),
        unit: z.string().optional(),
        goal: z.string().optional(),
        target: z.number().optional(),
        lowerSpec: z.number().optional(),
        upperSpec: z.number().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      });
      const input = schema.parse(req.body);
      const response = await service.addResponse({
        experimentId: req.params.experimentId,
        ...input,
      });
      res.status(201).json(response);
    } catch (error) {
      sendRequestError(res, error, "Failed to add response");
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/lock-run-order",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        randomSeed: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const experiment = await service.lockRunOrder({
        experimentId: req.params.experimentId,
        lockedBy: req.userId!,
        randomSeed: input.randomSeed,
      });
      res.json(experiment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: z.flattenError(error).fieldErrors });
      } else {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Failed to lock run order",
        });
      }
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/generate-runs",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const runs = await service.generateRuns(req.params.experimentId);
      res.status(201).json(runs);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to generate runs",
      });
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/runs",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        runNumber: z.number().int().positive(),
        standardOrder: z.number().int().positive().optional(),
        blockNumber: z.number().int().positive().optional(),
        seed: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const run = await service.createRun({
        experimentId: req.params.experimentId,
        ...input,
      });
      res.status(201).json(run);
    } catch (error) {
      sendRequestError(res, error, "Failed to create run");
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/runs",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const runs = await service.getRunsByExperiment(req.params.experimentId);
      res.json(runs);
    } catch {
      res.status(500).json({ error: "Failed to fetch runs" });
    }
  },
);

developmentStudyRouter.patch(
  "/runs/:runId/status",
  withExperimentRunOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.enum(RunStatus),
        deviationNotes: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const run = await service.updateRunStatus({
        runId: req.params.runId,
        status: input.status,
        deviationNotes: input.deviationNotes,
        completedBy: req.userId!,
      });
      res.json(run);
    } catch (error) {
      sendRequestError(res, error, "Failed to update run status");
    }
  },
);

developmentStudyRouter.post(
  "/runs/:runId/factor-values",
  withExperimentRunOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        factorId: z.uuid(),
        value: z.number(),
      });
      const input = schema.parse(req.body);
      const value = await service.setRunFactorValue({
        runId: req.params.runId,
        ...input,
      });
      res.json(value);
    } catch (error) {
      sendRequestError(res, error, "Failed to set factor value");
    }
  },
);

developmentStudyRouter.post(
  "/runs/:runId/response-values",
  withExperimentRunOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        responseId: z.uuid(),
        value: z.number(),
      });
      const input = schema.parse(req.body);
      const value = await service.setRunResponseValue({
        runId: req.params.runId,
        ...input,
      });
      res.json(value);
    } catch (error) {
      sendRequestError(res, error, "Failed to set response value");
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/models",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        type: z.enum(ModelType),
        formula: z.string().min(1),
        terms: z.any(),
        anovaTable: z.any().optional(),
        lackOfFit: z.any().optional(),
        estimates: z.any().optional(),
        residuals: z.any().optional(),
        rSquared: z.number().optional(),
        rSquaredAdjusted: z.number().optional(),
        rSquaredPredicted: z.number().optional(),
        pValue: z.number().optional(),
        environmentHash: z.string().optional(),
        environmentSnapshot: z.any().optional(),
      });
      const input = schema.parse(req.body);
      const model = await service.fitModel({
        experimentId: req.params.experimentId,
        ...input,
        fittedBy: req.userId!,
      });
      res.status(201).json(model);
    } catch (error) {
      sendRequestError(res, error, "Failed to fit model");
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/models",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const models = await service.getModelsByExperiment(
        req.params.experimentId,
      );
      res.json(models);
    } catch {
      res.status(500).json({ error: "Failed to fetch models" });
    }
  },
);

developmentStudyRouter.patch(
  "/models/:modelId/status",
  withExperimentModelOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.enum(ModelFitStatus),
      });
      const { status } = schema.parse(req.body);
      const model = await service.updateModelStatus(req.params.modelId, status);
      res.json(model);
    } catch (error) {
      sendRequestError(res, error, "Failed to update model status");
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/plots",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        modelId: z.uuid().optional(),
        type: z.enum(PlotType),
        title: z.string().min(1),
        config: z.any(),
        imageData: z.string().optional(),
        pdfData: z.string().optional(),
        spreadsheetData: z.any().optional(),
      });
      const input = schema.parse(req.body);
      const plot = await service.createPlot({
        experimentId: req.params.experimentId,
        modelId: input.modelId,
        type: input.type,
        title: input.title,
        config: input.config,
        imageData: input.imageData
          ? Uint8Array.from(Buffer.from(input.imageData, "base64"))
          : undefined,
        pdfData: input.pdfData
          ? Uint8Array.from(Buffer.from(input.pdfData, "base64"))
          : undefined,
        spreadsheetData: input.spreadsheetData,
      });
      res.status(201).json(plot);
    } catch (error) {
      sendRequestError(res, error, "Failed to create plot");
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/plots",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plots = await service.getPlotsByExperiment(req.params.experimentId);
      res.json(plots);
    } catch {
      res.status(500).json({ error: "Failed to fetch plots" });
    }
  },
);

developmentStudyRouter.post(
  "/studies/:studyId/ranges",
  withDevelopmentStudyOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        parameterName: z.string().min(1),
        lowerBound: z.number(),
        upperBound: z.number(),
        unit: z.string().optional(),
        confidenceLevel: z.number().optional(),
        evidenceType: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const range = await service.createParameterRange({
        studyId: req.params.studyId,
        ...input,
      });
      res.status(201).json(range);
    } catch (error) {
      sendRequestError(res, error, "Failed to create parameter range");
    }
  },
);

developmentStudyRouter.get(
  "/studies/:studyId/ranges",
  withDevelopmentStudyOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ranges = await service.getParameterRangesByStudy(
        req.params.studyId,
      );
      res.json(ranges);
    } catch {
      res.status(500).json({ error: "Failed to fetch parameter ranges" });
    }
  },
);

developmentStudyRouter.post(
  "/ranges/:rangeId/links",
  withProcessParameterRangeOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        experimentId: z.uuid(),
        modelId: z.uuid().optional(),
        linkType: z.string().min(1),
      });
      const input = schema.parse(req.body);
      const link = await service.linkRangeToExperiment({
        rangeId: req.params.rangeId,
        ...input,
        linkedBy: req.userId!,
      });
      res.status(201).json(link);
    } catch (error) {
      sendRequestError(res, error, "Failed to link range to experiment");
    }
  },
);

developmentStudyRouter.post(
  "/range-links/:linkId/stale",
  withProcessParameterRangeLinkOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        staleReason: z.string().min(1),
      });
      const { staleReason } = schema.parse(req.body);
      const link = await service.markRangeStale({
        linkId: req.params.linkId,
        staledBy: req.userId!,
        staleReason,
      });
      res.json(link);
    } catch (error) {
      sendRequestError(res, error, "Failed to mark range stale");
    }
  },
);

developmentStudyRouter.get(
  "/ranges/:rangeId/links",
  withProcessParameterRangeOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const links = await service.getRangeLinksByRange(req.params.rangeId);
      res.json(links);
    } catch {
      res.status(500).json({ error: "Failed to fetch range links" });
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/range-links",
  withDesignedExperimentOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const links = await service.getRangeLinksByExperiment(
        req.params.experimentId,
      );
      res.json(links);
    } catch {
      res.status(500).json({ error: "Failed to fetch experiment range links" });
    }
  },
);

developmentStudyRouter.get(
  "/models/:modelId/range-links",
  withExperimentModelOrgPermissions(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const links = await service.getRangeLinksByModel(req.params.modelId);
      res.json(links);
    } catch {
      res.status(500).json({ error: "Failed to fetch model range links" });
    }
  },
);

export default developmentStudyRouter;
