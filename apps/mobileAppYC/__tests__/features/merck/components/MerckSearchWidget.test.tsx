import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {MerckSearchWidget} from '@/features/merck/components/MerckSearchWidget';
import {merckApi} from '@/features/merck/services/merckService';
import {isTokenExpired} from '@/features/auth/sessionManager';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    merckLogo: {uri: 'merck-logo'},
    closeIcon: {uri: 'close-icon'},
    yosemiteLoader: {uri: 'loader-gif'},
  },
}));

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(async () => ({
    accessToken: 'token-1',
    expiresAt: Date.now() + 60_000,
  })),
  isTokenExpired: jest.fn(() => false),
}));

jest.mock('@/features/merck/services/merckService', () => ({
  merckApi: {
    searchManuals: jest.fn(),
  },
  isAllowedMerckUrl: jest.fn((url: string) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol !== 'https:') {
        return false;
      }
      return host === 'msdvetmanual.com' || host.endsWith('.msdvetmanual.com');
    } catch {
      return false;
    }
  }),
}));

jest.mock('@/shared/components/common/SearchBar/SearchBar', () => ({
  SearchBar: ({value, onChangeText, onSubmitEditing}: any) => {
    const ReactNative = require('react-native');
    return (
      <ReactNative.TextInput
        testID="merck-search-input"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
      />
    );
  },
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children, glassEffect}: any) => {
    const ReactNative = require('react-native');
    return (
      <ReactNative.View
        testID={
          glassEffect === 'clear' ? 'glass-card-clear' : 'glass-card-default'
        }>
        {children}
      </ReactNative.View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, disabled}: any) => {
      const ReactNative = require('react-native');
      return (
        <ReactNative.TouchableOpacity onPress={onPress} disabled={disabled}>
          <ReactNative.Text>{title}</ReactNative.Text>
        </ReactNative.TouchableOpacity>
      );
    },
  }),
);

