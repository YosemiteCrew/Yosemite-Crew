import { deleteData, getData, patchData, postData } from '@/app/services/axios';

export type CalendarBlockTargetType = 'STAFF' | 'ROOM';

export type CalendarBlock = {
  id: string;
  organisationId: string;
  targetType: CalendarBlockTargetType;
  targetId: string;
  startAt: string;
  endAt: string;
  reason: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarBlockInput = Pick<
  CalendarBlock,
  'targetType' | 'targetId' | 'startAt' | 'endAt' | 'reason'
>;

const safeId = (value: string, name: string): string => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`Invalid ${name} ID`);
  return value;
};

const collectionPath = (organisationId: string) =>
  `/v1/pms/organisation/${safeId(organisationId, 'organisation')}/calendar-blocks`;

export const fetchCalendarBlocks = async (
  organisationId: string,
  from: Date,
  to: Date
): Promise<CalendarBlock[]> => {
  const response = await getData<CalendarBlock[]>(collectionPath(organisationId), {
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return response.data;
};

export const createCalendarBlock = async (
  organisationId: string,
  input: CalendarBlockInput
): Promise<CalendarBlock> => {
  const response = await postData<CalendarBlock, CalendarBlockInput>(
    collectionPath(organisationId),
    input
  );
  return response.data;
};

export const updateCalendarBlock = async (
  organisationId: string,
  id: string,
  input: CalendarBlockInput
): Promise<CalendarBlock> => {
  const response = await patchData<CalendarBlock, CalendarBlockInput>(
    `${collectionPath(organisationId)}/${safeId(id, 'calendar block')}`,
    input
  );
  return response.data;
};

export const deleteCalendarBlock = async (organisationId: string, id: string): Promise<void> => {
  await deleteData<void>(`${collectionPath(organisationId)}/${safeId(id, 'calendar block')}`);
};
