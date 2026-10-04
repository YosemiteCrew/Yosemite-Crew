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

const developmentStudyRouter = Router();
const service = new DevelopmentStudyService();

developmentStudyRouter.use(requireWebAuth);

developmentStudyRouter.post(
  "/studies",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        organisationId: z.string().uuid(),
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to create study" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/studies",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { organisationId } = req.query;
      if (!organisationId || typeof organisationId !== "string") {
        res.status(400).json({ error: "organisationId is required" });
        return;
      }
      const studies = await service.getStudiesByOrganisation(organisationId);
      res.json(studies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  },
);

developmentStudyRouter.get(
  "/studies/:studyId",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const study = await service.getStudyById(req.params.studyId);
      if (!study) {
        res.status(404).json({ error: "Study not found" });
        return;
      }
      res.json(study);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch study" });
    }
  },
);

developmentStudyRouter.patch(
  "/studies/:studyId/status",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.nativeEnum(DevelopmentStudyStatus),
      });
      const { status } = schema.parse(req.body);
      const study = await service.updateStudyStatus(req.params.studyId, status);
      res.json(study);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to update study status" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/studies/:studyId/experiments",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        designType: z.nativeEnum(ExperimentDesignType),
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to create experiment" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId",
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
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch experiment" });
    }
  },
);

developmentStudyRouter.get(
  "/studies/:studyId/experiments",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const experiments = await service.getExperimentsByStudy(
        req.params.studyId,
      );
      res.json(experiments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch experiments" });
    }
  },
);

developmentStudyRouter.patch(
  "/experiments/:experimentId/status",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.nativeEnum(ExperimentStatus),
      });
      const { status } = schema.parse(req.body);
      const experiment = await service.updateExperimentStatus(
        req.params.experimentId,
        status,
      );
      res.json(experiment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to update experiment status" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/factors",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        displayName: z.string().optional(),
        type: z.nativeEnum(FactorType),
        role: z.nativeEnum(FactorRole).optional(),
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to add factor" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/responses",
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to add response" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/lock-run-order",
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
        res.status(400).json({ errors: error.flatten().fieldErrors });
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to create run" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/runs",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const runs = await service.getRunsByExperiment(req.params.experimentId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch runs" });
    }
  },
);

developmentStudyRouter.patch(
  "/runs/:runId/status",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.nativeEnum(RunStatus),
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to update run status" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/runs/:runId/factor-values",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        factorId: z.string().uuid(),
        value: z.number(),
      });
      const input = schema.parse(req.body);
      const value = await service.setRunFactorValue({
        runId: req.params.runId,
        ...input,
      });
      res.json(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to set factor value" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/runs/:runId/response-values",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        responseId: z.string().uuid(),
        value: z.number(),
      });
      const input = schema.parse(req.body);
      const value = await service.setRunResponseValue({
        runId: req.params.runId,
        ...input,
      });
      res.json(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to set response value" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/models",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        type: z.nativeEnum(ModelType),
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to fit model" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/models",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const models = await service.getModelsByExperiment(
        req.params.experimentId,
      );
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch models" });
    }
  },
);

developmentStudyRouter.patch(
  "/models/:modelId/status",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        status: z.nativeEnum(ModelFitStatus),
      });
      const { status } = schema.parse(req.body);
      const model = await service.updateModelStatus(req.params.modelId, status);
      res.json(model);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to update model status" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/experiments/:experimentId/plots",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        modelId: z.string().uuid().optional(),
        type: z.nativeEnum(PlotType),
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
          ? Buffer.from(input.imageData, "base64")
          : undefined,
        pdfData: input.pdfData
          ? Buffer.from(input.pdfData, "base64")
          : undefined,
        spreadsheetData: input.spreadsheetData,
      });
      res.status(201).json(plot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to create plot" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/plots",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plots = await service.getPlotsByExperiment(req.params.experimentId);
      res.json(plots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch plots" });
    }
  },
);

developmentStudyRouter.post(
  "/studies/:studyId/ranges",
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to create parameter range" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/studies/:studyId/ranges",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ranges = await service.getParameterRangesByStudy(
        req.params.studyId,
      );
      res.json(ranges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parameter ranges" });
    }
  },
);

developmentStudyRouter.post(
  "/ranges/:rangeId/links",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schema = z.object({
        experimentId: z.string().uuid(),
        modelId: z.string().uuid().optional(),
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to link range to experiment" });
      }
    }
  },
);

developmentStudyRouter.post(
  "/range-links/:linkId/stale",
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ error: "Failed to mark range stale" });
      }
    }
  },
);

developmentStudyRouter.get(
  "/ranges/:rangeId/links",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const links = await service.getRangeLinksByRange(req.params.rangeId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch range links" });
    }
  },
);

developmentStudyRouter.get(
  "/experiments/:experimentId/range-links",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const links = await service.getRangeLinksByExperiment(
        req.params.experimentId,
      );
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch experiment range links" });
    }
  },
);

developmentStudyRouter.get(
  "/models/:modelId/range-links",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const links = await service.getRangeLinksByModel(req.params.modelId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch model range links" });
    }
  },
);

export default developmentStudyRouter;