describe('MerckSearchWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it('searches and opens allowed MSD links in the system browser', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 1,
      },
      entries: [
        {
          id: 'entry-1',
          title: 'Rhinitis in Dogs',
          summaryText: 'Summary text',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/topic',
          subLinks: [],
        },
      ],
    });

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'rhinitis');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(merckApi.searchManuals).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          query: 'rhinitis',
        }),
      );
    });

    fireEvent.press(getByText('Open'));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://www.msdvetmanual.com/topic',
      );
    });
  });

  it('shows empty-state only after explicit search', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-2',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 0,
      },
      entries: [],
    });

    const {getByText, queryByText} = render(
      <MerckSearchWidget organisationId="org-1" initialQuery="rhinitis" />,
    );

    expect(queryByText('No manuals found for this search.')).toBeNull();

    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(getByText('No manuals found')).toBeTruthy();
    });
  });

  it('opens full search with cached query and results from compact widget', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-3',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 3,
      },
      entries: [
        {
          id: 'entry-1',
          title: 'One',
          summaryText: 'Summary one',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/one',
          subLinks: [],
        },
        {
          id: 'entry-2',
          title: 'Two',
          summaryText: 'Summary two',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/two',
          subLinks: [],
        },
        {
          id: 'entry-3',
          title: 'Three',
          summaryText: 'Summary three',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/three',
          subLinks: [],
        },
      ],
    });

    const onOpenFullSearch = jest.fn();
    const {getByTestId, getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        compact
        onOpenFullSearch={onOpenFullSearch}
      />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'rhinitis');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(getByText('View more in full search')).toBeTruthy();
    });

    fireEvent.press(getByText('View more in full search'));

    expect(onOpenFullSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'rhinitis',
        language: 'en',
        hasSearched: true,
      }),
    );

    expect(onOpenFullSearch.mock.calls[0][0].entries).toHaveLength(3);
  });

  it('uses only search-area glass card in compact mode', () => {
    const {getByTestId, queryByTestId} = render(
      <MerckSearchWidget organisationId="org-1" compact />,
    );

    expect(getByTestId('glass-card-clear')).toBeTruthy();
    expect(queryByTestId('glass-card-default')).toBeNull();
  });

  it('handles search API errors gracefully', async () => {
    (merckApi.searchManuals as jest.Mock).mockRejectedValue(
      new Error('API Error'),
    );

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'test');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(merckApi.searchManuals).toHaveBeenCalled();
    });
  });

  it('initializes with provided initial values', () => {
    const initialEntries = [
      {
        id: 'e1',
        title: 'Initial Entry',
        summaryText: 'Test',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://www.msdvetmanual.com/test',
        subLinks: [],
      },
    ];

    const {getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialQuery="test"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    expect(getByText('Initial Entry')).toBeTruthy();
  });

  it('handles language selection', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'es',
        totalResults: 0,
      },
      entries: [],
    });

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" initialLanguage="es" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'test');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(merckApi.searchManuals).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'es',
        }),
      );
    });
  });

  it('displays no results message when search returns empty', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 0,
      },
      entries: [],
    });

    const {getByTestId, getByText, queryByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'nonexistent');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(queryByText(/no.*found/i)).toBeTruthy();
    });
  });

  it('prevents empty search queries', () => {
    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), '');
    fireEvent.press(getByText('Search'));

    expect(merckApi.searchManuals).not.toHaveBeenCalled();
  });

  it('blocks non-MSD manual URLs before opening the browser', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 1,
      },
      entries: [
        {
          id: 'e1',
          title: 'Test',
          summaryText: 'Summary',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/test',
          subLinks: [],
        },
      ],
    });

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'test');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(merckApi.searchManuals).toHaveBeenCalled();
    });

    fireEvent.press(getByText('Open'));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://www.msdvetmanual.com/test',
      );
    });
  });

  it('displays initial data on mount if initialHasSearched is true', () => {
    const initialEntries = [
      {
        id: 'e1',
        title: 'Initial Entry',
        summaryText: 'Test',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://www.msdvetmanual.com/test',
        subLinks: [],
      },
    ];

    const {getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialQuery="test"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    expect(getByText('Initial Entry')).toBeTruthy();
  });

  it('handles concurrent search requests', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'req-1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 1,
      },
      entries: [
        {
          id: 'e1',
          title: 'Result 1',
          summaryText: 'Test',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/test',
          subLinks: [],
        },
      ],
    });

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'query1');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(merckApi.searchManuals).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'query1',
        }),
      );
    });

    // Verify first search result displayed
    await waitFor(() => {
      expect(getByText('Result 1')).toBeTruthy();
    });
  });

  it('clears entries when an empty query is keyboard-submitted', () => {
    const initialEntries = [
      {
        id: 'e1',
        title: 'Existing Entry',
        summaryText: '',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://www.msdvetmanual.com/topic',
        subLinks: [],
      },
    ];

    const {getByTestId, queryByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    expect(queryByText('Existing Entry')).toBeTruthy();

    fireEvent(getByTestId('merck-search-input'), 'submitEditing');

    expect(merckApi.searchManuals).not.toHaveBeenCalled();
    expect(queryByText('Existing Entry')).toBeNull();
  });

  it('shows blocked URL error when openInReader is called with a non-Merck primaryUrl', () => {
    const initialEntries = [
      {
        id: 'e1',
        title: 'External Entry',
        summaryText: '',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://evil.com/topic',
        subLinks: [],
      },
    ];

    const {getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    fireEvent.press(getByText('Open'));

    expect(
      getByText(
        'Blocked URL: only MSD Veterinary Manual consumer links are allowed.',
      ),
    ).toBeTruthy();
  });

  it('opens a sublink pill in the system browser', async () => {
    const initialEntries = [
      {
        id: 'e1',
        title: 'Topic',
        summaryText: '',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://www.msdvetmanual.com/topic',
        subLinks: [
          {
            label: 'Etiology',
            url: 'https://www.msdvetmanual.com/etiology',
          },
        ],
      },
    ];

    const {getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    fireEvent.press(getByText('Etiology'));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://www.msdvetmanual.com/etiology',
      );
    });
  });

  it('shows idle state with logo and description before any search in non-compact mode', () => {
    const {getByText} = render(<MerckSearchWidget organisationId="org-1" />);
    expect(getByText('Search medical topics')).toBeTruthy();
    expect(getByText(/Find consumer-friendly/)).toBeTruthy();
  });

  it('renders sublink pills covering all getMerckSubtopicPillColors branches', () => {
    const initialEntries = [
      {
        id: 'e1',
        title: 'Medical Topic',
        summaryText: '',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://www.msdvetmanual.com/topic',
        subLinks: [
          {label: 'Full Summary', url: 'https://www.msdvetmanual.com/full'},
          {label: 'Etiology', url: 'https://www.msdvetmanual.com/etiology'},
          {
            label: 'Symptoms and Signs',
            url: 'https://www.msdvetmanual.com/symptoms',
          },
          {label: 'Diagnosis', url: 'https://www.msdvetmanual.com/diagnosis'},
          {label: 'Treatment', url: 'https://www.msdvetmanual.com/treatment'},
          {label: 'Prognosis', url: 'https://www.msdvetmanual.com/prognosis'},
        ],
      },
    ];

    const {getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    expect(getByText('Full Summary')).toBeTruthy();
    expect(getByText('Etiology')).toBeTruthy();
    expect(getByText('Symptoms and Signs')).toBeTruthy();
    expect(getByText('Diagnosis')).toBeTruthy();
    expect(getByText('Treatment')).toBeTruthy();
    expect(getByText('Prognosis')).toBeTruthy();
  });

  it('strips HTML tags from entry title and summary via sanitizeTextForDisplay', () => {
    const initialEntries = [
      {
        id: 'e1',
        title: '<em>Rhinitis</em> in <strong>Dogs</strong>',
        summaryText: '<p>Nasal <b>inflammation</b> overview.</p>',
        updatedAt: null,
        audience: 'PAT',
        primaryUrl: 'https://www.msdvetmanual.com/topic',
        subLinks: [],
      },
    ];

    const {getByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        initialEntries={initialEntries}
        initialHasSearched
      />,
    );

    expect(getByText('Rhinitis in Dogs')).toBeTruthy();
  });

  it('shows unavailable error when organisationId is null', async () => {
    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId={null} />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'rhinitis');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(
        getByText(
          'MSD Veterinary Manual search is unavailable for this companion.',
        ),
      ).toBeTruthy();
    });
  });

  it('shows session-expired error when stored token is expired', async () => {
    (isTokenExpired as jest.Mock).mockReturnValueOnce(true);

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'rhinitis');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(
        getByText('Your session expired. Please sign in again.'),
      ).toBeTruthy();
    });
  });

  it('toggles language selector visibility via RefineToggleButton', () => {
    const {getByLabelText, queryByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    expect(queryByText('Language')).toBeNull();

    fireEvent.press(getByLabelText('Show refine results'));
    expect(queryByText('Language')).toBeTruthy();

    fireEvent.press(getByLabelText('Hide refine results'));
    expect(queryByText('Language')).toBeNull();
  });

  it('changes search language when a LanguageSelector pill is pressed', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'r1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'es',
        totalResults: 0,
      },
      entries: [],
    });

    const {getByTestId, getByText, getByLabelText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.press(getByLabelText('Show refine results'));
    fireEvent.press(getByText('ES'));

    fireEvent.changeText(getByTestId('merck-search-input'), 'test');
    fireEvent.press(getByText('Search'));

    await waitFor(() => {
      expect(merckApi.searchManuals).toHaveBeenCalledWith(
        expect.objectContaining({language: 'es'}),
      );
    });
  });

  it('renders Open Full Search button in non-compact mode when onOpenFullSearch is provided', () => {
    const onOpenFullSearch = jest.fn();
    const {getAllByText} = render(
      <MerckSearchWidget
        organisationId="org-1"
        onOpenFullSearch={onOpenFullSearch}
      />,
    );

    const buttons = getAllByText('Open Full Search');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.press(buttons[0]);
    expect(onOpenFullSearch).toHaveBeenCalled();
  });

  it('resets refineOpen to false when compact prop transitions from false to true', () => {
    const {rerender, queryByText, getByLabelText} = render(
      <MerckSearchWidget organisationId="org-1" compact={false} />,
    );

    fireEvent.press(getByLabelText('Show refine results'));
    expect(queryByText('Language')).toBeTruthy();

    act(() => {
      rerender(<MerckSearchWidget organisationId="org-1" compact={true} />);
    });

    act(() => {
      rerender(<MerckSearchWidget organisationId="org-1" compact={false} />);
    });

    expect(queryByText('Language')).toBeNull();
  });

  it('shows an error when the system browser cannot open an allowed URL', async () => {
    (merckApi.searchManuals as jest.Mock).mockResolvedValue({
      meta: {
        requestId: 'r1',
        source: 'merck-live-feed',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 1,
      },
      entries: [
        {
          id: 'e1',
          title: 'Topic',
          summaryText: 'Summary',
          updatedAt: null,
          audience: 'PAT',
          primaryUrl: 'https://www.msdvetmanual.com/topic',
          subLinks: [],
        },
      ],
    });
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('failed'));

    const {getByTestId, getByText} = render(
      <MerckSearchWidget organisationId="org-1" />,
    );

    fireEvent.changeText(getByTestId('merck-search-input'), 'test');
    fireEvent.press(getByText('Search'));
    await waitFor(() => expect(merckApi.searchManuals).toHaveBeenCalled());

    fireEvent.press(getByText('Open'));

    await waitFor(() => {
      expect(
        getByText('Unable to open this MSD Veterinary Manual page right now.'),
      ).toBeTruthy();
    });
  });
});
