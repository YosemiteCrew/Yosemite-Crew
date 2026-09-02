export type IntegrationProvider = 'IDEXX' | 'MERCK_MANUALS';

export type IntegrationStatus = 'enabled' | 'disabled' | 'error' | 'pending';

export type OrgIntegration = {
  /** Backend now returns `id`; `_id` retained for backward compatibility with older payloads. */
  id?: string;
  _id?: string;
  organisationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  source?: 'backend';
  credentialsStatus?: 'valid' | 'invalid' | 'missing';
  lastValidatedAt?: string | null;
  enabledAt?: string | null;
  disabledAt?: string | null;
  lastError?: string | null;
  lastSyncAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StoreCredentialsPayload = {
  credentials: {
    username: string;
    password: string;
  };
};

export type ValidateCredentialsResponse = {
  ok: boolean;
};

export type IdexxTest = {
  _id: string;
  code: string;
  display: string;
  type: string;
  meta?: {
    listPrice?: string;
    currencyCode?: string;
    turnaround?: string;
    specimen?: string;
    allowsBatch?: boolean;
    allowsAddOns?: boolean;
    displayCode?: string;
  };
};

export type IdexxTestsResponse = {
  tests: IdexxTest[];
};

export type CreateLabOrderPayload = {
  patientId: string;
  appointmentId?: string;
  tests: string[];
  modality: 'REFERENCE_LAB' | 'INHOUSE' | 'IN_HOUSE';
  prevRefNum?: string;
  veterinarian?: string;
  technician?: string;
  notes?: string;
  specimenCollectionDate?: string;
  ivls?: string[];
};

/**
 * Recorded when the breed sent to the provider is not the companion's recorded
 * breed, because the provider's vocabulary has no counterpart for it.
 *
 * This is a clinical claim about the animal: the requisition that reached the
 * lab says the patient is, for example, a canine catch-all rather than the
 * specific breed on the record. Produced by `resolveIdexxBreedCode` and stored
 * on the order; the shape mirrors `LabBreedSubstitution` in
 * `apps/backend/src/labs/types.ts`.
 */
export type LabBreedSubstitution = {
  requestedBreedCode: string | null;
  usedBreedCode: string;
  usedTargetCode: string;
  reason: 'UNCODED_BREED' | 'UNMAPPED_BREED' | 'MISMATCHED_BREED';
};

export type LabOrder = {
  _id: string;
  organisationId: string;
  provider: string;
  companionId: string;
  parentId?: string | null;
  appointmentId?: string | null;
  patientName?: string | null;
  status: string;
  modality: string;
  idexxOrderId: string;
  uiUrl?: string | null;
  pdfUrl?: string | null;
  tests: string[];
  veterinarian?: string | null;
  technician?: string | null;
  notes?: string | null;
  specimenCollectionDate?: string | null;
  externalStatus?: string | null;
  /** Set only when the transmitted breed differs from the companion's. */
  breedSubstitution?: LabBreedSubstitution | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CensusEntry = {
  id: number;
  patient: {
    patientId: string;
    name: string;
    microchip?: string;
    client?: {
      id?: string;
      firstName?: string;
      lastName?: string;
    };
    speciesCode?: string;
    breedCode?: string;
    genderCode?: string;
    birthdate?: string;
  };
  veterinarian?: string | null;
  added?: string;
  ivls?: Array<{
    serialNumber: string;
    displayName?: string | null;
  }>;
  confirmedBy?: string[];
  confirmed?: boolean;
};

export type AddCensusPayload = {
  patientId: string;
  parentId?: string;
  veterinarian?: string;
  ivls?: string[];
};

export type IvlsDevice = {
  deviceSerialNumber: string;
  displayName: string | null;
  vcpActivatedStatus: string;
  lastPolledCloudTime: string;
};

export type IvlsDevicesResponse = {
  ivlsDeviceList: IvlsDevice[];
};

export type LabResultTest = {
  name: string;
  result: string;
  units?: string;
  referenceRange?: string;
  outOfRange?: boolean;
  outOfRangeCode?: string;
};

export type LabResultCategory = {
  categoryId?: number;
  name: string;
  tests: LabResultTest[];
};

export type LabResult = {
  _id: string;
  provider: string;
  resultId: string;
  orderId?: string;
  requisitionId?: string;
  clientId?: string;
  clientFirstName?: string;
  clientLastName?: string;
  patientId?: string;
  patientName?: string;
  modality?: string;
  status?: string;
  statusDetail?: string | null;
  accessionId?: string;
  createdAt?: string;
  updatedAt?: string;
  rawPayload?: {
    categories?: LabResultCategory[];
    runSummaries?: Array<{ id: string; code: string; name: string }>;
    status?: string;
    statusDetail?: string;
    updatedDate?: string;
  };
};

export type MerckAudience = 'PROV' | 'PAT';
export type MerckLanguage = 'en' | 'es';
export type MerckMediaMode = 'hybrid' | 'print' | 'full';

export type MerckLink = {
  label: string;
  url: string;
};

export type MerckEntry = {
  id: string;
  title: string;
  summaryText: string;
  updatedAt: string | null;
  audience: MerckAudience;
  primaryUrl: string;
  subLinks: MerckLink[];
};

export type MerckSearchMeta = {
  requestId: string;
  source: string;
  updatedAt: string | null;
  audience: MerckAudience;
  language: MerckLanguage;
  totalResults: number;
};

export type MerckSearchResponse = {
  meta: MerckSearchMeta;
  entries: MerckEntry[];
};

export type MerckSearchRequest = {
  organisationId: string;
  query: string;
  audience: MerckAudience;
  language?: MerckLanguage;
  media?: MerckMediaMode;
  code?: string;
  codeSystem?: string;
  displayName?: string;
  originalText?: string;
  subTopicCode?: string;
  subTopicDisplay?: string;
};
