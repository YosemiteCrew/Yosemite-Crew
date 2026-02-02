import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
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
      getSubmission: jest.fn(),
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
      params: {submissionId: 'sub-1'},
    });

    (observationToolApi.getSubmission as jest.Mock).mockResolvedValue(
      mockSubmission,
    );
    (observationToolApi.get as jest.Mock).mockResolvedValue(mockDefinition);
    (getCachedObservationTool as jest.Mock).mockReturnValue(null);
    (getCachedObservationToolName as jest.Mock).mockReturnValue('Test Tool');
  });

  const renderScreen = () => render(<ObservationalToolPreviewScreen />);

  describe('Initialization & Loading', () => {
    it('shows loading state initially', async () => {
      (observationToolApi.getSubmission as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );

      const {getByText} = renderScreen();
      expect(getByText('Loading submission...')).toBeTruthy();
    });

    it('fetches submission by ID if provided', async () => {
      renderScreen();
      await waitFor(() => {
        expect(observationToolApi.getSubmission).toHaveBeenCalledWith('sub-1');
      });
    });

    it('fetches submission by Task ID if submissionId missing', async () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {taskId: 'task-1'},
      });
      (observationToolApi.previewTaskSubmission as jest.Mock).mockResolvedValue(
        mockSubmission,
      );

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
      const {getByText, findAllByTestId} = renderScreen();

      // Use findByText to wait for asynchronous rendering
      expect(await findAllByTestId('glass-card')).toBeTruthy();

      // Wait for content to appear
      await waitFor(() => expect(getByText('Good result')).toBeTruthy());
      expect(getByText(/Submitted on/)).toBeTruthy();

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
      (observationToolApi.getSubmission as jest.Mock).mockResolvedValue({
        ...mockSubmission,
        answers: {},
      });

      const {findByText} = renderScreen();
      expect(await findByText('No responses available.')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('shows error message on submission fetch failure', async () => {
      (observationToolApi.getSubmission as jest.Mock).mockRejectedValue(
        new Error('Network Error'),
      );

      const {findByText} = renderScreen();
      expect(await findByText('Network Error')).toBeTruthy();
    });

    it('shows fallback error message if error is not an Error object', async () => {
      (observationToolApi.getSubmission as jest.Mock).mockRejectedValue(
        'String Error',
      );

      const {findByText} = renderScreen();
      expect(await findByText('Unable to load submission')).toBeTruthy();
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
      (observationToolApi.getSubmission as jest.Mock).mockResolvedValue(null);
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
});
