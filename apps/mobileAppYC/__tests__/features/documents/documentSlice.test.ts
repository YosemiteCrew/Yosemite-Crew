// __tests__/features/documents/documentSlice.test.ts
import documentReducer, {
  setUploadProgress,
  clearError,
  uploadDocumentFiles,
  addDocument,
  updateDocument,
  deleteDocument,
} from '@/features/documents/documentSlice';

import type {Document, DocumentFile} from '@/features/documents/types';
import {documentApi} from '@/features/documents/services/documentService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {generateId} from '@/shared/utils/helpers';
import {ThunkDispatch, UnknownAction} from '@reduxjs/toolkit';


// Mock the generateId helper
jest.mock('@/shared/utils/helpers', () => ({
  generateId: jest.fn(),
}));

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

jest.mock('@/features/documents/services/documentService', () => ({
  documentApi: {
    list: jest.fn(),
    uploadAttachment: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    fetchView: jest.fn(),
  },
}));

// Use fake timers
jest.useFakeTimers();

const mockedGenerateId = generateId as jest.Mock;
const mockedDocumentApi = documentApi as jest.Mocked<typeof documentApi>;
const mockGetFreshStoredTokens =
  getFreshStoredTokens as jest.MockedFunction<typeof getFreshStoredTokens>;
const mockIsTokenExpired =
  isTokenExpired as jest.MockedFunction<typeof isTokenExpired>;
const mockDate = new Date('2025-01-01T00:00:00.000Z');
const mockISODate = mockDate.toISOString();

// Store spy references to restore them specifically
let dateSpy: jest.SpyInstance | null = null;

