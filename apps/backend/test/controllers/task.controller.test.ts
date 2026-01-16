import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 2 levels to src from test/controllers/
// ----------------------------------------------------------------------
import {
  TaskController,
  TaskLibraryController,
  TaskTemplateController
} from '../../src/controllers/web/task.controller';

import { TaskService, TaskServiceError } from '../../src/services/task.service';
import { TaskLibraryService } from '../../src/services/taskLibrary.service';
import { TaskTemplateService } from '../../src/services/taskTemplate.service';
import { AuthUserMobileService } from '../../src/services/authUserMobile.service';
import logger from '../../src/utils/logger';

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock('../../src/services/task.service');
jest.mock('../../src/services/taskLibrary.service');
jest.mock('../../src/services/taskTemplate.service');
jest.mock('../../src/services/authUserMobile.service');
jest.mock('../../src/utils/logger');

// Retrieve REAL Error class to ensure instanceof checks pass in controller
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { TaskServiceError: RealTaskServiceError } = jest.requireActual('../../src/services/task.service') as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedTaskService = jest.mocked(TaskService);
const mockedTaskLibraryService = jest.mocked(TaskLibraryService);
const mockedTaskTemplateService = jest.mocked(TaskTemplateService);
const mockedAuthService = jest.mocked(AuthUserMobileService);
const mockedLogger = jest.mocked(logger);

