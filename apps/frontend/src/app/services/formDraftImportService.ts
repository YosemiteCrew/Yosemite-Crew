import { getData, postData, deleteData } from '@/app/services/axios';
import type { FieldOption, FieldType } from '@yosemite-crew/types';

export interface DraftImportField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: FieldOption[];
  sourceLine: number;
}

export interface DraftImportUnsupportedConstruct {
  line: number;
  raw: string;
  reason: string;
}

export type DraftImportFieldChange = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DraftImportFieldSnapshot {
  type: string;
  label: string;
  required: boolean;
}

export interface DraftImportFieldDiffEntry {
  id: string;
  change: DraftImportFieldChange;
  before?: DraftImportFieldSnapshot;
  after?: DraftImportFieldSnapshot;
}

export interface DraftImportView {
  id: string;
  organisationId: string;
  sourceFormId: string | null;
  draftFormId: string;
  suppliedText: string;
  fields: DraftImportField[];
  unsupportedConstructs: DraftImportUnsupportedConstruct[];
  diff: DraftImportFieldDiffEntry[];
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftImportPayload {
  suppliedText: string;
  sourceFormId?: string;
}

const BASE = '/v1/form-draft-imports';

export const createDraftImport = async (
  organisationId: string,
  payload: CreateDraftImportPayload
): Promise<DraftImportView> => {
  const res = await postData<{ data: DraftImportView }, CreateDraftImportPayload>(
    `${BASE}/${organisationId}`,
    payload
  );
  return res.data.data;
};

export const getDraftImport = async (
  organisationId: string,
  id: string
): Promise<DraftImportView> => {
  const res = await getData<{ data: DraftImportView }>(`${BASE}/${organisationId}/${id}`);
  return res.data.data;
};

export const discardDraftImport = async (organisationId: string, id: string): Promise<void> => {
  await deleteData(`${BASE}/${organisationId}/${id}`);
};
