export type IntegrationProvider = 'IDEXX';

export type IntegrationStatus = 'enabled' | 'disabled' | 'error' | 'pending';

export type OrgIntegration = {
  _id: string;
  organisationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
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
  companionId: string;
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

export type LabOrder = {
  _id: string;
  organisationId: string;
  provider: string;
  companionId: string;
  parentId?: string | null;
  appointmentId?: string | null;
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
  companionId: string;
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
    updatedDate?: string;
  };
};
