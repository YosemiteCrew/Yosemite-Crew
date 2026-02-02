import apiClient from '../../../../src/shared/services/apiClient';
import { getFreshStoredTokens, isTokenExpired } from '../../../../src/features/auth/sessionManager';
import { resolveObservationToolIdSync } from '../../../../src/features/observationalTools/services/observationToolService';
import { buildCdnUrlFromKey } from '../../../../src/shared/utils/cdnHelpers';
import {
  taskApi,
  mapApiTaskToTask,
  buildTaskDraftFromForm
} from '../../../../src/features/tasks/services/taskService';
// We use 'as any' for the mock data to avoid importing every single strict type dependency
import type { TaskFormData } from '../../../../src/features/tasks/types';

// --- Mocks ---
jest.mock('../../../../src/shared/services/apiClient');
jest.mock('../../../../src/features/auth/sessionManager');
jest.mock('../../../../src/features/observationalTools/services/observationToolService');
jest.mock('../../../../src/shared/utils/cdnHelpers');

describe('taskService', () => {
  const mockAccessToken = 'mock-access-token';
  const mockUserId = 'mock-user-id';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock Implementations
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
      userId: mockUserId,
      expiresAt: Date.now() + 10000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
    (resolveObservationToolIdSync as jest.Mock).mockImplementation((id) => id);
    (buildCdnUrlFromKey as jest.Mock).mockImplementation((key) => key ? `https://cdn.com/${key}` : null);
  });

  // =========================================================================
  // Section 1: Helper Functions & Auth Logic
  // =========================================================================
  describe('Internal Helpers (via public interface side-effects)', () => {

    describe('ensureAccessToken', () => {
      it('throws error if access token is missing', async () => {
        (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: null });
        await expect(taskApi.list()).rejects.toThrow('Missing access token');
      });

      it('throws error if token is expired', async () => {
        (isTokenExpired as jest.Mock).mockReturnValue(true);
        await expect(taskApi.list()).rejects.toThrow('Your session expired');
      });
    });

    describe('resolveDateParts (implicitly tested via mapApiTaskToTask)', () => {
      it('handles null/undefined dueAt dates by defaulting to today', () => {
        const result = mapApiTaskToTask({ dueAt: null });
        expect(result.date).toBeDefined(); // Should be today
        expect(result.time).toBeUndefined();
      });

      it('handles invalid date strings by defaulting to today', () => {
        const result = mapApiTaskToTask({ dueAt: 'invalid-date-string' });
        expect(result.date).toBeDefined();
        expect(result.time).toBeUndefined();
      });

      it('parses valid ISO date strings', () => {
        const result = mapApiTaskToTask({ dueAt: '2025-10-20T14:30:00.000Z' });
        expect(result.date).toBe('2025-10-20');
        expect(result.time).toBeDefined();
      });
    });

    describe('Attachment Normalization', () => {
      it('normalizes attachment with key', () => {
        const apiData = {
          attachments: [{ key: 'file.jpg', size: 1024 }]
        };
        const task = mapApiTaskToTask(apiData);
        expect(task.attachments[0].id).toBe('file.jpg');
        expect(task.attachments[0].type).toBe('image/jpeg'); // Guessed from name
      });

      it('normalizes attachment with nested id path', () => {
        const apiData = {
          attachments: [{ id: 'folder/doc.pdf' }]
        };
        const task = mapApiTaskToTask(apiData);
        expect(task.attachments[0].key).toBe('folder/doc.pdf');
        expect(task.attachments[0].type).toBe('application/pdf');
      });

      it('fallbacks to _id or name if key missing', () => {
        const apiData = {
          attachments: [
            { _id: '123', fileName: 'test.docx' },
            { name: 'just-name.png' }
          ]
        };
        const task = mapApiTaskToTask(apiData);
        expect(task.attachments[0].id).toBe('123');
        expect(task.attachments[0].type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        expect(task.attachments[1].id).toBe('just-name.png');
      });

      it('uses provided viewUrl/downloadUrl or falls back to uri/cdn', () => {
        const apiData = {
          attachments: [
            { key: 'abc', viewUrl: 'http://view', downloadUrl: 'http://dl' },
            { uri: 'http://uri' } // no key
          ]
        };
        const task = mapApiTaskToTask(apiData);
        expect(task.attachments[0].viewUrl).toBe('http://view');
        expect(task.attachments[1].uri).toBe('http://uri');
      });
    });
  });

  // =========================================================================
  // Section 2: Map API Task To Task (Frontend Model)
  // =========================================================================
  describe('mapApiTaskToTask', () => {
    it('maps basic fields correctly', () => {
      const apiTask = {
        _id: 'task-1',
        name: 'Simple Task',
        description: 'Desc',
        category: 'CUSTOM',
        status: 'COMPLETED',
        syncWithCalendar: true,
        calendarProvider: 'GOOGLE',
      };
      const result = mapApiTaskToTask(apiTask);
      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Simple Task');
      expect(result.category).toBe('custom');
      expect(result.status).toBe('COMPLETED');
      expect(result.syncWithCalendar).toBe(true);
      expect(result.calendarProvider).toBe('GOOGLE');
    });

    it('maps Categories correctly', () => {
      expect(mapApiTaskToTask({ category: 'HYGIENE' }).category).toBe('hygiene');
      expect(mapApiTaskToTask({ category: 'DIET' }).category).toBe('dietary');
      expect(mapApiTaskToTask({ category: 'MEDICATION' }).category).toBe('health');
      expect(mapApiTaskToTask({ category: 'OBSERVATION_TOOL' }).category).toBe('health');
      expect(mapApiTaskToTask({ category: 'UNKNOWN' }).category).toBe('custom');
    });

    it('maps Recurrence correctly', () => {
      expect(mapApiTaskToTask({ recurrence: { type: 'DAILY' } }).frequency).toBe('daily');
      expect(mapApiTaskToTask({ recurrence: { type: 'WEEKLY' } }).frequency).toBe('weekly');
      expect(mapApiTaskToTask({ recurrence: { type: 'CUSTOM' } }).frequency).toBe('daily');
      expect(mapApiTaskToTask({ recurrence: null }).frequency).toBe('once');
    });

    it('maps Reminders correctly', () => {
      expect(mapApiTaskToTask({ reminder: { offsetMinutes: 5 } }).reminderOptions).toBe('5-mins-prior');
      expect(mapApiTaskToTask({ reminder: { offsetMinutes: 1440 } }).reminderOptions).toBe('1-day-prior');
      expect(mapApiTaskToTask({ reminder: { offsetMinutes: 999 } }).reminderOptions).toBeNull(); // invalid mapping
      expect(mapApiTaskToTask({ reminder: null }).reminderOptions).toBeNull();
    });

    // --- Complex Logic: Medication ---
    describe('Medication Mapping', () => {
      it('maps simple medication without doses', () => {
        const apiTask = {
          category: 'MEDICATION',
          dueAt: '2025-01-01T10:00:00Z',
          medication: { name: 'Aspirin', dosage: '1 pill' }
        };
        const result = mapApiTaskToTask(apiTask);
        expect(result.details.taskType).toBe('give-medication');
        expect(result.details.medicineName).toBe('Aspirin');
        // Fallback dose creation
        expect(result.details.dosages).toHaveLength(1);
        expect(result.details.dosages?.[0].label).toBe('1 pill');
      });

      it('maps medication with explicit doses array', () => {
        const apiTask = {
          category: 'MEDICATION',
          medication: {
            name: 'Meds',
            doses: [
              { id: 'd1', dosage: '10mg', time: '08:00' },
              { id: 'd2', label: '20mg', time: '2025-01-01T20:00:00Z' }
            ]
          }
        };
        const result = mapApiTaskToTask(apiTask);
        expect(result.details.dosages).toHaveLength(2);
        expect(result.details.dosages?.[0].time).toBe('08:00');
        // Should format ISO time to HH:mm
        expect(result.details.dosages?.[1].time).toMatch(/^\d{2}:\d{2}$/);
      });

      it('handles End Date mapping in medication details', () => {
        // Valid end date
        const apiTaskValid = {
          category: 'MEDICATION',
          recurrence: { endDate: '2025-12-31T00:00:00Z' }
        };
        const resValid = mapApiTaskToTask(apiTaskValid);
        expect(resValid.details.endDate).toContain('2025-12-31');

        // Invalid end date
        const apiTaskInvalid = {
          category: 'MEDICATION',
          recurrence: { endDate: 'invalid-date' }
        };
        const resInvalid = mapApiTaskToTask(apiTaskInvalid);
        expect(resInvalid.details.endDate).toBeUndefined();
      });
    });

    // --- Complex Logic: Observation Tools ---
    describe('Observation Tool Mapping', () => {
      it('maps observation tool task', () => {
        const apiTask = {
          category: 'OBSERVATION_TOOL',
          observationToolId: 'tool-xyz',
          chronicConditionType: 'Diabetes'
        };
        const result = mapApiTaskToTask(apiTask);
        expect(result.details.taskType).toBe('take-observational-tool');
        expect(result.details.toolType).toBe('tool-xyz');
        expect(result.details.chronicConditionType).toBe('Diabetes');
      });
    });
  });

  // =========================================================================
  // Section 3: Build Task Draft From Form (Frontend -> Backend)
  // =========================================================================
  describe('buildTaskDraftFromForm', () => {
    // Cast partial object to TaskFormData to satisfy TS strict checks
    const baseForm = {
      title: 'Form Task',
      date: new Date('2025-05-05T00:00:00'),
      time: new Date('2025-05-05T14:00:00'),
      reminderEnabled: false,
      frequency: 'once',
      category: 'custom',
    } as unknown as TaskFormData;

    it('builds basic task payload', () => {
      const payload = buildTaskDraftFromForm({
        formData: baseForm,
        companionId: 'comp-123'
      });

      expect(payload.companionId).toBe('comp-123');
      expect(payload.name).toBe('Form Task');
      expect(payload.dueAt).toContain('2025-05-05');
      expect(payload.recurrence?.type).toBe('ONCE');
      expect(payload.reminder).toBeNull();
    });

    it('maps Reminder options correctly', () => {
      const form = {
        ...baseForm,
        reminderEnabled: true,
        reminderOptions: '30-mins-prior'
      } as unknown as TaskFormData;

      const payload = buildTaskDraftFromForm({ formData: form, companionId: 'c1' });
      expect(payload.reminder?.enabled).toBe(true);
      expect(payload.reminder?.offsetMinutes).toBe(30);
    });

    it('defaults reminder to 30 mins if enabled but option is invalid/missing', () => {
      const form = { ...baseForm, reminderEnabled: true, reminderOptions: undefined } as unknown as TaskFormData;
      const payload = buildTaskDraftFromForm({ formData: form, companionId: 'c1' });
      expect(payload.reminder?.offsetMinutes).toBe(30);
    });

    it('maps Medication Payload (Health Type)', () => {
      const form = {
        ...baseForm,
        healthTaskType: 'give-medication',
        medicineName: 'Advil',
        medicineType: 'Pill' as any, // Cast specific enum/string if needed
        medicationFrequency: 'daily',
        dosages: [{ id: 'dose-1', label: '10mg', time: '09:00' }] // Added ID to satisfy DosagesSchedule
      } as unknown as TaskFormData;

      const payload = buildTaskDraftFromForm({ formData: form, companionId: 'c1' });

      expect(payload.category).toBe('MEDICATION');
      expect(payload.medication?.name).toBe('Advil');
      // Use 'as any' because 'doses' might not be on the strict TaskDraftPayload interface
      // but logic populates it
      expect((payload.medication as any)?.doses?.[0].time).toBe('09:00');
      // Medication frequency overrides general frequency
      expect(payload.medication?.frequency).toBe('DAILY');
    });

    it('maps Observation Tool Payload', () => {
      const form = {
        ...baseForm,
        healthTaskType: 'take-observational-tool',
        observationalTool: 'tool-id-1'
      } as unknown as TaskFormData;

      const payload = buildTaskDraftFromForm({
        formData: form,
        companionId: 'c1',
        observationToolId: 'tool-id-1' // Pass explicitly or via form
      });

      expect(payload.category).toBe('OBSERVATION_TOOL');
      expect(payload.observationToolId).toBe('tool-id-1');
    });

    it('maps Recurrence Frequencies', () => {
      const checkFreq = (freq: any, expected: string) => {
        const p = buildTaskDraftFromForm({
          formData: { ...baseForm, frequency: freq } as unknown as TaskFormData,
          companionId: 'c1'
        });
        expect(p.recurrence?.type).toBe(expected);
      };

      checkFreq('daily', 'DAILY');
      checkFreq('weekly', 'WEEKLY');
      checkFreq('monthly', 'WEEKLY'); // Falls back to WEEKLY per code logic
      checkFreq('once', 'ONCE');
    });

    it('handles attachments in form data', () => {
      const form = {
        ...baseForm,
        attachments: [{ uri: 'file://img.jpg', name: 'img.jpg' }]
      } as unknown as TaskFormData;

      const payload = buildTaskDraftFromForm({ formData: form, companionId: 'c1' });
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments?.[0].name).toBe('img.jpg');
    });
  });

  // =========================================================================
  // Section 4: API Methods
  // =========================================================================
  describe('taskApi', () => {
    it('list() fetches tasks with correct params', async () => {
      const mockResponse = { data: [{ _id: '1' }, { _id: '2' }] };
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const res = await taskApi.list({ companionId: 'c1', status: ['PENDING'] });

      expect(apiClient.get).toHaveBeenCalledWith('/v1/task/mobile/task', expect.objectContaining({
        params: { companionId: 'c1', status: 'PENDING' },
        headers: expect.objectContaining({ 'x-user-id': mockUserId })
      }));
      expect(res).toHaveLength(2);
    });

    it('list() handles empty response safely', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null }); // Non-array response
      const res = await taskApi.list();
      expect(res).toEqual([]);
    });

    it('get() fetches single task', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { _id: 't1' } });
      const res = await taskApi.get('t1');
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/t1'), expect.anything());
      expect(res.id).toBe('t1');
    });

    it('create() posts new task', async () => {
      const payload: any = { name: 'New' };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { _id: 'new-1' } });
      const res = await taskApi.create(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/v1/task/mobile/', payload, expect.anything());
      expect(res.id).toBe('new-1');
    });

    it('update() patches existing task', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: { _id: 'u1' } });
      const res = await taskApi.update('u1', { name: 'Updated' });
      expect(apiClient.patch).toHaveBeenCalledWith(expect.stringContaining('/u1'), { name: 'Updated' }, expect.anything());
      expect(res.id).toBe('u1');
    });

    it('changeStatus() posts status change with completion', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { task: { _id: 's1', status: 'COMPLETED' } } });
      const completionData = { note: 'Done' };

      const res = await taskApi.changeStatus('s1', 'COMPLETED', completionData);

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/s1/status'),
        { status: 'COMPLETED', completion: completionData },
        expect.anything()
      );
      expect(res.status).toBe('COMPLETED');
    });

    it('changeStatus() handles simple status change without completion object', async () => {
      // Sometimes backend might return the task directly instead of { task: ... }
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { _id: 's1', status: 'IN_PROGRESS' } });

      const res = await taskApi.changeStatus('s1', 'IN_PROGRESS');

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/s1/status'),
        { status: 'IN_PROGRESS' },
        expect.anything()
      );
      expect(res.status).toBe('IN_PROGRESS');
    });
  });
});