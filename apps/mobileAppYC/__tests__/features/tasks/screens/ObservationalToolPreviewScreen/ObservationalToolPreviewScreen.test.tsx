import React from 'react';
import {Platform} from 'react-native';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {ObservationalToolPreviewScreen} from '../../../../../src/features/tasks/screens/ObservationalToolPreviewScreen/ObservationalToolPreviewScreen';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  observationToolApi,
  getCachedObservationTool,
  getCachedObservationToolName,
} from '../../../../../src/features/observationalTools/services/observationToolService';

// --- Mocks ---

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        cardBackground: 'white',
        secondary: 'black',
        textSecondary: 'gray',
        error: 'red',
        borderMuted: 'lightgray',
        neutralShadow: 'black',
      },
      spacing: {
        '1': 4,
        '2': 8,
        '3': 12,
        '4': 16,
        '24': 96,
        '28': 112,
      },
      borderRadius: {lg: 8},
      shadows: {base: {}},
      typography: {
        h6Clash: {},
        body12: {},
        body14: {},
        subtitleRegular14: {},
        titleSmall: {},
        paragraphBold: {},
      },
    },
  }),
}));

jest.mock(
  '../../../../../src/features/observationalTools/services/observationToolService',
  () => ({
    observationToolApi: {
      get: jest.fn(),
      previewTaskSubmission: jest.fn(),
    },
    getCachedObservationTool: jest.fn(),
    getCachedObservationToolName: jest.fn(),
  }),
);

// Mock static definitions
jest.mock('../../../../../src/features/observationalTools/data', () => ({
  observationalToolDefinitions: {
    'test-tool': {
      name: 'Test Tool',
      shortName: 'Test',
      overviewTitle: 'Test Overview',
      overviewParagraphs: ['Intro text'],
      heroImage: {uri: 'http://hero.jpg'},
    },
    'stepped-tool': {
      name: 'Stepped Tool',
      shortName: 'Stepped',
      overviewTitle: 'Stepped Overview',
      overviewParagraphs: ['Stepped intro'],
      steps: [{subtitle: 'Watch closely', footerNote: 'Attribution note'}],
    },
    // No shortName: exercises the `?? ''` fallback in normalizeToken when the
    // find() arrow evaluates normalizeToken(def.shortName) with an undefined value.
    'plain-tool': {
      name: 'Plain Tool',
    },
  },
}));

// UI Component Mocks
jest.mock('../../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="mock-header">
        <Text>{title}</Text>
        <View onTouchEnd={onBack} testID="header-back" />
      </View>
    );
  },
}));

jest.mock(
  '../../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({children, header}: any) => {
      const {View} = require('react-native');
      return (
        <View testID="screen-layout">
          {header}
          {children({paddingBottom: 0})}
        </View>
      );
    },
  }),
);

jest.mock(
  '../../../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => ({
    LiquidGlassCard: ({children, style}: any) => {
      const {View} = require('react-native');
      return (
        <View style={style} testID="glass-card">
          {children}
        </View>
      );
    },
  }),
);

