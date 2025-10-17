import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import type {Document, DocumentFile, S3UploadParams} from '@/types/document.types';

interface DocumentState {
  documents: Document[];
  loading: boolean;
  error: string | null;
  uploadProgress: number;
}

const initialState: DocumentState = {
  documents: [],
  loading: false,
  error: null,
  uploadProgress: 0,
};

// Mock S3 Upload - Step 1: Request signed URL
const mockRequestSignedUrl = async (
  params: S3UploadParams,
): Promise<{uploadUrl: string; fileUrl: string}> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const fileName = params.fileName.replace(/\s/g, '_');
  const mockUploadUrl = `https://mock-s3-bucket.s3.amazonaws.com/upload/${fileName}?signature=mock-signature`;
  const mockFileUrl = `https://mock-s3-bucket.s3.amazonaws.com/documents/${fileName}`;

  return {
    uploadUrl: mockUploadUrl,
    fileUrl: mockFileUrl,
  };
};

// Mock S3 Upload - Step 2: Upload file to signed URL
const mockUploadToS3 = async (
  uploadUrl: string,
  fileUri: string,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  // Simulate upload progress
  for (let i = 0; i <= 100; i += 20) {
    await new Promise(resolve => setTimeout(resolve, 200));
    onProgress?.(i);
  }
};

// Async thunk for uploading files to S3
export const uploadDocumentFiles = createAsyncThunk<
  DocumentFile[],
  DocumentFile[],
  {rejectValue: string}
>(
  'documents/uploadFiles',
  async (files, {rejectWithValue, dispatch}) => {
    try {
      const uploadedFiles: DocumentFile[] = [];

      for (const file of files) {
        // Step 1: Request signed URL
        const {uploadUrl, fileUrl} = await mockRequestSignedUrl({
          fileName: file.name,
          fileType: file.type,
          fileUri: file.uri,
        });

        // Step 2: Upload to S3
        await mockUploadToS3(uploadUrl, file.uri, progress => {
          dispatch(setUploadProgress(progress));
        });

        // Step 3: Store the uploaded file with S3 URL
        uploadedFiles.push({
          ...file,
          s3Url: fileUrl,
        });
      }

      dispatch(setUploadProgress(0)); // Reset progress
      return uploadedFiles;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to upload files');
    }
  },
);

// Async thunk for adding a document
export const addDocument = createAsyncThunk<
  Document,
  Omit<Document, 'id' | 'createdAt' | 'updatedAt'>,
  {rejectValue: string}
>(
  'documents/addDocument',
  async (documentData, {rejectWithValue}) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const newDocument: Document = {
        ...documentData,
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return newDocument;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to add document');
    }
  },
);

// Async thunk for updating a document
export const updateDocument = createAsyncThunk<
  {documentId: string; updates: Partial<Document>},
  {documentId: string; updates: Partial<Document>},
  {rejectValue: string}
>(
  'documents/updateDocument',
  async ({documentId, updates}, {rejectWithValue}) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        documentId,
        updates: {
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update document');
    }
  },
);

// Async thunk for deleting a document
export const deleteDocument = createAsyncThunk<
  string,
  string,
  {rejectValue: string}
>(
  'documents/deleteDocument',
  async (documentId, {rejectWithValue}) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return documentId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete document');
    }
  },
);

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    // Upload Files
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
        state.error = action.payload as string;
      });

    // Add Document
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
        state.error = action.payload as string;
      });

    // Update Document
    builder
      .addCase(updateDocument.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDocument.fulfilled, (state, action) => {
        state.loading = false;
        const {documentId, updates} = action.payload;
        const index = state.documents.findIndex(doc => doc.id === documentId);
        if (index !== -1) {
          state.documents[index] = {
            ...state.documents[index],
            ...updates,
          };
        }
      })
      .addCase(updateDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Delete Document
    builder
      .addCase(deleteDocument.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = state.documents.filter(
          doc => doc.id !== action.payload,
        );
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {setUploadProgress, clearError} = documentSlice.actions;
export default documentSlice.reducer;
