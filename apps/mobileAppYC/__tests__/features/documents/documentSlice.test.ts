// __tests__/features/documents/documentSlice.test.ts
import documentReducer, {
  setUploadProgress,
  clearError,
  uploadDocumentFiles,
  addDocument,
  updateDocument,
  deleteDocument,
} from '@/features/documents/documentSlice';
import type {Document, DocumentFile} from '@/types/document.types';

// Mock setTimeout to speed up tests
jest.useFakeTimers();

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

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should return the initial state', () => {
      expect(documentReducer(undefined, {type: 'unknown'})).toEqual(
        initialState
      );
    });
  });

  describe('reducers', () => {
    describe('setUploadProgress', () => {
      it('should set upload progress to 0', () => {
        const state = documentReducer(
          {...initialState, uploadProgress: 50},
          setUploadProgress(0)
        );
        expect(state.uploadProgress).toBe(0);
      });

      it('should set upload progress to 50', () => {
        const state = documentReducer(
          initialState,
          setUploadProgress(50)
        );
        expect(state.uploadProgress).toBe(50);
      });

      it('should set upload progress to 100', () => {
        const state = documentReducer(
          initialState,
          setUploadProgress(100)
        );
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
        const stateWithError = {
          ...initialState,
          error: 'Upload failed',
        };
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

  describe('extraReducers - uploadDocumentFiles', () => {
    const files: DocumentFile[] = [mockDocumentFile];

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        {...initialState, error: 'previous error'},
        uploadDocumentFiles.pending('requestId', files)
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set loading to false on fulfilled', () => {
      const uploadedFiles: DocumentFile[] = [{
        ...mockDocumentFile,
        s3Url: 'https://mock-s3-bucket.s3.amazonaws.com/documents/test-document.pdf',
      }];

      const state = documentReducer(
        {...initialState, loading: true},
        uploadDocumentFiles.fulfilled(uploadedFiles, 'requestId', files)
      );
      expect(state.loading).toBe(false);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to upload files';
      const state = documentReducer(
        {...initialState, loading: true},
        uploadDocumentFiles.rejected(
          new Error(errorMessage),
          'requestId',
          files,
          errorMessage
        )
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
      const state = documentReducer({...initialState, loading: true}, action);
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
      title: 'New Document',
      businessName: 'Vet Clinic',
      issueDate: '2024-01-20',
      files: [mockDocumentFile],
      isSynced: false,
    };

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        {...initialState, error: 'previous error'},
        addDocument.pending('requestId', newDocumentData)
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should add document on fulfilled', () => {
      const state = documentReducer(
        {...initialState, loading: true},
        addDocument.fulfilled(mockDocument, 'requestId', newDocumentData)
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument]);
      expect(state.documents).toHaveLength(1);
    });

    it('should append to existing documents on fulfilled', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };
      const state = documentReducer(
        stateWithDocuments,
        addDocument.fulfilled(mockDocument2, 'requestId', newDocumentData)
      );
      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument, mockDocument2]);
      expect(state.documents).toHaveLength(2);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to add document';
      const state = documentReducer(
        {...initialState, loading: true},
        addDocument.rejected(
          new Error(errorMessage),
          'requestId',
          newDocumentData,
          errorMessage
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle rejected with custom error payload', () => {
      const customError = 'Validation error';
      const action = {
        type: addDocument.rejected.type,
        payload: customError,
      };
      const state = documentReducer({...initialState, loading: true}, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

  describe('extraReducers - updateDocument', () => {
    const updatePayload = {
      documentId: 'doc_1',
      updates: {
        title: 'Updated Title',
        businessName: 'Updated Clinic',
      },
    };

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        {...initialState, error: 'previous error'},
        updateDocument.pending('requestId', updatePayload)
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

      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(
          {
            documentId: 'doc_1',
            updates: {
              title: 'Updated Title',
              businessName: 'Updated Clinic',
              updatedAt: '2024-01-20T10:00:00.000Z',
            },
          },
          'requestId',
          updatePayload
        )
      );

      expect(state.loading).toBe(false);
      expect(state.documents[0].title).toBe('Updated Title');
      expect(state.documents[0].businessName).toBe('Updated Clinic');
      expect(state.documents[0].updatedAt).toBe('2024-01-20T10:00:00.000Z');
      expect(state.documents[1]).toEqual(mockDocument2);
    });

    it('should not update if document not found', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument2],
        loading: true,
      };

      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(
          {
            documentId: 'non_existent_id',
            updates: {title: 'Should Not Update'},
          },
          'requestId',
          {documentId: 'non_existent_id', updates: {title: 'Should Not Update'}}
        )
      );

      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument2]);
      expect(state.documents[0].title).toBe('Vaccination Record');
    });

    it('should partially update document fields', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };

      const state = documentReducer(
        stateWithDocuments,
        updateDocument.fulfilled(
          {
            documentId: 'doc_1',
            updates: {title: 'Only Title Updated'},
          },
          'requestId',
          {documentId: 'doc_1', updates: {title: 'Only Title Updated'}}
        )
      );

      expect(state.documents[0].title).toBe('Only Title Updated');
      expect(state.documents[0].businessName).toBe('Veterinary Clinic');
      expect(state.documents[0].category).toBe('medical');
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to update document';
      const state = documentReducer(
        {...initialState, loading: true},
        updateDocument.rejected(
          new Error(errorMessage),
          'requestId',
          updatePayload,
          errorMessage
        )
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
      const state = documentReducer({...initialState, loading: true}, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

  describe('extraReducers - deleteDocument', () => {
    const documentId = 'doc_1';

    it('should set loading to true and clear error on pending', () => {
      const state = documentReducer(
        {...initialState, error: 'previous error'},
        deleteDocument.pending('requestId', documentId)
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
        deleteDocument.fulfilled('doc_1', 'requestId', documentId)
      );

      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument2]);
      expect(state.documents).toHaveLength(1);
    });

    it('should delete the last document', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument],
        loading: true,
      };

      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled('doc_1', 'requestId', documentId)
      );

      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([]);
      expect(state.documents).toHaveLength(0);
    });

    it('should not delete if document not found', () => {
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument, mockDocument2],
        loading: true,
      };

      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled('non_existent_id', 'requestId', 'non_existent_id')
      );

      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument, mockDocument2]);
      expect(state.documents).toHaveLength(2);
    });

    it('should delete from middle of array', () => {
      const mockDocument3: Document = {...mockDocument, id: 'doc_3', title: 'Third Doc'};
      const stateWithDocuments = {
        ...initialState,
        documents: [mockDocument, mockDocument2, mockDocument3],
        loading: true,
      };

      const state = documentReducer(
        stateWithDocuments,
        deleteDocument.fulfilled('doc_2', 'requestId', 'doc_2')
      );

      expect(state.loading).toBe(false);
      expect(state.documents).toEqual([mockDocument, mockDocument3]);
      expect(state.documents).toHaveLength(2);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to delete document';
      const state = documentReducer(
        {...initialState, loading: true},
        deleteDocument.rejected(
          new Error(errorMessage),
          'requestId',
          documentId,
          errorMessage
        )
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
      const state = documentReducer({...initialState, loading: true}, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(customError);
    });
  });

});
