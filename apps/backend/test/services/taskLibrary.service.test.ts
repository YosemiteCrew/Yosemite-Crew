import {
  TaskLibraryService,
  TaskLibraryServiceError,
} from "../../src/services/taskLibrary.service";
import TaskLibraryDefinitionModel, {
  TaskKind,
} from "../../src/models/taskLibraryDefinition";
import { Types } from "mongoose";

// Mock the Mongoose Model
jest.mock('../../src/models/taskLibraryDefinition');

describe("TaskLibraryService", () => {
  const validId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TaskLibraryServiceError', () => {
    it('should create an error with default status code', () => {
      const err = new TaskLibraryServiceError('Test Error');
      expect(err.message).toBe('Test Error');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('TaskLibraryServiceError');
    });

    it('should create an error with custom status code', () => {
      const err = new TaskLibraryServiceError('Payment Required', 402);
      expect(err.statusCode).toBe(402);
    });
  });

  describe('create', () => {
    const validInput = {
      kind: 'HYGIENE' as TaskKind,
      category: 'Health',
      name: 'Checkup',
      defaultDescription: 'Routine check',
      schema: {},
    };

    it('should throw 400 if required fields are missing', async () => {
      await expect(
        TaskLibraryService.create({ ...validInput, name: '' } as any)
      ).rejects.toThrow('kind, category and name are required');
    });

    it('should throw 400 if MEDICATION kind is missing medicationFields', async () => {
      const input = { ...validInput, kind: 'MEDICATION' as TaskKind, schema: {} };
      await expect(TaskLibraryService.create(input)).rejects.toThrow(
        'medicationFields required for MEDICATION task'
      );
    });

    it('should throw 400 if OBSERVATION_TOOL kind is not set to true', async () => {
      const input = {
        ...validInput,
        kind: 'OBSERVATION_TOOL' as TaskKind,
        schema: { requiresObservationTool: false },
      };
      await expect(TaskLibraryService.create(input)).rejects.toThrow(
        'requiresObservationTool must be true for OBSERVATION_TOOL task'
      );
    });

    it('should throw 400 if CUSTOM recurrence is missing cronExpression', async () => {
      const input = {
        ...validInput,
        schema: {
          recurrence: {
            default: { type: 'CUSTOM', editable: true },
          },
        } as any,
      };
      await expect(TaskLibraryService.create(input)).rejects.toThrow(
        'cronExpression required for CUSTOM recurrence'
      );
    });

    it('should throw 409 if task definition already exists', async () => {
      // Mock findOne to return an existing document
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'existing-id' }),
      });

      await expect(TaskLibraryService.create(validInput)).rejects.toThrow(
        'Task definition with same name and kind already exists'
      );
      expect(TaskLibraryDefinitionModel.findOne).toHaveBeenCalledWith({
        source: 'YC_LIBRARY',
        name: validInput.name,
        kind: validInput.kind,
      });
    });

    it('should create a new task library definition successfully', async () => {
      // Mock findOne to return null (does not exist)
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      // Mock create
      (TaskLibraryDefinitionModel.create as jest.Mock).mockResolvedValue({
        _id: 'new-id',
        ...validInput,
      });

      const result = await TaskLibraryService.create(validInput);

      expect(result).toHaveProperty('_id', 'new-id');
      expect(TaskLibraryDefinitionModel.create).toHaveBeenCalledWith({
        source: 'YC_LIBRARY',
        kind: validInput.kind,
        category: validInput.category,
        name: validInput.name,
        defaultDescription: validInput.defaultDescription,
        applicableSpecies: undefined,
        schema: {
          medicationFields: {}, // Default empty object
          requiresObservationTool: false, // Default false
          recurrence: undefined,
        },
        isActive: true,
      });
    });

    it('should pass through explicit schema values', async () => {
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const complexInput = {
        ...validInput,
        schema: {
          medicationFields: { hasDosage: true },
          requiresObservationTool: true,
          recurrence: { default: { type: 'DAILY' } },
        } as any,
      };

      await TaskLibraryService.create(complexInput);

      expect(TaskLibraryDefinitionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: {
            medicationFields: { hasDosage: true },
            requiresObservationTool: true,
            recurrence: { default: { type: 'DAILY' } },
          },
        })
      );
    });
  });

  describe('listActive', () => {
    it('should list all active tasks', async () => {
      const mockExec = jest.fn().mockResolvedValue(['task1', 'task2']);
      const mockSort = jest.fn().mockReturnValue({ exec: mockExec });
      (TaskLibraryDefinitionModel.find as jest.Mock).mockReturnValue({
        sort: mockSort,
      });

      const result = await TaskLibraryService.listActive();

      expect(TaskLibraryDefinitionModel.find).toHaveBeenCalledWith({
        isActive: true,
      });
      expect(mockSort).toHaveBeenCalledWith({ category: 1, name: 1 });
      expect(result).toEqual(['task1', 'task2']);
    });

    it('should list active tasks filtered by kind', async () => {
      const mockExec = jest.fn().mockResolvedValue(['task1']);
      const mockSort = jest.fn().mockReturnValue({ exec: mockExec });
      (TaskLibraryDefinitionModel.find as jest.Mock).mockReturnValue({
        sort: mockSort,
      });

      await TaskLibraryService.listActive('MEDICATION' as TaskKind);

      expect(TaskLibraryDefinitionModel.find).toHaveBeenCalledWith({
        isActive: true,
        kind: 'MEDICATION',
      });
    });
  });

  describe('getById', () => {
    it('should return the document if found', async () => {
      const mockExec = jest.fn().mockResolvedValue({ _id: validId });
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: mockExec,
      });

      const result = await TaskLibraryService.getById(validId);
      expect(result).toEqual({ _id: validId });
    });

    it('should throw 404 if not found', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: mockExec,
      });

      await expect(TaskLibraryService.getById(validId)).rejects.toThrow(
        'Library task not found'
      );
    });
  });

  describe('update', () => {
    it('should throw 404 if task not found', async () => {
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskLibraryService.getById(validId),
      ).rejects.toBeInstanceOf(TaskLibraryServiceError);
    });
  });
});
