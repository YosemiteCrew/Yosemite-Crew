import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {MerckSearchWidget} from '@/features/merck/components/MerckSearchWidget';
import {merckApi} from '@/features/merck/services/merckService';

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
      const host = new URL(url).hostname.toLowerCase();
      return host === 'msdvetmanual.com' || host.endsWith('.msdvetmanual.com');
    } catch {
      return false;
    }
  }),
}));

jest.mock('@/shared/components/common/SearchBar/SearchBar', () => ({
  SearchBar: ({value, onChangeText}: any) => {
    const ReactNative = require('react-native');
    return (
      <ReactNative.TextInput
        testID="merck-search-input"
        value={value}
        onChangeText={onChangeText}
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
  });

  it('searches and opens secure in-app reader', async () => {
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

    const reader = await waitFor(() => getByTestId('merck-reader-webview'));
    expect(reader).toBeTruthy();

    await act(async () => {
      const allow = reader.props.onShouldStartLoadWithRequest({
        url: 'https://www.msdvetmanual.com/topic#details',
      });
      expect(allow).toBe(true);
    });

    await act(async () => {
      const allow = reader.props.onShouldStartLoadWithRequest({
        url: 'https://example.com/phishing',
      });
      expect(allow).toBe(false);
    });

    expect(
      getByText(
        'Blocked URL: only MSD Veterinary Manual consumer links are allowed.',
      ),
    ).toBeTruthy();
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
});
