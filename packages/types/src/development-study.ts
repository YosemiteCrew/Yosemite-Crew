export enum DevelopmentStudyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum ExperimentDesignType {
  FULL_FACTORIAL = 'FULL_FACTORIAL',
  FRACTIONAL_FACTORIAL = 'FRACTIONAL_FACTORIAL',
  SCREENING = 'SCREENING',
  CENTRAL_COMPOSITE = 'CENTRAL_COMPOSITE',
  BOX_BEHNKEN = 'BOX_BEHNKEN',
  RESPONSE_SURFACE = 'RESPONSE_SURFACE',
}

export enum FactorType {
  CONTINUOUS = 'CONTINUOUS',
  CATEGORICAL = 'CATEGORICAL',
  BLOCK = 'BLOCK',
  MIXTURE = 'MIXTURE',
}

export enum FactorRole {
  INPUT = 'INPUT',
  CONSTANT = 'CONSTANT',
  RESPONSE = 'RESPONSE',
}

export enum ExperimentStatus {
  DESIGNED = 'DESIGNED',
  RUN_ORDER_LOCKED = 'RUN_ORDER_LOCKED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ANALYZED = 'ANALYZED',
  ARCHIVED = 'ARCHIVED',
}

export enum RunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  DEVIATED = 'DEVIATED',
  SKIPPED = 'SKIPPED',
}

export enum ModelType {
  LINEAR = 'LINEAR',
  INTERACTION = 'INTERACTION',
  QUADRATIC = 'QUADRATIC',
  CUSTOM = 'CUSTOM',
}

export enum ModelFitStatus {
  FITTED = 'FITTED',
  REFINED = 'REFINED',
  STALE = 'STALE',
}

export enum PlotType {
  PARETO = 'PARETO',
  HALF_NORMAL = 'HALF_NORMAL',
  INTERACTION = 'INTERACTION',
  CONTOUR = 'CONTOUR',
  SURFACE = 'SURFACE',
  PREDICTED_OPERATING_REGION = 'PREDICTED_OPERATING_REGION',
  RESIDUALS = 'RESIDUALS',
  ANOVA = 'ANOVA',
}

export interface ExperimentFactor {
  id: string;
  experimentId: string;
  name: string;
  displayName?: string;
  type: FactorType;
  role: FactorRole;
  unit?: string;
  lowLevel?: number;
  highLevel?: number;
  levels?: unknown;
  goal?: string;
  isConstant: boolean;
  constantValue?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentResponse {
  id: string;
  experimentId: string;
  name: string;
  displayName?: string;
  unit?: string;
  goal?: string;
  target?: number;
  lowerSpec?: number;
  upperSpec?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  runNumber: number;
  standardOrder?: number;
  blockNumber?: number;
  status: RunStatus;
  seed?: string;
  deviationNotes?: string;
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
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
  value?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignedExperiment {
  id: string;
  studyId: string;
  name: string;
  description?: string;
  designType: ExperimentDesignType;
  resolution?: number;
  aliases?: unknown;
  centrePoints: number;
  blocks: number;
  replicates: number;
  randomSeed?: string;
  runOrderLocked: boolean;
  runOrderLockedAt?: Date;
  runOrderLockedBy?: string;
  status: ExperimentStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevelopmentStudy {
  id: string;
  organisationId: string;
  productName: string;
  productCode?: string;
  description?: string;
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
  rSquared?: number;
  rSquaredAdjusted?: number;
  rSquaredPredicted?: number;
  pValue?: number;
  status: ModelFitStatus;
  fittedAt: Date;
  fittedBy: string;
  environmentHash?: string;
  environmentSnapshot?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentPlot {
  id: string;
  experimentId: string;
  modelId?: string;
  type: PlotType;
  title: string;
  config: unknown;
  imageData?: Buffer;
  pdfData?: Buffer;
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
  unit?: string;
  confidenceLevel?: number;
  evidenceType?: string;
  isStale: boolean;
  staleReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessParameterRangeLink {
  id: string;
  rangeId: string;
  experimentId: string;
  modelId?: string;
  linkType: string;
  linkedAt: Date;
  linkedBy: string;
  isStale: boolean;
  staledAt?: Date;
  staledBy?: string;
  staleReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
