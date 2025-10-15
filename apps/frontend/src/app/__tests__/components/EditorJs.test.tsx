import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditorJSRenderer from '@/app/components/EditorJs/EditorJs';
import EditorJS from '@editorjs/editorjs';
import axios from 'axios';

const mockSave = jest.fn().mockResolvedValue({ blocks: [] });
const mockDestroy = jest.fn();
let editorOnChange: () => void = () => {};

jest.mock('@editorjs/editorjs');

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MockedEditorJS = EditorJS as unknown as jest.Mock;

describe('EditorJSRenderer Component', () => {
  const mockOnChange = jest.fn();
  const initialData = { blocks: [{ type: 'paragraph', data: { text: 'Initial data' } }] };
  const mockEditorJSInstance = { save: mockSave, destroy: mockDestroy };

  beforeEach(() => {
    MockedEditorJS.mockImplementation((config) => {
      if (config.onChange) {
        editorOnChange = config.onChange;
      }
      return mockEditorJSInstance;
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize EditorJS on mount with correct configuration', () => {
    render(<EditorJSRenderer data={initialData} onChange={mockOnChange} />);
    expect(MockedEditorJS).toHaveBeenCalledTimes(1);
    expect(MockedEditorJS).toHaveBeenCalledWith(expect.objectContaining({ data: initialData }));
  });

  it('should call the onChange prop when editor content changes', async () => {
    mockSave.mockResolvedValueOnce({ blocks: [{ type: 'paragraph', data: { text: 'New content' } }] });
    render(<EditorJSRenderer data={initialData} onChange={mockOnChange} />);

    act(() => {
      editorOnChange();
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ blocks: [{ type: 'paragraph', data: { text: 'New content' } }] });
    });
  });

  it('should call destroy on unmount if instance exists and has destroy method', () => {
    const { unmount } = render(<EditorJSRenderer data={initialData} onChange={mockOnChange} />);
    unmount();
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('should not call destroy on unmount if instance is null', () => {
    jest.spyOn(React, 'useRef').mockReturnValueOnce({ current: null });
    const { unmount } = render(<EditorJSRenderer data={initialData} onChange={mockOnChange} />);
    unmount();
  });

  it('should not call destroy on unmount if destroy is not a function', () => {
    MockedEditorJS.mockReturnValueOnce({ save: mockSave, destroy: 'not-a-function' });
    const { unmount } = render(<EditorJSRenderer data={initialData} onChange={mockOnChange} />);
    unmount();
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  describe('Image Uploader', () => {
    const mockFile = new File(['dummy content'], 'test-image.png', { type: 'image/png' });

    it('should handle successful image upload', async () => {
      const mockUrl = 'https://example.com/image.jpg';
      mockedAxios.post.mockResolvedValue({ data: { file: { url: mockUrl } } });
      render(<EditorJSRenderer data={{}} onChange={mockOnChange} />);
      const editorConfig = MockedEditorJS.mock.calls[0][0];
      const uploader = editorConfig.tools.image.config.uploader;
      const result = await uploader.uploadByFile(mockFile);
      expect(result).toEqual({ success: 1, file: { url: mockUrl } });
    });

    it('should handle failed image upload due to network error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));
      render(<EditorJSRenderer data={{}} onChange={mockOnChange} />);
      const editorConfig = MockedEditorJS.mock.calls[0][0];
      const uploader = editorConfig.tools.image.config.uploader;
      const result = await uploader.uploadByFile(mockFile);
      expect(result).toEqual({ success: 0 });
      expect(consoleErrorSpy).toHaveBeenCalledWith("Image upload failed:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should handle failed image upload due to missing URL in response', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedAxios.post.mockResolvedValue({ data: { file: {} } });
      render(<EditorJSRenderer data={{}} onChange={mockOnChange} />);
      const editorConfig = MockedEditorJS.mock.calls[0][0];
      const uploader = editorConfig.tools.image.config.uploader;
      const result = await uploader.uploadByFile(mockFile);
      expect(result).toEqual({ success: 0 });
      expect(consoleErrorSpy).toHaveBeenCalledWith("Image upload failed:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
