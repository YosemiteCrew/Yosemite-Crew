import {createFileHandlers} from '@/features/tasks/utils/createFileHandlers';

describe('createFileHandlers', () => {
  let mockOpenSheet: jest.Mock;
  let mockHandleRemoveFile: jest.Mock;
  let mockUploadSheetRef: any;

  beforeEach(() => {
    mockOpenSheet = jest.fn();
    mockHandleRemoveFile = jest.fn();
    // Mock a React ref object structure
    mockUploadSheetRef = {
      current: {
        open: jest.fn(),
      },
    };
  });

  it('returns an object with onAddPress and onRequestRemove', () => {
    const handlers = createFileHandlers(mockOpenSheet, mockUploadSheetRef, mockHandleRemoveFile);
    expect(handlers).toHaveProperty('onAddPress');
    expect(handlers).toHaveProperty('onRequestRemove');
  });

  describe('onAddPress', () => {
    it('opens the "upload" sheet and triggers the ref open method', () => {
      const handlers = createFileHandlers(mockOpenSheet, mockUploadSheetRef, mockHandleRemoveFile);

      handlers.onAddPress();

      expect(mockOpenSheet).toHaveBeenCalledWith('upload');
      expect(mockUploadSheetRef.current.open).toHaveBeenCalledTimes(1);
    });

    it('safely handles null ref (branch coverage for optional chaining)', () => {
      // Simulate ref not being attached yet
      mockUploadSheetRef.current = null;

      const handlers = createFileHandlers(mockOpenSheet, mockUploadSheetRef, mockHandleRemoveFile);

      // Should execute without throwing error due to ?. operator
      expect(() => handlers.onAddPress()).not.toThrow();

      // openSheet should still be called
      expect(mockOpenSheet).toHaveBeenCalledWith('upload');
    });
  });

  describe('onRequestRemove', () => {
    it('calls handleRemoveFile with the provided file ID', () => {
      const handlers = createFileHandlers(mockOpenSheet, mockUploadSheetRef, mockHandleRemoveFile);
      const testFileId = 'file-123-abc';

      handlers.onRequestRemove(testFileId);

      expect(mockHandleRemoveFile).toHaveBeenCalledWith(testFileId);
    });
  });
});