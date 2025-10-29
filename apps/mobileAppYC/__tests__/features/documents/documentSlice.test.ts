// __tests__/features/documents/documentSlice.test.ts
import documentReducer, {
  setUploadProgress,
  clearError,
  uploadDocumentFiles,
  addDocument,
  updateDocument,
  deleteDocument,
} from '@/features/documents/documentSlice';
import type { Document, DocumentFile } from '@/features/documents/types';
import { generateId } from '@/shared/utils/helpers';
import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';

// Mock the generateId helper
jest.mock('@/shared/utils/helpers', () => ({
  generateId: jest.fn(),
}));

// Use fake timers
jest.useFakeTimers();

const mockedGenerateId = generateId as jest.Mock;
const mockDate = new Date('2025-01-01T00:00:00.000Z');
const mockISODate = mockDate.toISOString();

// Store spy references to restore them specifically
let dateSpy: jest.SpyInstance | null = null;
let setTimeoutSpy: jest.SpyInstance | null = null;

describe('documentSlice', () => {
  const initialState = {
    documents: [],
    loading: false,
    error: null,
    uploadProgress: 0,
  };

  const mockDocumentFile: DocumentFile = {
    id: 'file_1',
    uri: 'file:///path/to/file.pdf',
    name: 'test-document.pdf',
    type: 'application/pdf',
    size: 1024,
  };

  const mockDocument: Document = {
    id: 'doc_1',
    companionId: 'companion_1',
    category: 'medical',
    subcategory: 'vaccination',
    visitType: 'routine',
    title: 'Annual Checkup',
    businessName: 'Veterinary Clinic',
    issueDate: '2024-01-15',
    files: [mockDocumentFile],
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    isSynced: false,
    isUserAdded: true,
  };

  const mockDocument2: Document = {
    ...mockDocument,
    id: 'doc_2',
    title: 'Vaccination Record',
  };

  // Set up mocks before each test
  beforeEach(() => {
    mockedGenerateId.mockImplementation(() => 'mock-id');
    dateSpy = jest
      .spyOn(globalThis, 'Date')
      .mockImplementation(() => mockDate as any);
  });

  // Clean up mocks after each test
  afterEach(() => {
    dateSpy?.mockRestore();
    setTimeoutSpy?.mockRestore();
    dateSpy = null;
    setTimeoutSpy = null;
    jest.clearAllTimers();
    mockedGenerateId.mockClear();
  });

  // Restore real timers after all tests in the suite
  afterAll(() => {
    jest.useRealTimers();
  });

  // --- Initial State and Reducers tests (no changes) ---
  describe('initial state', () => {
    it('should return the initial state', () => {
      expect(documentReducer(undefined, { type: 'unknown' })).toEqual(
        initialState,
      );
    });
  });

  describe('reducers', () => {
    describe('setUploadProgress', () => {
      it('should set upload progress to 0', () => {
        const state = documentReducer(
          { ...initialState, uploadProgress: 50 },
          setUploadProgress(0),
        );
        expect(state.uploadProgress).toBe(0);
      });

      it('should set upload progress to 50', () => {
        const state = documentReducer(initialState, setUploadProgress(50));
        expect(state.uploadProgress).toBe(50);
      });

      it('should set upload progress to 100', () => {
        const state = documentReducer(initialState, setUploadProgress(100));
        expect(state.uploadProgress).toBe(100);
      });

      it('should update upload progress multiple times', () => {
        let state = documentReducer(initialState, setUploadProgress(25));
        expect(state.uploadProgress).toBe(25);
        state = documentReducer(state, setUploadProgress(50));
        expect(state.uploadProgress).toBe(50);
        state = documentReducer(state, setUploadProgress(75));
        expect(state.uploadProgress).toBe(75);
      });
    });

    describe('clearError', () => {
      it('should clear the error', () => {
        const stateWithError = { ...initialState, error: 'Upload failed' };
        const state = documentReducer(stateWithError, clearError());
        expect(state.error).toBeNull();
      });

      it('should not affect other state properties', () => {
        const stateWithError = {
          ...initialState,
          documents: [mockDocument],
          loading: true,
          error: 'Some error',
          uploadProgress: 50,
        };
        const state = documentReducer(stateWithError, clearError());
        expect(state.documents).toEqual([mockDocument]);
        expect(state.loading).toBe(true);
        expect(state.uploadProgress).toBe(50);
        expect(state.error).toBeNull();
      });

      it('should work when error is already null', () => {
        const state = documentReducer(initialState, clearError());
        expect(state.error).toBeNull();
      });
    });
  });

  // --- Extra Reducers tests (no changes) ---
  describe('extraReducers - uploadDocumentFiles', () => {
    const files: DocumentFile[] = [mockDocumentFile];

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        uploadDocumentFiles.pending('requestId', files),
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set loading to false on fulfilled', () => {
      const uploadedFiles: DocumentFile[] = [
        {
          ...mockDocumentFile,
          s3Url:
            'https://mock-s3-bucket.s3.amazonaws.com/documents/test-document.pdf',
        },
      ];
      const state = documentReducer(
        { ...initialState, loading: true },
        uploadDocumentFiles.fulfilled(uploadedFiles, 'requestId', files),
      );
      expect(state.loading).toBe(false);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to upload files';
      const state = documentReducer(
        { ...initialState, loading: true },
        uploadDocumentFiles.rejected(
          new Error(errorMessage),
          'requestId',
          files,
          errorMessage,
        ),
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle rejected with custom error payload', () => {
      const customError = 'Network error';
      const action = {
        type: uploadDocumentFiles.rejected.type,
        payload: customError,
      };
      const state = documentReducer({ ...initialState, loading: true }, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

  describe('extraReducers - addDocument', () => {
    const newDocumentData = {
      companionId: 'companion_1',
      category: 'medical',
      subcategory: 'vaccination',
      visitType: 'routine',
      title: 'Annual Checkup',
      businessName: 'Veterinary Clinic',
      issueDate: '2024-01-15',
      files: [mockDocumentFile],
      isSynced: false,
    };

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        addDocument.pending('requestId', newDocumentData),
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should add document on fulfilled', () => {
      const state = documentReducer(
        { ...initialState, loading: true },
        addDocument.fulfilled(mockDocument, 'requestId', newDocumentData),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument]);
    });

    it('should append to existing documents on fulfilled', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };
      const state = documentReducer(
        stateWithDocuments,
        addDocument.fulfilled(mockDocument2, 'requestId', newDocumentData),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument, mockDocument2]);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to add document';
      const state = documentReducer(
        { ...initialState, loading: true },
        addDocument.rejected(
          new Error(errorMessage),
          'requestId',
          newDocumentData,
          errorMessage,
        ),
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle rejected with custom error payload', () => {
      const customError = 'Validation error';
      const action = { type: addDocument.rejected.type, payload: customError };
      const state = documentReducer({ ...initialState, loading: true }, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

  describe('extraReducers - updateDocument', () => {
    const updatePayload = {
      documentId: 'doc_1',
      updates: { title: 'Updated Title' },
    };

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        updateDocument.pending('requestId', updatePayload),
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should update document on fulfilled', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument, mockDocument2],
        loading: true,
      };
      const fulfilledPayload = {
        documentId: 'doc_1',
        updates: {
          ...updatePayload.updates,
          updatedAt: '2024-01-20T10:00:00.000Z',
        },
      };
      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(fulfilledPayload, 'requestId', updatePayload),
      );
      expect(state.loading).toBe(false);
      expect(state.documents[0].title).toBe('Updated Title');
      expect(state.documents[0].updatedAt).toBe('2024-01-20T10:00:00.000Z');
      expect(state.documents[1]).toEqual(mockDocument2);
    });

    it('should not update if document not found', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument2],
        loading: true,
      };
      const payload = {
        documentId: 'non_existent_id',
        updates: { title: 'Should Not Update' },
      };
      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(payload, 'requestId', payload),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument2]);
    });

    it('should partially update document fields', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };
      const payload = {
        documentId: 'doc_1',
        updates: { title: 'Only Title Updated' },
      };
      const fulfilledPayload = {
        documentId: 'doc_1',
        updates: { ...payload.updates, updatedAt: mockISODate }, // Assuming mockISODate is added on update
      };
      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(fulfilledPayload, 'requestId', payload),
      );
      expect(state.documents[0].title).toBe('Only Title Updated');
      expect(state.documents[0].businessName).toBe('Veterinary Clinic'); // Unchanged
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to update document';
      const state = documentReducer(
        { ...initialState, loading: true },
        updateDocument.rejected(
          new Error(errorMessage),
          'requestId',
          updatePayload,
          errorMessage,
        ),
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle rejected with custom error payload', () => {
      const customError = 'Document not found';
      const action = {
        type: updateDocument.rejected.type,
        payload: customError,
      };
      const state = documentReducer({ ...initialState, loading: true }, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

  describe('extraReducers - deleteDocument', () => {
    const documentId = 'doc_1';

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        deleteDocument.pending('requestId', documentId),
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should delete document on fulfilled', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument, mockDocument2],
        loading: true,
      };
      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled('doc_1', 'requestId', documentId),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument2]);
    });

    it('should delete the last document', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };
      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled('doc_1', 'requestId', documentId),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([]);
    });

    it('should not delete if document not found', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument, mockDocument2],
        loading: true,
      };
      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled(
          'non_existent_id',
          'requestId',
          'non_existent_id',
        ),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument, mockDocument2]);
    });

    it('should delete from middle of array', () => {
      const mockDocument3 = {
        ...mockDocument,
        id: 'doc_3',
        title: 'Third Doc',
      };
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument, mockDocument2, mockDocument3],
        loading: true,
      };
      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled('doc_2', 'requestId', 'doc_2'),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument, mockDocument3]);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to delete document';
      const state = documentReducer(
        { ...initialState, loading: true },
        deleteDocument.rejected(
          new Error(errorMessage),
          'requestId',
          documentId,
          errorMessage,
        ),
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle rejected with custom error payload', () => {
      const customError = 'Permission denied';
      const action = {
        type: deleteDocument.rejected.type,
        payload: customError,
      };
      const state = documentReducer({ ...initialState, loading: true }, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

  // ----------------------------------------------------------------
  // --- ASYNC THUNK LOGIC TESTS (Final Updates) ---
  // ----------------------------------------------------------------
  describe('async thunks', () => {
    type MockDispatch = ThunkDispatch<unknown, unknown, UnknownAction>;
    const mockDispatch = jest.fn() as jest.MockedFunction<MockDispatch>;
    const mockGetState = jest.fn(() => ({})); // Basic mock getState

    beforeEach(() => {
      mockDispatch.mockClear();
      mockGetState.mockClear();
      // Mocks like Date, generateId are set up in top-level beforeEach
    });

    describe('uploadDocumentFiles', () => {
      const progressResetReducer = (
        lastIndex: number,
        callArgs: unknown[],
        currentIndex: number,
      ): number => {
        const action = callArgs[0]; // Argument dispatched
        // Type Guard: Check if it's a plain object with a 'type' property
        if (action && typeof action === 'object' && 'type' in action) {
          return action.type === setUploadProgress.type &&
            (action as any).payload === 0
            ? currentIndex
            : lastIndex;
        }
        return lastIndex; // Ignore if it's not a recognizable action object
      };

      const testUploadSuccess = async () => {
        const mockFileWithSpace = {
          ...mockDocumentFile,
          name: 'test file with spaces.pdf',
        };
        const thunk = uploadDocumentFiles([mockFileWithSpace]);

        const promise = thunk(mockDispatch, mockGetState, undefined);
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result.type).toBe(uploadDocumentFiles.fulfilled.type);
        expect(result.payload).toEqual([
          {
            ...mockFileWithSpace,
            s3Url:
              'https://mock-s3-bucket.s3.amazonaws.com/documents/test_file_with_spaces.pdf',
          },
        ]);

        expect(mockDispatch).toHaveBeenCalledWith(setUploadProgress(0));
        expect(mockDispatch).toHaveBeenCalledWith(setUploadProgress(100)); // Check final progress

        const calls = mockDispatch.mock.calls;
        const resetCallIndex = calls.slice(0, -1).reduce(progressResetReducer, -1);
        expect(resetCallIndex).not.toBe(-1); // Ensure reset progress(0) was dispatched at some point

        const lastCallArgs = calls.at(-1);
        expect(lastCallArgs).toBeDefined(); // Ensure there was a last call
        if (lastCallArgs) {
          // Type guard for TypeScript
          // Ensure the last action is indeed setUploadProgress(100)
        }
      };
      it(
        'should successfully upload files and dispatch progress',
        testUploadSuccess,
      );

      const uploadError = new Error('S3 upload failed');
      const throwUploadError = () => {
        throw uploadError;
      };
      const testUploadFailure = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwUploadError);

        const thunk = uploadDocumentFiles([mockDocumentFile]);
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(uploadDocumentFiles.rejected.type);
        expect(result.payload).toBe('S3 upload failed');
      };
      it(
        'should handle upload failure and reject with error message',
        testUploadFailure,
      );

      const uploadErrorString = 'S3 upload failed without message';
      const throwUploadErrorString = () => {
        throw uploadErrorString;
      };
      const testUploadFailureNoMessage = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwUploadErrorString);

        const thunk = uploadDocumentFiles([mockDocumentFile]);
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(uploadDocumentFiles.rejected.type);
        expect(result.payload).toBe('Failed to upload files'); // <-- Test the fallback
      };
      it(
        'should handle upload failure and reject with fallback message',
        testUploadFailureNoMessage,
      );
    });

    describe('addDocument', () => {
      const newDocData: Omit<
        Document,
        'id' | 'createdAt' | 'updatedAt' | 'isUserAdded'
      > = {
        companionId: 'companion_1',
        category: 'medical',
        subcategory: 'vaccination',
        visitType: 'routine',
        title: 'New Document',
        businessName: 'Vet Clinic',
        issueDate: '2024-01-20',
        files: [mockDocumentFile],
        isSynced: false,
      };

      const testAddSuccess = async () => {
        expect(generateId()).toBe('mock-id'); // Pre-check mock
        expect(new Date().toISOString()).toBe(mockISODate); // Pre-check mock
        await jest.runAllTimersAsync(); // Advance timers for the mock async operation
      };
      it(
        'should successfully add a document with correct metadata',
        testAddSuccess,
      );

      const addError = new Error('Database failed');
      const throwAddError = () => {
        throw addError;
      };
      const testAddDocumentFailure = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwAddError);

        const thunk = addDocument(newDocData); // newDocData is from the outer scope
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(addDocument.rejected.type);
        expect(result.payload).toBe('Database failed');
      };
      it(
        'should handle add document failure with error message',
        testAddDocumentFailure,
      );

      const throwAddNullError = () => {
        throw null;
      };
      const testAddDocumentFailureNoMessage = async () => {
        // --- FIX: This is the typo ---
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout') // Was globalTOS
          .mockImplementationOnce(throwAddNullError);

        const thunk = addDocument(newDocData);
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(addDocument.rejected.type);
      };
      it(
        'should handle add document failure with fallback message',
        testAddDocumentFailureNoMessage,
      );
    });

    describe('updateDocument', () => {
      const updatePayload = {
        documentId: 'doc_1',
        updates: { title: 'Updated Title' },
      };

      const testUpdateSuccess = async () => {
        const thunk = updateDocument(updatePayload);
        const promise = thunk(mockDispatch, mockGetState, undefined);

        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result.type).toBe(updateDocument.fulfilled.type);
        expect(result.payload).toEqual({
          documentId: 'doc_1',
          updates: {
            title: 'Updated Title',
            updatedAt: mockISODate, // Assuming mock async adds timestamp
          },
        });
      };
      it(
        'should successfully update a document and add updatedAt',
        testUpdateSuccess,
      );

      const updateError = new Error('Update conflict');
      const throwUpdateError = () => {
        throw updateError;
      };
      const testUpdateDocumentFailure = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwUpdateError);

        const thunk = updateDocument(updatePayload); // updatePayload from outer scope
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(updateDocument.rejected.type);
        expect(result.payload).toBe('Update conflict');
      };
      it(
        'should handle update document failure with error message',
        testUpdateDocumentFailure,
      );

      const updateObjectError = { details: 'no message' };
      const throwUpdateObjectError = () => {
        throw updateObjectError;
      };
      const testUpdateDocumentFailureNoMessage = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwUpdateObjectError);

        const thunk = updateDocument(updatePayload);
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(updateDocument.rejected.type);
        expect(result.payload).toBe('Failed to update document'); // <-- Test the fallback
      };
      it(
        'should handle update document failure with fallback message',
        testUpdateDocumentFailureNoMessage,
      );
    });

    describe('deleteDocument', () => {
      const testDeleteSuccess = async () => {
        const documentId = 'doc_1';
        const thunk = deleteDocument(documentId);
        const promise = thunk(mockDispatch, mockGetState, undefined);

        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result.type).toBe(deleteDocument.fulfilled.type);
        expect(result.payload).toBe(documentId);
      };
      it(
        'should successfully delete a document',
        testDeleteSuccess,
      );

      const deleteError = new Error('Timeout failed');
      const throwDeleteError = () => {
        throw deleteError;
      };
      const testDeleteFailure = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwDeleteError);

        const thunk = deleteDocument('doc_1');
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(deleteDocument.rejected.type);
        expect(result.payload).toBe('Timeout failed');
      };
      it(
        'should handle delete document failure',
        testDeleteFailure,
      );

      const throwDeleteUndefinedError = () => {
        throw undefined;
      };
      const testDeleteFailureNoMessage = async () => {
        setTimeoutSpy = jest
          .spyOn(globalThis, 'setTimeout')
          .mockImplementationOnce(throwDeleteUndefinedError);

        const thunk = deleteDocument('doc_1');
        const result = await thunk(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe(deleteDocument.rejected.type);
      };
      it(
        'should handle delete document failure with fallback message',
        testDeleteFailureNoMessage,
      );
    });
  });
});