describe('ObservationalToolPreviewScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  const mockSubmission = {
    id: 'sub-1',
    toolId: 'test-tool',
    toolName: 'Test Tool',
    createdAt: '2025-01-01T10:00:00Z',
    summary: 'Good result',
    answers: {
      q1: 'Yes',
      q2: ['A', 'B'],
      q3: 10,
      q4: {complex: true},
      q5: null,
    },
  };

  const mockDefinition = {
    id: 'test-tool',
    name: 'Test Tool',
    fields: [
      {key: 'q1', label: 'Question 1'},
      {key: 'q2', label: 'Question 2'},
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useRoute as jest.Mock).mockReturnValue({
      params: {taskId: 'task-1', submissionId: 'sub-1'},
    });

    (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
      mockSubmission,
    );
    (observationToolApi.get as jest.Mock).mockResolvedValue(mockDefinition);
    (getCachedObservationTool as jest.Mock).mockReturnValue(null);
    (getCachedObservationToolName as jest.Mock).mockReturnValue('Test Tool');
  });

  const renderScreen = () => render(<ObservationalToolPreviewScreen />);

  describe('Initialization & Loading', () => {
    it('shows loading state initially', async () => {
      (
        observationToolApi.previewTaskSubmission as jest.Mock
      ).mockImplementation(() => new Promise(() => {}));

      const {getByText} = renderScreen();
      expect(getByText('Loading submission...')).toBeTruthy();
    });

    // The submission-by-id route exists only under /pms, so loading the preview
    // must always go through the task route even when otSubmissionId is known.
    it('fetches via the task preview route even when submissionId is present', async () => {
      renderScreen();
      await waitFor(() => {
        expect(observationToolApi.previewTaskSubmission).toHaveBeenCalledWith(
          'task-1',
        );
      });
      expect(
        (observationToolApi as Record<string, unknown>).getSubmission,
      ).toBeUndefined();
    });

    it('fetches submission by Task ID if submissionId missing', async () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {taskId: 'task-1'},
      });

      renderScreen();

      await waitFor(() => {
        expect(observationToolApi.previewTaskSubmission).toHaveBeenCalledWith(
          'task-1',
        );
      });
    });

    it('loads definition from cache if available', async () => {
      (getCachedObservationTool as jest.Mock).mockReturnValue(mockDefinition);

      renderScreen();

      await waitFor(() => {
        expect(observationToolApi.get).not.toHaveBeenCalled();
      });
    });

    it('fetches definition from API if not in cache', async () => {
      renderScreen();

      await waitFor(() => {
        expect(observationToolApi.get).toHaveBeenCalledWith('test-tool');
      });
    });
  });

  describe('Rendering Content', () => {
    it('renders submission overview correctly', async () => {
      const {getByText, queryByText, findAllByTestId} = renderScreen();

      // Use findByText to wait for asynchronous rendering
      expect(await findAllByTestId('glass-card')).toBeTruthy();

      // Wait for content to appear
      await waitFor(() => expect(getByText('Good result')).toBeTruthy());
      // Exact match: the subtitle must not restate an invented category
      // (e.g. "Pain assessment") for tools that aren't pain assessments.
      expect(getByText(/^Submitted on /)).toBeTruthy();
      expect(queryByText(/Pain assessment/)).toBeNull();

      const cards = await findAllByTestId('glass-card');
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it('renders answer list with formatted values', async () => {
      const {getByText} = renderScreen();

      await waitFor(() => expect(getByText('Responses')).toBeTruthy());

      expect(getByText('Question 1')).toBeTruthy();
      expect(getByText('Yes')).toBeTruthy();
      expect(getByText('Question 2')).toBeTruthy();
      expect(getByText('A, B')).toBeTruthy();
      expect(getByText('q3')).toBeTruthy();
      expect(getByText('10')).toBeTruthy();
      expect(getByText('{"complex":true}')).toBeTruthy();
    });

    it('handles empty/null answers gracefully', async () => {
      const {getByText} = renderScreen();
      await waitFor(() => expect(getByText('Responses')).toBeTruthy());
      expect(getByText('q5')).toBeTruthy();
    });

    it('renders "No responses available" if answers empty', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          ...mockSubmission,
          answers: {},
        },
      );

      const {findByText} = renderScreen();
      expect(await findByText('No responses available.')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('shows a friendly error message (not the raw error) on submission fetch failure', async () => {
      const rawError = new Error('Network Error');
      (observationToolApi.previewTaskSubmission as jest.Mock).mockRejectedValue(
        rawError,
      );
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const {findByText, queryByText} = renderScreen();
      expect(
        await findByText('Unable to load submission. Please try again.'),
      ).toBeTruthy();
      expect(queryByText('Network Error')).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        '[OT Preview] Failed to load submission',
        rawError,
      );

      spy.mockRestore();
    });

    it('shows the same friendly error message if error is not an Error object', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockRejectedValue(
        'String Error',
      );
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const {findByText} = renderScreen();
      expect(
        await findByText('Unable to load submission. Please try again.'),
      ).toBeTruthy();

      spy.mockRestore();
    });

    it('handles definition fetch failure gracefully (warns but renders submission)', async () => {
      (observationToolApi.get as jest.Mock).mockRejectedValue(
        new Error('Def Fail'),
      );
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const {findByText} = renderScreen();

      // Wait for submission content to load despite def failure
      expect(await findByText('Good result')).toBeTruthy();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch tool definition'),
        expect.anything(),
      );
    });

    it('shows "No submission found" if load returns null', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        null,
      );
    });
  });

  describe('Navigation', () => {
    it('navigates back when header back button pressed', async () => {
      const {getByTestId} = renderScreen();

      const backBtn = getByTestId('header-back');
      fireEvent(backBtn, 'onTouchEnd');

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Static definition resolution', () => {
    it('resolves a static definition by tool name when the id is not a known key', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          ...mockSubmission,
          toolId: 'unknown-key',
          toolName: 'Test Tool',
        },
      );

      const {findByText} = renderScreen();

      // Matched by name -> static overview heading is rendered.
      expect(await findByText('Test Overview')).toBeTruthy();
    });

    it('resolves a static definition by short name when the id is not a known key', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          ...mockSubmission,
          toolId: 'unknown-key',
          toolName: 'Test',
        },
      );

      const {findByText} = renderScreen();

      // Matched by shortName -> static overview heading is rendered.
      expect(await findByText('Test Overview')).toBeTruthy();
    });

    it('renders no static overview when neither name nor short name matches', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          ...mockSubmission,
          toolId: 'unknown-key',
          toolName: 'zzz',
          summary: undefined,
        },
      );

      const {findByText, queryByText} = renderScreen();

      // No static match -> falls through the find() (evaluating the shortName-less
      // definition) and renders no explainer heading; summary is also absent.
      expect(await findByText('Responses')).toBeTruthy();
      expect(queryByText('Test Overview')).toBeNull();
      expect(queryByText('Good result')).toBeNull();
    });

    it('renders with no tool identity and no answers', async () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {submissionId: 'sub-9'},
      });
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          id: 'sub-9',
          createdAt: '2025-02-02T09:00:00Z',
        },
      );

      const {findByText} = renderScreen();

      // No toolId/toolName -> toolKey is falsy (definition never fetched),
      // normalizedName is empty (static lookup returns null), answers are nullish.
      expect(await findByText('No responses available.')).toBeTruthy();
      expect(observationToolApi.get).not.toHaveBeenCalled();
    });
  });

  describe('Additional rendering branches', () => {
    it('falls back to the field key when a definition field has no label', async () => {
      (getCachedObservationTool as jest.Mock).mockReturnValue({
        id: 'test-tool',
        name: 'Test Tool',
        fields: [{key: 'q1'}],
      });
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          ...mockSubmission,
          answers: {q1: 'Answer one'},
        },
      );

      const {findByText} = renderScreen();

      expect(await findByText('Answer one')).toBeTruthy();
      // labelMap falls back to the key when field.label is undefined.
      expect(await findByText('q1')).toBeTruthy();
    });

    it('renders the instruction callout and attribution footer from static steps', async () => {
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        {
          ...mockSubmission,
          toolId: 'stepped-tool',
          toolName: 'Stepped Tool',
        },
      );

      const {findByText} = renderScreen();

      expect(await findByText('Watch closely')).toBeTruthy();
      expect(await findByText('Attribution note')).toBeTruthy();
      expect(await findByText('Stepped Overview')).toBeTruthy();
    });

    it('applies the android fallback border style', async () => {
      const originalOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const {findByText} = renderScreen();
        expect(await findByText('Good result')).toBeTruthy();
      } finally {
        Platform.OS = originalOS;
      }
    });
  });

  describe('Unmount guards', () => {
    it('ignores a resolved submission after unmount', async () => {
      let resolveSubmission: (value: unknown) => void = () => {};
      (observationToolApi.previewTaskSubmission as jest.Mock).mockReturnValue(
        new Promise(resolvePromise => {
          resolveSubmission = resolvePromise;
        }),
      );

      const {unmount} = renderScreen();
      unmount();
      await act(async () => {
        resolveSubmission(mockSubmission);
      });

      expect(observationToolApi.previewTaskSubmission).toHaveBeenCalledWith(
        'task-1',
      );
    });

    it('ignores a rejected submission after unmount', async () => {
      let rejectSubmission: (error: unknown) => void = () => {};
      (observationToolApi.previewTaskSubmission as jest.Mock).mockReturnValue(
        new Promise((_resolvePromise, rejectPromise) => {
          rejectSubmission = rejectPromise;
        }),
      );

      const {unmount} = renderScreen();
      unmount();
      await act(async () => {
        rejectSubmission(new Error('too late'));
      });

      expect(observationToolApi.previewTaskSubmission).toHaveBeenCalled();
    });

    it('ignores a resolved definition after unmount', async () => {
      let resolveDef: (value: unknown) => void = () => {};
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        mockSubmission,
      );
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (observationToolApi.get as jest.Mock).mockReturnValue(
        new Promise(resolvePromise => {
          resolveDef = resolvePromise;
        }),
      );

      const {unmount} = renderScreen();
      await waitFor(() => expect(observationToolApi.get).toHaveBeenCalled());
      unmount();
      await act(async () => {
        resolveDef(mockDefinition);
      });

      expect(observationToolApi.get).toHaveBeenCalledWith('test-tool');
    });
  });
});