describe('Task Controllers', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 4. ERROR HELPERS
  // ----------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockServiceError = (mockFn: jest.Mock, status = 400, msg = 'Service Error') => {
    // Use RealTaskServiceError so "error instanceof TaskServiceError" is true
    const error = new RealTaskServiceError(msg, status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFn as any).mockRejectedValue(error);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockGenericError = (mockFn: jest.Mock) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFn as any).mockRejectedValue(new Error('Boom'));
  };

  /* ========================================================================
   * TASK CONTROLLER
   * ======================================================================*/
  describe('TaskController', () => {

    describe('createCustomTask (Mobile)', () => {
      it('should 403 if parent not found', async () => {
        (req as any).userId = 'u1';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: null });

        await TaskController.createCustomTask(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it('should success (201)', async () => {
        (req as any).userId = 'u1';
        req.body = { title: 'T1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.createCustom as any).mockResolvedValue({ id: 't1' });

        await TaskController.createCustomTask(req as any, res as Response);
        expect(mockedTaskService.createCustom).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'p1' }));
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it('should handle service error', async () => {
        (req as any).userId = 'u1';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });

        mockServiceError(mockedTaskService.createCustom as jest.Mock, 400);

        await TaskController.createCustomTask(req as any, res as Response);
      });
    });

    describe('createCustomTaskFromPms', () => {
      it('should success (201)', async () => {
        (req as any).userId = 'pms1';
        req.body = { title: 'T1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.createCustom as any).mockResolvedValue({});

        await TaskController.createCustomTaskFromPms(req as any, res as Response);
        expect(mockedTaskService.createCustom).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'pms1' }));
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it('should handle error', async () => {
        (req as any).userId = 'pms1';
        mockGenericError(mockedTaskService.createCustom as jest.Mock);
        await TaskController.createCustomTaskFromPms(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('createFromLibrary', () => {
      it('should success (201)', async () => {
        (req as any).userId = 'pms1';
        req.body = { libraryId: 'lib1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.createFromLibrary as any).mockResolvedValue({});

        await TaskController.createFromLibrary(req as any, res as Response);
        expect(mockedTaskService.createFromLibrary).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'pms1' }));
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskService.createFromLibrary as jest.Mock);
        await TaskController.createFromLibrary(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('createFromTemplate', () => {
      it('should success (201)', async () => {
        (req as any).userId = 'pms1';
        req.body = { templateId: 'tmpl1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.createFromTemplate as any).mockResolvedValue({});

        await TaskController.createFromTemplate(req as any, res as Response);
        expect(mockedTaskService.createFromTemplate).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'pms1' }));
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskService.createFromTemplate as jest.Mock);
        await TaskController.createFromTemplate(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('getById', () => {
      it('should 404 if not found', async () => {
        req.params = { taskId: 't1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.getById as any).mockResolvedValue(null);
        await TaskController.getById(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it('should success (200)', async () => {
        req.params = { taskId: 't1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.getById as any).mockResolvedValue({ id: 't1' });
        await TaskController.getById(req as any, res as Response);
        expect(jsonMock).toHaveBeenCalledWith({ id: 't1' });
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskService.getById as jest.Mock);
        await TaskController.getById(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('updateTask', () => {
      it('should 403 if parent not found', async () => {
        (req as any).userId = 'u1';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: null });
        await TaskController.updateTask(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it('should success', async () => {
        (req as any).userId = 'u1';
        req.params = { taskId: 't1' };
        req.body = { title: 'Upd' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.updateTask as any).mockResolvedValue({});

        await TaskController.updateTask(req as any, res as Response);
        expect(mockedTaskService.updateTask).toHaveBeenCalledWith('t1', req.body, 'p1');
      });

      it('should handle error', async () => {
        mockGenericError(mockedAuthService.getByProviderUserId as jest.Mock);
        await TaskController.updateTask(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('changeStatus', () => {
      it('should 403 if parent not found', async () => {
        (req as any).userId = 'u1';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: null });
        await TaskController.changeStatus(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it('should 400 if invalid status', async () => {
        (req as any).userId = 'u1';
        req.params = { taskId: 't1' };
        req.body = { status: 'INVALID' as any };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });

        await TaskController.changeStatus(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should success', async () => {
        (req as any).userId = 'u1';
        req.params = { taskId: 't1' };
        req.body = { status: 'COMPLETED', completion: { notes: 'Done' } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.changeStatus as any).mockResolvedValue({});

        await TaskController.changeStatus(req as any, res as Response);
        expect(mockedTaskService.changeStatus).toHaveBeenCalledWith('t1', 'COMPLETED', 'p1', req.body.completion);
      });

      it('should handle error', async () => {
        mockGenericError(mockedAuthService.getByProviderUserId as jest.Mock);
        await TaskController.changeStatus(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('listParentTasks', () => {
      it('should 403 if parent not found', async () => {
        (req as any).userId = 'u1';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: null });
        await TaskController.listParentTasks(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it('should list with full filters', async () => {
        (req as any).userId = 'u1';
        req.query = {
            companionId: 'c1',
            fromDueAt: '2023-01-01',
            toDueAt: '2023-01-31',
            status: 'PENDING,IN_PROGRESS'
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.listForParent as any).mockResolvedValue([]);

        await TaskController.listParentTasks(req as any, res as Response);
        expect(mockedTaskService.listForParent).toHaveBeenCalledWith({
            parentId: 'p1',
            companionId: 'c1',
            fromDueAt: new Date('2023-01-01'),
            toDueAt: new Date('2023-01-31'),
            status: ['PENDING', 'IN_PROGRESS']
        });
      });

      it('should list with invalid date query (returns undefined)', async () => {
        (req as any).userId = 'u1';
        req.query = { fromDueAt: 'invalid' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.listForParent as any).mockResolvedValue([]);

        await TaskController.listParentTasks(req as any, res as Response);
        expect(mockedTaskService.listForParent).toHaveBeenCalledWith(expect.objectContaining({
            fromDueAt: undefined
        }));
      });

      it('should handle error', async () => {
        mockGenericError(mockedAuthService.getByProviderUserId as jest.Mock);
        await TaskController.listParentTasks(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('listEmployeeTasks', () => {
      it('should list with filters', async () => {
        req.params = { organisationId: 'o1' };
        req.query = { userId: 'u2', status: ['PENDING'] as any }; // array input
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.listForEmployee as any).mockResolvedValue([]);

        await TaskController.listEmployeeTasks(req as any, res as Response);
        expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(expect.objectContaining({
            organisationId: 'o1',
            userId: 'u2',
            status: ['PENDING']
        }));
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskService.listForEmployee as jest.Mock);
        await TaskController.listEmployeeTasks(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('listForCompanion', () => {
      it('should list with filters', async () => {
        req.params = { companionId: 'c1' };
        req.query = { audience: 'EMPLOYEE_TASK' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.listForCompanion as any).mockResolvedValue([]);

        await TaskController.listForCompanion(req as any, res as Response);
        expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(expect.objectContaining({
            companionId: 'c1',
            audience: 'EMPLOYEE_TASK'
        }));
      });

      it('should handle invalid audience/status filters', async () => {
        req.params = { companionId: 'c1' };
        req.query = { audience: 'INVALID', status: 'INVALID' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.listForCompanion as any).mockResolvedValue([]);

        await TaskController.listForCompanion(req as any, res as Response);
        expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(expect.objectContaining({
            audience: undefined,
            status: undefined
        }));
      });

      it('should handle array inputs for query params', async () => {
        req.params = { companionId: 'c1' };
        req.query = { audience: ['PARENT_TASK'] as any, status: ['COMPLETED'] as any };
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         (mockedTaskService.listForCompanion as any).mockResolvedValue([]);

         await TaskController.listForCompanion(req as any, res as Response);
         expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(expect.objectContaining({
             audience: 'PARENT_TASK',
             status: ['COMPLETED']
         }));
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskService.listForCompanion as jest.Mock);
        await TaskController.listForCompanion(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  /* ========================================================================
   * LIBRARY CONTROLLER
   * ======================================================================*/
  describe('TaskLibraryController', () => {
    describe('list', () => {
      it('should list with kind', async () => {
        req.query = { kind: 'MEDICATION' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskLibraryService.listActive as any).mockResolvedValue([]);
        await TaskLibraryController.list(req as any, res as Response);
        expect(mockedTaskLibraryService.listActive).toHaveBeenCalledWith('MEDICATION');
      });

      it('should list with invalid kind (undefined)', async () => {
        req.query = { kind: 'INVALID' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskLibraryService.listActive as any).mockResolvedValue([]);
        await TaskLibraryController.list(req as any, res as Response);
        expect(mockedTaskLibraryService.listActive).toHaveBeenCalledWith(undefined);
      });

      it('should handle array kind', async () => {
        req.query = { kind: ['HYGIENE'] as any };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskLibraryService.listActive as any).mockResolvedValue([]);
        await TaskLibraryController.list(req as any, res as Response);
        expect(mockedTaskLibraryService.listActive).toHaveBeenCalledWith('HYGIENE');
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskLibraryService.listActive as jest.Mock);
        await TaskLibraryController.list(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('getById', () => {
      it('should success', async () => {
        req.params = { libraryId: 'lib1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskLibraryService.getById as any).mockResolvedValue({});
        await TaskLibraryController.getById(req as any, res as Response);
        expect(mockedTaskLibraryService.getById).toHaveBeenCalledWith('lib1');
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskLibraryService.getById as jest.Mock);
        await TaskLibraryController.getById(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  /* ========================================================================
   * TEMPLATE CONTROLLER
   * ======================================================================*/
  describe('TaskTemplateController', () => {
    describe('create', () => {
      it('should success (201)', async () => {
        (req as any).userId = 'u1';
        req.body = { name: 'Tmpl' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskTemplateService.create as any).mockResolvedValue({});
        await TaskTemplateController.create(req as any, res as Response);
        expect(mockedTaskTemplateService.create).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u1' }));
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskTemplateService.create as jest.Mock);
        await TaskTemplateController.create(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('update', () => {
      it('should success', async () => {
        req.params = { templateId: 't1' };
        req.body = { name: 'Upd' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskTemplateService.update as any).mockResolvedValue({});
        await TaskTemplateController.update(req as any, res as Response);
        expect(mockedTaskTemplateService.update).toHaveBeenCalledWith('t1', req.body);
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskTemplateService.update as jest.Mock);
        await TaskTemplateController.update(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('archive', () => {
      it('should success (204)', async () => {
        req.params = { templateId: 't1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskTemplateService.archive as any).mockResolvedValue(undefined);
        await TaskTemplateController.archive(req as any, res as Response);
        expect(mockedTaskTemplateService.archive).toHaveBeenCalledWith('t1');
        expect(statusMock).toHaveBeenCalledWith(204);
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskTemplateService.archive as jest.Mock);
        await TaskTemplateController.archive(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('list', () => {
      it('should list with filters', async () => {
        req.params = { organisationId: 'o1' };
        req.query = { kind: 'CUSTOM' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskTemplateService.listForOrganisation as any).mockResolvedValue([]);
        await TaskTemplateController.list(req as any, res as Response);
        expect(mockedTaskTemplateService.listForOrganisation).toHaveBeenCalledWith('o1', 'CUSTOM');
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskTemplateService.listForOrganisation as jest.Mock);
        await TaskTemplateController.list(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe('getById', () => {
      it('should success', async () => {
        req.params = { templateId: 't1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskTemplateService.getById as any).mockResolvedValue({});
        await TaskTemplateController.getById(req as any, res as Response);
        expect(mockedTaskTemplateService.getById).toHaveBeenCalledWith('t1');
      });

      it('should handle error', async () => {
        mockGenericError(mockedTaskTemplateService.getById as jest.Mock);
        await TaskTemplateController.getById(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });
});