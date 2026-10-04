export const DevelopmentStudyStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type DevelopmentStudyStatus =
  (typeof DevelopmentStudyStatus)[keyof typeof DevelopmentStudyStatus];

export const ExperimentDesignType = {
  FULL_FACTORIAL: 'FULL_FACTORIAL',
  FRACTIONAL_FACTORIAL: 'FRACTIONAL_FACTORIAL',
  SCREENING: 'SCREENING',
  CENTRAL_COMPOSITE: 'CENTRAL_COMPOSITE',
  BOX_BEHNKEN: 'BOX_BEHNKEN',
  RESPONSE_SURFACE: 'RESPONSE_SURFACE',
} as const;
export type ExperimentDesignType = (typeof ExperimentDesignType)[keyof typeof ExperimentDesignType];

export const FactorType = {
  CONTINUOUS: 'CONTINUOUS',
  CATEGORICAL: 'CATEGORICAL',
  BLOCK: 'BLOCK',
  MIXTURE: 'MIXTURE',
} as const;
export type FactorType = (typeof FactorType)[keyof typeof FactorType];

export const FactorRole = {
  INPUT: 'INPUT',
  CONSTANT: 'CONSTANT',
  RESPONSE: 'RESPONSE',
} as const;
export type FactorRole = (typeof FactorRole)[keyof typeof FactorRole];

export const ExperimentStatus = {
  DESIGNED: 'DESIGNED',
  RUN_ORDER_LOCKED: 'RUN_ORDER_LOCKED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ANALYZED: 'ANALYZED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ExperimentStatus = (typeof ExperimentStatus)[keyof typeof ExperimentStatus];

export const RunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  DEVIATED: 'DEVIATED',
  SKIPPED: 'SKIPPED',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const ModelType = {
  LINEAR: 'LINEAR',
  INTERACTION: 'INTERACTION',
  QUADRATIC: 'QUADRATIC',
  CUSTOM: 'CUSTOM',
} as const;
export type ModelType = (typeof ModelType)[keyof typeof ModelType];

export const ModelFitStatus = {
  FITTED: 'FITTED',
  REFINED: 'REFINED',
  STALE: 'STALE',
} as const;
export type ModelFitStatus = (typeof ModelFitStatus)[keyof typeof ModelFitStatus];

export const PlotType = {
  PARETO: 'PARETO',
  HALF_NORMAL: 'HALF_NORMAL',
  INTERACTION: 'INTERACTION',
  CONTOUR: 'CONTOUR',
  SURFACE: 'SURFACE',
  PREDICTED_OPERATING_REGION: 'PREDICTED_OPERATING_REGION',
  RESIDUALS: 'RESIDUALS',
  ANOVA: 'ANOVA',
} as const;
export type PlotType = (typeof PlotType)[keyof typeof PlotType];

export interface ExperimentFactor {
  id: string;
  experimentId: string;
  name: string;
  displayName?: string | null;
  type: FactorType;
  role: FactorRole;
  unit?: string | null;
  lowLevel?: number | null;
  highLevel?: number | null;
  levels?: unknown;
  goal?: string | null;
  isConstant: boolean;
  constantValue?: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentResponse {
  id: string;
  experimentId: string;
  name: string;
  displayName?: string | null;
  unit?: string | null;
  goal?: string | null;
  target?: number | null;
  lowerSpec?: number | null;
  upperSpec?: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  runNumber: number;
  standardOrder?: number | null;
  blockNumber?: number | null;
  status: RunStatus;
  seed?: string | null;
  deviationNotes?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  completedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentRunFactorValue {
  id: string;
  runId: string;
  factorId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentRunResponseValue {
  id: string;
  runId: string;
  responseId: string;
  value?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignedExperiment {
  id: string;
  studyId: string;
  name: string;
  description?: string | null;
  designType: ExperimentDesignType;
  resolution?: number | null;
  aliases?: unknown;
  centrePoints: number;
  blocks: number;
  replicates: number;
  randomSeed?: string | null;
  runOrderLocked: boolean;
  runOrderLockedAt?: Date | null;
  runOrderLockedBy?: string | null;
  status: ExperimentStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevelopmentStudy {
  id: string;
  organisationId: string;
  productName: string;
  productCode?: string | null;
  description?: string | null;
  status: DevelopmentStudyStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentModel {
  id: string;
  experimentId: string;
  name: string;
  type: ModelType;
  formula: string;
  terms: unknown;
  anovaTable?: unknown;
  lackOfFit?: unknown;
  estimates?: unknown;
  residuals?: unknown;
  rSquared?: number | null;
  rSquaredAdjusted?: number | null;
  rSquaredPredicted?: number | null;
  pValue?: number | null;
  status: ModelFitStatus;
  fittedAt: Date;
  fittedBy: string;
  environmentHash?: string | null;
  environmentSnapshot?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentPlot {
  id: string;
  experimentId: string;
  modelId?: string | null;
  type: PlotType;
  title: string;
  config: unknown;
  imageData?: Uint8Array<ArrayBuffer> | null;
  pdfData?: Uint8Array<ArrayBuffer> | null;
  spreadsheetData?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessParameterRange {
  id: string;
  studyId: string;
  parameterName: string;
  lowerBound: number;
  upperBound: number;
  unit?: string | null;
  confidenceLevel?: number | null;
  evidenceType?: string | null;
  isStale: boolean;
  staleReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessParameterRangeLink {
  id: string;
  rangeId: string;
  experimentId: string;
  modelId?: string | null;
  linkType: string;
  linkedAt: Date;
  linkedBy: string;
  isStale: boolean;
  staledAt?: Date | null;
  staledBy?: string | null;
  staleReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