describe('documentSlice', () => {
  const initialState = {
    documents: [],
    loading: false,
    fetching: false,
    error: null,
    uploadProgress: 0,
    viewLoading: {},
    searchResults: [],
    searchLoading: false,
    searchError: null,
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
    jest.clearAllMocks();
    mockedGenerateId.mockImplementation(() => 'mock-id');
    dateSpy = jest
      .spyOn(globalThis, 'Date')
      .mockImplementation(() => mockDate as any);
    mockGetFreshStoredTokens.mockResolvedValue({
      accessToken: 'test-token',
      expiresAt: mockDate.getTime() + 60 * 1000,
    });
    mockIsTokenExpired.mockReturnValue(false);
    Object.values(mockedDocumentApi).forEach(mockFn => {
      if (typeof mockFn === 'function' && 'mockReset' in mockFn) {
        (mockFn as jest.Mock).mockReset();
      }
    });
  });

  // Clean up mocks after each test
  afterEach(() => {
    dateSpy?.mockRestore();
    dateSpy = null;
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
    const payload = {files, companionId: 'companion_1'};

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        uploadDocumentFiles.pending('requestId', payload),
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
        uploadDocumentFiles.fulfilled(uploadedFiles, 'requestId', payload),
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
          payload,
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
      appointmentId: '',
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
    const baseUpdateArgs = {
      documentId: 'doc_1',
      companionId: 'companion_1',
      category: 'medical',
      subcategory: 'vaccination',
      visitType: 'routine',
      title: 'Updated Title',
      businessName: 'Veterinary Clinic',
      issueDate: '2024-01-15',
      files: [mockDocumentFile],
    };

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        updateDocument.pending('requestId', baseUpdateArgs),
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
      const fulfilledPayload: Document = {
        ...mockDocument,
        title: 'Updated Title',
        updatedAt: '2024-01-20T10:00:00.000Z',
      };
      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(fulfilledPayload, 'requestId', baseUpdateArgs),
      );
      expect(state.loading).toBe(false);
      expect(state.documents[0]).toEqual({
        ...mockDocument,
        title: 'Updated Title',
        updatedAt: '2024-01-20T10:00:00.000Z',
      });
    });

    it('should append document when not found', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument2],
        loading: true,
      };
      const payload: Document = {
        ...mockDocument,
        id: 'new_doc',
        title: 'Should Not Update',
      };
      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(payload, 'requestId', {
          ...baseUpdateArgs,
          documentId: 'new_doc',
        }),
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument2, payload]);
    });

    it('should partially update document fields', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };
      const payload: Document = {
        ...mockDocument,
        title: 'Only Title Updated',
        updatedAt: mockISODate,
      };
      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(payload, 'requestId', {
          ...baseUpdateArgs,
          title: 'Only Title Updated',
        }),
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
          baseUpdateArgs,
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
    const deleteArgs = {documentId};

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        { ...initialState, error: 'previous error' },
        deleteDocument.pending('requestId', deleteArgs),
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
        deleteDocument.fulfilled('doc_1', 'requestId', deleteArgs),
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
        deleteDocument.fulfilled('doc_1', 'requestId', deleteArgs),
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
          { documentId: 'non_existent_id' },
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
          deleteArgs,
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
  // --- ASYNC THUNK LOGIC TESTS ---
  // ----------------------------------------------------------------
  describe('async thunks', () => {
    type MockDispatch = ThunkDispatch<unknown, unknown, UnknownAction>;
    const mockDispatch = jest.fn() as jest.MockedFunction<MockDispatch>;
    const mockGetState = jest.fn(() => ({}));

    beforeEach(() => {
      mockDispatch.mockReset();
      mockDispatch.mockImplementation(action => action);
      mockGetState.mockReset();
    });

    describe('uploadDocumentFiles', () => {
      const uploadArgs = {
        files: [mockDocumentFile],
        companionId: 'companion_1',
      };

      it('should successfully upload files and dispatch progress', async () => {
        const uploadedFile = {
          ...mockDocumentFile,
          key: 'file-key',
          s3Url: 'https://mock-s3/doc.pdf',
        };
        mockedDocumentApi.uploadAttachment.mockResolvedValue(uploadedFile);

        const result = await uploadDocumentFiles(uploadArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(uploadDocumentFiles.fulfilled.type);
        expect(result.payload).toEqual([uploadedFile]);
        expect(mockDispatch).toHaveBeenCalledWith(setUploadProgress(0));
      });

      it('should handle upload failure and reject with error message', async () => {
        mockedDocumentApi.uploadAttachment.mockRejectedValue(
          new Error('S3 upload failed'),
        );

        const result = await uploadDocumentFiles(uploadArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(uploadDocumentFiles.rejected.type);
        expect(result.payload).toBe('S3 upload failed');
      });

      it('should handle upload failure and reject with fallback message', async () => {
        mockedDocumentApi.uploadAttachment.mockRejectedValue('boom');

        const result = await uploadDocumentFiles(uploadArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(uploadDocumentFiles.rejected.type);
        expect(result.payload).toBe('Failed to upload files');
      });
    });

    describe('addDocument', () => {
      const addArgs = {
        companionId: 'companion_1',
        category: 'medical',
        subcategory: 'vaccination',
        visitType: 'routine',
        title: 'New Document',
        businessName: 'Vet Clinic',
        issueDate: '2024-01-20',
        files: [mockDocumentFile],
        appointmentId: '',
      };

      it('should successfully add a document', async () => {
        mockedDocumentApi.create.mockResolvedValue(mockDocument);

        const result = await addDocument(addArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(addDocument.fulfilled.type);
        expect(result.payload).toEqual(mockDocument);
        expect(mockedDocumentApi.create).toHaveBeenCalledWith({
          ...addArgs,
          accessToken: 'test-token',
        });
      });

      it('should handle add document failure with error message', async () => {
        mockedDocumentApi.create.mockRejectedValue(new Error('Database failed'));

        const result = await addDocument(addArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(addDocument.rejected.type);
        expect(result.payload).toBe('Database failed');
      });

      it('should handle add document failure with fallback message', async () => {
        mockedDocumentApi.create.mockRejectedValue(null);

        const result = await addDocument(addArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(addDocument.rejected.type);
        expect(result.payload).toBe('Failed to add document');
      });
    });

    describe('updateDocument', () => {
      const updateArgs = {
        documentId: 'doc_1',
        companionId: 'companion_1',
        category: 'medical',
        subcategory: 'vaccination',
        visitType: 'routine',
        title: 'Updated Title',
        businessName: 'Vet Clinic',
        issueDate: '2024-01-20',
        files: [mockDocumentFile],
      };

      it('should successfully update a document', async () => {
        const updatedDoc = {...mockDocument, title: 'Updated Title'};
        mockedDocumentApi.update.mockResolvedValue(updatedDoc);

        const result = await updateDocument(updateArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(updateDocument.fulfilled.type);
        expect(result.payload).toEqual(updatedDoc);
      });

      it('should handle update document failure with error message', async () => {
        mockedDocumentApi.update.mockRejectedValue(new Error('Update conflict'));

        const result = await updateDocument(updateArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(updateDocument.rejected.type);
        expect(result.payload).toBe('Update conflict');
      });

      it('should handle update document failure with fallback message', async () => {
        mockedDocumentApi.update.mockRejectedValue({oops: true});

        const result = await updateDocument(updateArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(updateDocument.rejected.type);
        expect(result.payload).toBe('Failed to update document');
      });
    });

    describe('deleteDocument', () => {
      const deleteArgs = {documentId: 'doc_1'};

      it('should successfully delete a document', async () => {
        mockedDocumentApi.remove.mockResolvedValue(true);

        const result = await deleteDocument(deleteArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(deleteDocument.fulfilled.type);
        expect(result.payload).toBe('doc_1');
      });

      it('should handle delete document failure', async () => {
        mockedDocumentApi.remove.mockRejectedValue(new Error('Timeout failed'));

        const result = await deleteDocument(deleteArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(deleteDocument.rejected.type);
        expect(result.payload).toBe('Timeout failed');
      });

      it('should handle delete document failure with fallback message', async () => {
        mockedDocumentApi.remove.mockRejectedValue(undefined);

        const result = await deleteDocument(deleteArgs)(
          mockDispatch,
          mockGetState,
          undefined,
        );

        expect(result.type).toBe(deleteDocument.rejected.type);
        expect(result.payload).toBe('Failed to delete document');
      });
    });
  });
});
