'use strict';

export interface PmpSubmission {
  id: string;
  state: string;
  timestamp: number;
  deaNumber: string;
  prescriberNpi: string;
  prescriptionId: string;
  patientIdentifier: string;
  drugName: string;
  drugClass: string;
  quantity: number;
  daysSupply: number;
  refills: number;
  status: 'pending' | 'submitted' | 'failed';
  submittedAt?: number;
  error?: string;
}

export interface PmpBatch {
  id: string;
  state: string;
  timestamp: number;
  submissions: PmpSubmission[];
  filePath?: string;
}

export interface PmpSubmissionService {
  addSubmission: (sub: Omit<PmpSubmission, 'id' | 'timestamp' | 'status'>) => PmpSubmission;
  getPending: () => PmpSubmission[];
  getSubmitted: () => PmpSubmission[];
  getFailed: () => PmpSubmission[];
  markSubmitted: (id: string) => boolean;
  markFailed: (id: string, error: string) => boolean;
  generateBatchFile: (submissions: PmpSubmission[], state: string) => string;
  getAll: () => PmpSubmission[];
}

interface PmpDeps {
  now?: () => number;
  generateId?: () => string;
}

let pmpCounter = 0;
const defaultId = (): string => `pmp-${Date.now()}-${++pmpCounter}`;

const PMP_HEADER =
  'State,DEANumber,NPI,PrescriptionID,PatientID,DrugName,DrugClass,Quantity,DaysSupply,Refills';

export const createPmpSubmissionService = (deps: PmpDeps = {}): PmpSubmissionService => {
  const now = deps.now || (() => Date.now());
  const generateId = deps.generateId || defaultId;

  const submissions: PmpSubmission[] = [];

  const addSubmission = (
    input: Omit<PmpSubmission, 'id' | 'timestamp' | 'status'>
  ): PmpSubmission => {
    const sub: PmpSubmission = {
      ...input,
      id: generateId(),
      timestamp: now(),
      status: 'pending',
    };
    submissions.push(sub);
    return sub;
  };

  const getPending = (): PmpSubmission[] => submissions.filter((s) => s.status === 'pending');

  const getSubmitted = (): PmpSubmission[] => submissions.filter((s) => s.status === 'submitted');

  const getFailed = (): PmpSubmission[] => submissions.filter((s) => s.status === 'failed');

  const markSubmitted = (id: string): boolean => {
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return false;
    sub.status = 'submitted';
    sub.submittedAt = now();
    return true;
  };

  const markFailed = (id: string, error: string): boolean => {
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return false;
    sub.status = 'failed';
    sub.error = error;
    return true;
  };

  const generateBatchFile = (subs: PmpSubmission[], state: string): string => {
    const lines = [PMP_HEADER];
    for (const sub of subs) {
      lines.push(
        [
          state,
          sub.deaNumber,
          sub.prescriberNpi,
          sub.prescriptionId,
          sub.patientIdentifier,
          sub.drugName,
          sub.drugClass,
          sub.quantity,
          sub.daysSupply,
          sub.refills,
        ].join(',')
      );
    }
    return lines.join('\n');
  };

  const getAll = (): PmpSubmission[] => [...submissions];

  return {
    addSubmission,
    getPending,
    getSubmitted,
    getFailed,
    markSubmitted,
    markFailed,
    generateBatchFile,
    getAll,
  };
};
