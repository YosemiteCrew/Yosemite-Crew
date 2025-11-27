import {createAsyncThunk, createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {Document, DocumentFile} from '@/features/documents/types';
import {documentApi} from '@/features/documents/services/documentService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';

interface DocumentState {
  documents: Document[];
  loading: boolean;
  fetching: boolean;
  error: string | null;
  uploadProgress: number;
  viewLoading: Record<string, boolean>;
  searchResults: Document[];
  searchLoading: boolean;
  searchError: string | null;
}

const initialState: DocumentState = {
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

const ensureAccessToken = async (): Promise<string> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return accessToken;
};

export const fetchDocuments = createAsyncThunk<
  {companionId: string; documents: Document[]},
  {companionId: string},
  {rejectValue: string}
>('documents/fetchDocuments', async ({companionId}, {rejectWithValue}) => {
  try {
    if (!companionId) {
      throw new Error('Please select a pet to load documents.');
    }

    const accessToken = await ensureAccessToken();
    const documents = await documentApi.list({companionId, accessToken});
    return {companionId, documents};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch documents',
    );
  }
});

export const uploadDocumentFiles = createAsyncThunk<
  DocumentFile[],
  {files: DocumentFile[]; companionId: string},
  {rejectValue: string}
>('documents/uploadFiles', async ({files, companionId}, {rejectWithValue, dispatch}) => {
  try {
    if (!companionId) {
      throw new Error('Please select a pet to upload documents.');
    }

    if (!files.length) {
      return [];
    }

    const notReady = files.filter(file => {
      if (file.key) {
        return false;
      }
      if (!file.uri?.trim()) {
        return true;
      }
      if (file.status && file.status !== 'ready') {
        return true;
      }
      return false;
    });
    if (notReady.length) {
      throw new Error(
        'Some files are still preparing or could not be read. Please reselect and try again.',
      );
    }

    const accessToken = await ensureAccessToken();
    const uploaded: DocumentFile[] = [];
    let processed = 0;

    for (const file of files) {
      try {
        const uploadedFile = await documentApi.uploadAttachment({
          file,
          companionId,
          accessToken,
        });
        uploaded.push(uploadedFile);
      } catch (error) {
        // Log individual file upload errors but provide context
        console.error('[uploadDocumentFiles] Error uploading file', {
          fileName: file.name,
          fileUri: file.uri,
          fileSize: file.size,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw to fail the entire batch
      }
      processed += 1;
      dispatch(setUploadProgress(Math.round((processed / files.length) * 100)));
    }

    dispatch(setUploadProgress(0));
    return uploaded;
  } catch (error) {
    dispatch(setUploadProgress(0));
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to upload files',
    );
  }
});

export const addDocument = createAsyncThunk<
  Document,
  {
    companionId: string;
    category: string;
    subcategory: string | null;
    visitType: string | null;
    title: string;
    businessName: string;
    issueDate: string;
    files: DocumentFile[];
    appointmentId?: string;
  },
  {rejectValue: string}
>('documents/addDocument', async (payload, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await documentApi.create({...payload, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to add document',
    );
  }
});

export const updateDocument = createAsyncThunk<
  Document,
  {
    documentId: string;
    companionId?: string;
    category: string;
    subcategory: string | null;
    visitType: string | null;
    title: string;
    businessName: string;
    issueDate: string;
    files?: DocumentFile[];
  },
  {rejectValue: string}
>('documents/updateDocument', async (payload, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await documentApi.update({...payload, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update document',
    );
  }
});

export const deleteDocument = createAsyncThunk<
  string,
  {documentId: string},
  {rejectValue: string}
>('documents/deleteDocument', async ({documentId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await documentApi.remove({documentId, accessToken});
    return documentId;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete document',
    );
  }
});

export const fetchDocumentView = createAsyncThunk<
  {documentId: string; files: DocumentFile[]},
  {documentId: string},
  {state: RootState; rejectValue: string}
>('documents/fetchDocumentView', async ({documentId}, {getState, rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const existing =
      getState().documents.documents.find(doc => doc.id === documentId)?.files ?? [];
    const files = await documentApi.fetchView({
      documentId,
      accessToken,
      existingFiles: existing,
    });
    return {documentId, files};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to load document',
    );
  }
});

export const searchDocuments = createAsyncThunk<
  Document[],
  {companionId: string; query: string},
  {rejectValue: string}
>('documents/searchDocuments', async ({companionId, query}, {rejectWithValue}) => {
  try {
    if (!query.trim()) {
      return [];
    }
    const accessToken = await ensureAccessToken();
    return await documentApi.search({companionId, query, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to search documents',
    );
  }
});

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    clearError: state => {
      state.error = null;
      state.searchError = null;
    },
    clearSearchResults: state => {
      state.searchResults = [];
      state.searchError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchDocuments.pending, state => {
        state.fetching = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.fetching = false;
        const companionId = action.payload.companionId;
        state.documents = state.documents.filter(doc => doc.companionId !== companionId);
        state.documents.push(...action.payload.documents);
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.fetching = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(uploadDocumentFiles.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadDocumentFiles.fulfilled, state => {
        state.loading = false;
      })
      .addCase(uploadDocumentFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(addDocument.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.documents.push(action.payload);
      })
      .addCase(addDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(updateDocument.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDocument.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.documents.findIndex(doc => doc.id === action.payload.id);
        if (index === -1) {
          state.documents.push(action.payload);
          return;
        }

        const existing = state.documents[index];
        const nextFiles = action.payload.files?.length ? action.payload.files : existing.files;
        state.documents[index] = {
          ...existing,
          ...action.payload,
          files: nextFiles,
        };
      })
      .addCase(updateDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(deleteDocument.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = state.documents.filter(doc => doc.id !== action.payload);
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(fetchDocumentView.pending, (state, action) => {
        state.viewLoading[action.meta.arg.documentId] = true;
        state.error = null;
      })
      .addCase(fetchDocumentView.fulfilled, (state, action) => {
        state.viewLoading[action.payload.documentId] = false;
        const index = state.documents.findIndex(doc => doc.id === action.payload.documentId);
        if (index === -1) {
          return;
        }
        state.documents[index] = {
          ...state.documents[index],
          files: action.payload.files,
        };
      })
      .addCase(fetchDocumentView.rejected, (state, action) => {
        state.viewLoading[action.meta.arg.documentId] = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(searchDocuments.pending, state => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchDocuments.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchDocuments.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = (action.payload as string) ?? action.error.message ?? null;
      });
  },
});

export const {setUploadProgress, clearError, clearSearchResults} = documentSlice.actions;
export default documentSlice.reducer;
