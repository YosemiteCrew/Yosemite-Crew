import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';

export type MobileCareReminder = {
  id: string;
  patientId: string;
  patientName: string;
  organisationId: string;
  reminderType:
    | 'VACCINATION_BOOSTER'
    | 'ANNUAL_CHECKUP'
    | 'PARASITE_TREATMENT'
    | 'DENTAL_CLEANING'
    | 'FOLLOW_UP'
    | 'CUSTOM';
  message: string;
  dueDate: string;
  overdue: boolean;
  status: 'PENDING' | 'SENT';
  sentAt?: string;
};

type CareReminderPage = {
  reminders?: MobileCareReminder[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

const ENDPOINT = '/v1/care-reminders/mobile/due';
const PAGE_SIZE = 100;
export const MAX_CARE_REMINDER_PAGES = 50;

export const careReminderApi = {
  /** Reads every page so the selected companion's reminders cannot be hidden by pagination. */
  async list(accessToken: string): Promise<MobileCareReminder[]> {
    const reminders: MobileCareReminder[] = [];
    let cursor: string | undefined;
    for (
      let pagesFetched = 0;
      pagesFetched < MAX_CARE_REMINDER_PAGES;
      pagesFetched += 1
    ) {
      const {data} = await apiClient.get<CareReminderPage>(ENDPOINT, {
        params: {limit: PAGE_SIZE, cursor},
        headers: withAuthHeaders(accessToken),
      });
      reminders.push(...(data.reminders ?? []));
      if (!data.hasMore) return reminders;
      if (!data.nextCursor || data.nextCursor === cursor) {
        throw new Error('Care reminder pagination did not advance');
      }
      cursor = data.nextCursor;
    }
    throw new Error('Care reminder pagination exceeded the page limit');
  },
};
