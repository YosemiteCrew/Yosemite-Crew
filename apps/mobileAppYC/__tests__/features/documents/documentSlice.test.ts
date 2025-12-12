import documentReducer, {
  resetDocumentState,
  setUploadProgress,
  clearError,
  clearSearchResults,
  fetchDocuments,
  uploadDocumentFiles,
  addDocument,
  updateDocument,
  deleteDocument,
  fetchDocumentView,
  searchDocuments,
} from '../../../src/features/documents/documentSlice';
import {documentApi} from '../../../src/features/documents/services/documentService';
import * as sessionManager from '../../../src/features/auth/sessionManager';
import {configureStore} from '@reduxjs/toolkit';

// --- Mocks ---
jest.mock('../../../src/features/documents/services/documentService');
jest.mock('../../../src/features/auth/sessionManager');

const mockGetFreshStoredTokens = sessionManager.getFreshStoredTokens as jest.Mock;
const mockIsTokenExpired = sessionManager.isTokenExpired as jest.Mock;

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

  const createTestStore = (preloadedState = {}) => {
    return configureStore({
      reducer: {
        documents: documentReducer,
      },
      preloadedState: {
        documents: {...initialState, ...preloadedState},
      },
    } as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default valid token
    mockGetFreshStoredTokens.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: Date.now() + 10000,
    });
    mockIsTokenExpired.mockReturnValue(false);
  });

  // ====================================================
  // 1. SYNCHRONOUS REDUCERS
  // ====================================================
  describe('Synchronous Reducers', () => {
    it('should return initial state', () => {
      expect(documentReducer(undefined, {type: 'unknown'})).toEqual(initialState);
    });

    it('resetDocumentState: should reset all fields', () => {
      const dirtyState = {
        ...initialState,
        documents: [{id: '1'}],
        loading: true,
        error: 'err',
      };
      expect(documentReducer(dirtyState as any, resetDocumentState())).toEqual(initialState);
    });

    it('setUploadProgress: should update progress', () => {
      const state = documentReducer(initialState, setUploadProgress(50)) as any;
      expect(state.uploadProgress).toBe(50);
    });

    it('clearError: should clear errors', () => {
      const state = {...initialState, error: 'err', searchError: 'searchErr'};
      const result = documentReducer(state as any, clearError()) as any;
      expect(result.error).toBeNull();
      expect(result.searchError).toBeNull();
    });

    it('clearSearchResults: should clear results', () => {
      const state = {...initialState, searchResults: [{id: '1'}]};
      const result = documentReducer(state as any, clearSearchResults()) as any;
      expect(result.searchResults).toEqual([]);
      expect(result.searchError).toBeNull();
    });
  });

  // ====================================================
  // 2. AUTH GUARDS (Edge Cases)
  // ====================================================
  describe('Authentication Guards', () => {
    it('should reject if token is null', async () => {
      mockGetFreshStoredTokens.mockResolvedValue(null);
      const store = createTestStore();
      const result = await store.dispatch(fetchDocuments({companionId: 'c1'}));
      expect(result.payload).toBe('Missing access token. Please sign in again.');
    });

    it('should reject if token is expired', async () => {
      mockGetFreshStoredTokens.mockResolvedValue({
        accessToken: 'expired',
        expiresAt: Date.now() - 1000,
      });
      mockIsTokenExpired.mockReturnValue(true);
      const store = createTestStore();
      const result = await store.dispatch(fetchDocuments({companionId: 'c1'}));
      expect(result.payload).toBe('Your session expired. Please sign in again.');
    });

    it('should handle undefined expiresAt (treat as valid)', async () => {
      (documentApi.list as jest.Mock).mockResolvedValue([]);
      mockGetFreshStoredTokens.mockResolvedValue({
        accessToken: 'valid',
        expiresAt: undefined,
      });
      mockIsTokenExpired.mockReturnValue(false);

      const store = createTestStore();
      await store.dispatch(fetchDocuments({companionId: 'c1'}));
      expect(mockIsTokenExpired).toHaveBeenCalledWith(undefined);
    });
  });

  // ====================================================
  // 3. THUNK LIFECYCLES (Pending, Fulfilled, Rejected)
  // ====================================================

  // --- FETCH DOCUMENTS ---
  describe('fetchDocuments', () => {
    it('pending: sets fetching true', () => {
      const action = { type: fetchDocuments.pending.type };
      const state = documentReducer(initialState, action) as any;
      expect(state.fetching).toBe(true);
      expect(state.error).toBeNull();
    });

    it('fulfilled: updates documents', async () => {
      const mockDocs = [{id: '1', companionId: 'c1'}];
      (documentApi.list as jest.Mock).mockResolvedValue(mockDocs);

      const store = createTestStore({
        documents: [{id: 'old', companionId: 'c1'}, {id: 'keep', companionId: 'c2'}]
      });

      await store.dispatch(fetchDocuments({companionId: 'c1'}));

      const state = store.getState().documents;
      expect(state.fetching).toBe(false);
      expect(state.documents).toHaveLength(2); // 1 new + 1 kept
      expect(state.documents.find((d: any) => d.id === '1')).toBeDefined();
    });

    it('rejected: sets error', async () => {
      (documentApi.list as jest.Mock).mockRejectedValue(new Error('Fetch Fail'));
      const store = createTestStore();
      await store.dispatch(fetchDocuments({companionId: 'c1'}));
      const state = store.getState().documents;
      expect(state.fetching).toBe(false);
      expect(state.error).toBe('Fetch Fail');
    });

    it('rejected: fails validation if companionId missing', async () => {
      const store = createTestStore();
      const res = await store.dispatch(fetchDocuments({companionId: ''}));
      expect(res.payload).toBe('Please select a pet to load documents.');
    });
  });

  // --- UPLOAD DOCUMENTS (Complex Logic) ---
  describe('uploadDocumentFiles', () => {
    it('pending: sets loading true', () => {
      const action = { type: uploadDocumentFiles.pending.type };
      const state = documentReducer(initialState, action) as any;
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('fulfilled: resets loading and progress', async () => {
      const store = createTestStore({ loading: true, uploadProgress: 50 });
      const files = [{uri: 'path', name: 'f', status: 'ready'}];
      (documentApi.uploadAttachment as jest.Mock).mockResolvedValue({key: 'k'});

      await store.dispatch(uploadDocumentFiles({files: files as any, companionId: 'c1'}));

      const state = store.getState().documents;
      expect(state.loading).toBe(false);
      expect(state.uploadProgress).toBe(0);
    });

    // COVERAGE: Simulating the progress callback execution
    it('executes progress callback', async () => {
        const store = createTestStore();
        const files = [{uri: 'path', name: 'f', status: 'ready'}];

        // Mock implementation to trigger the callback passed as the 2nd argument
        (documentApi.uploadAttachment as jest.Mock).mockImplementation((file, onProgress) => {
            if(onProgress) onProgress({ loaded: 50, total: 100 });
            return Promise.resolve({ key: 'k1' });
        });

        await store.dispatch(uploadDocumentFiles({files: files as any, companionId: 'c1'}));

        // We can't check the intermediate state easily in integration test,
        // but this ensures the lambda inside the thunk runs.
        expect(documentApi.uploadAttachment).toHaveBeenCalled();
    });

    it('validation: returns empty if no files', async () => {
      const store = createTestStore();
      const res = await store.dispatch(uploadDocumentFiles({files: [], companionId: 'c1'}));
      expect(res.payload).toEqual([]);
    });

    it('validation: filters files already uploaded', async () => {
        const store = createTestStore();
        const files = [
            { key: 'existing', uri: '' }, // Should be skipped
            { uri: 'new', name: 'n', status: 'ready' } // Should be uploaded
        ];
        (documentApi.uploadAttachment as jest.Mock).mockResolvedValue({key: 'new-key'});

        await store.dispatch(uploadDocumentFiles({files: files as any, companionId: 'c1'}));

    });

    it('validation: fails if status not ready', async () => {
        const store = createTestStore();
        const files = [{uri: 'path', status: 'error'}];
        const res = await store.dispatch(uploadDocumentFiles({files: files as any, companionId: 'c1'}));
        expect(res.payload).toContain('Some files are still preparing');
    });

    // COVERAGE: Catch block string conversion
    it('rejected: handles non-Error rejection', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation();
        const store = createTestStore();
        const files = [{uri: 'path', status: 'ready'}];
        (documentApi.uploadAttachment as jest.Mock).mockRejectedValue('String Error');

        const res = await store.dispatch(uploadDocumentFiles({files: files as any, companionId: 'c1'}));
        expect(res.payload).toBe('Failed to upload files');
        spy.mockRestore();
    });
  });

  // --- ADD DOCUMENT ---
  describe('addDocument', () => {
      it('pending: sets loading', () => {
          const action = { type: addDocument.pending.type };
          const state = documentReducer(initialState, action) as any;
          expect(state.loading).toBe(true);
      });

      it('fulfilled: adds to list', async () => {
          const store = createTestStore({ documents: [] });
          const newDoc = {id: 'new'};
          (documentApi.create as jest.Mock).mockResolvedValue(newDoc);

          await store.dispatch(addDocument({} as any));

          const state = store.getState().documents;
          expect(state.loading).toBe(false);
          expect(state.documents).toContainEqual(newDoc);
      });

      it('rejected: handles failure', async () => {
          const store = createTestStore();
          (documentApi.create as jest.Mock).mockRejectedValue(new Error('Add Fail'));
          await store.dispatch(addDocument({} as any));
          const state = store.getState().documents;
          expect(state.loading).toBe(false);
          expect(state.error).toBe('Add Fail');
      });
  });

  // --- UPDATE DOCUMENT ---
  describe('updateDocument', () => {
      it('pending: sets loading', () => {
          const action = { type: updateDocument.pending.type };
          const state = documentReducer(initialState, action) as any;
          expect(state.loading).toBe(true);
      });

      it('fulfilled: updates existing document and files', async () => {
          const store = createTestStore({
              documents: [{id: '1', title: 'Old', files: [{key: 'f1'}]}]
          });

          (documentApi.update as jest.Mock).mockResolvedValue({
              id: '1', title: 'New', files: [{key: 'f2'}]
          });

          await store.dispatch(updateDocument({documentId: '1'} as any));

          const state = store.getState().documents;
          expect(state.loading).toBe(false);
          const doc = state.documents[0];
          expect(doc.title).toBe('New');
          expect(doc.files).toEqual([{key: 'f2'}]);
      });

      // COVERAGE: Branch where document is not found (pushes new)
      it('fulfilled: pushes new if not found', async () => {
          const store = createTestStore({ documents: [] });
          (documentApi.update as jest.Mock).mockResolvedValue({id: 'new', title: 'New'});

          await store.dispatch(updateDocument({documentId: 'new'} as any));

          expect(store.getState().documents.documents).toHaveLength(1);
      });

      // COVERAGE: Branch where files are NOT in response (preserve existing)
      it('fulfilled: preserves existing files if not in response', async () => {
          const store = createTestStore({
              documents: [{id: '1', title: 'Old', files: [{key: 'f1'}]}]
          });
          (documentApi.update as jest.Mock).mockResolvedValue({id: '1', title: 'New'}); // No files

          await store.dispatch(updateDocument({documentId: '1'} as any));

          expect(store.getState().documents.documents[0].files).toEqual([{key: 'f1'}]);
      });
  });

  // --- DELETE DOCUMENT ---
  describe('deleteDocument', () => {
      it('pending: sets loading', () => {
          const action = { type: deleteDocument.pending.type };
          const state = documentReducer(initialState, action) as any;
          expect(state.loading).toBe(true);
      });

      it('fulfilled: removes document', async () => {
          const store = createTestStore({ documents: [{id: '1'}, {id: '2'}] });
          (documentApi.remove as jest.Mock).mockResolvedValue({});

          await store.dispatch(deleteDocument({documentId: '1'}));

          const state = store.getState().documents;
          expect(state.loading).toBe(false);
          expect(state.documents).toHaveLength(1);
          expect(state.documents[0].id).toBe('2');
      });

      // COVERAGE: Branch where document ID doesn't exist (no-op)
      it('fulfilled: does nothing if id not found', async () => {
          const store = createTestStore({ documents: [{id: '1'}] });
          (documentApi.remove as jest.Mock).mockResolvedValue({});

          await store.dispatch(deleteDocument({documentId: '99'}));

          expect(store.getState().documents.documents).toHaveLength(1);
      });
  });

  // --- VIEW DOCUMENT ---
  describe('fetchDocumentView', () => {
      it('pending: sets viewLoading for ID', () => {
          const action = {
              type: fetchDocumentView.pending.type,
              meta: { arg: { documentId: '123' } }
          };
          const state = documentReducer(initialState, action) as any;
          expect(state.viewLoading['123']).toBe(true);
      });

      it('fulfilled: updates doc and clears loading', async () => {
          const store = createTestStore({
              documents: [{id: '1', files: []}],
              viewLoading: { '1': true }
          });
          (documentApi.fetchView as jest.Mock).mockResolvedValue([{key: 'k'}]);

          await store.dispatch(fetchDocumentView({documentId: '1'}));

          const state = store.getState().documents;
          expect(state.viewLoading['1']).toBe(false);
          expect(state.documents[0].files).toEqual([{key: 'k'}]);
      });

      it('rejected: sets error and clears loading', async () => {
          const store = createTestStore({ viewLoading: { '1': true } });
          (documentApi.fetchView as jest.Mock).mockRejectedValue(new Error('Fail'));

          await store.dispatch(fetchDocumentView({documentId: '1'}));

          const state = store.getState().documents;
          expect(state.viewLoading['1']).toBe(false);
          expect(state.error).toBe('Fail');
      });
  });

  // --- SEARCH DOCUMENTS ---
  describe('searchDocuments', () => {
      it('pending: sets searchLoading', () => {
          const action = { type: searchDocuments.pending.type };
          const state = documentReducer(initialState, action) as any;
          expect(state.searchLoading).toBe(true);
      });

      it('fulfilled: sets searchResults', async () => {
          const store = createTestStore();
          const results = [{id: '1'}];
          (documentApi.search as jest.Mock).mockResolvedValue(results);

          await store.dispatch(searchDocuments({companionId: 'c1', query: 'q'}));

          const state = store.getState().documents;
          expect(state.searchLoading).toBe(false);
          expect(state.searchResults).toEqual(results);
      });

      it('rejected: sets searchError', async () => {
          const store = createTestStore();
          (documentApi.search as jest.Mock).mockRejectedValue(new Error('Search Fail'));

          await store.dispatch(searchDocuments({companionId: 'c1', query: 'q'}));

          const state = store.getState().documents;
          expect(state.searchLoading).toBe(false);
          expect(state.searchError).toBe('Search Fail');
      });
  });

  // ====================================================
  // 4. MANUAL REDUCER BRANCH COVERAGE (Fallback Errors)
  // ====================================================
  describe('Reducer Branch Coverage (Manual Actions)', () => {

      const getMeta = (type: string) => {
          if(type.includes('fetchDocumentView')) return { arg: { documentId: '1' } };
          return {};
      };

      const testErrorBranches = (actionType: string, stateKey: 'error' | 'searchError' = 'error') => {
          const meta = getMeta(actionType);

          it(`${actionType}: uses payload`, () => {
              const action = { type: actionType, payload: 'PayloadErr', error: {}, meta };
              const state = documentReducer(initialState, action) as any;
              expect(state[stateKey]).toBe('PayloadErr');
          });

          it(`${actionType}: uses error.message`, () => {
              const action = { type: actionType, payload: undefined, error: { message: 'MsgErr' }, meta };
              const state = documentReducer(initialState, action) as any;
              expect(state[stateKey]).toBe('MsgErr');
          });

          it(`${actionType}: fallbacks to null`, () => {
              const action = { type: actionType, payload: undefined, error: {}, meta };
              const state = documentReducer(initialState, action) as any;
              expect(state[stateKey]).toBeNull();
          });
      };

      describe('Fetch Rejections', () => testErrorBranches(fetchDocuments.rejected.type));
      describe('Upload Rejections', () => testErrorBranches(uploadDocumentFiles.rejected.type));
      describe('Add Rejections', () => testErrorBranches(addDocument.rejected.type));
      describe('Update Rejections', () => testErrorBranches(updateDocument.rejected.type));
      describe('Delete Rejections', () => testErrorBranches(deleteDocument.rejected.type));
      describe('Search Rejections', () => testErrorBranches(searchDocuments.rejected.type, 'searchError'));
      describe('View Rejections', () => testErrorBranches(fetchDocumentView.rejected.type));
  });

});