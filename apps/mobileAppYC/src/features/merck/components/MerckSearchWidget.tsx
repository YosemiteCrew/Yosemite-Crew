import React from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {
  merckApi,
  isAllowedMerckUrl,
} from '@/features/merck/services/merckService';
import type {MerckEntry, MerckLanguage} from '@/features/merck/types';

type MerckSearchWidgetProps = {
  organisationId?: string | null;
  title?: string;
  description?: string;
  compact?: boolean;
  initialQuery?: string;
  initialEntries?: MerckEntry[];
  initialLanguage?: MerckLanguage;
  initialHasSearched?: boolean;
  onOpenFullSearch?: (payload: {
    query: string;
    entries: MerckEntry[];
    language: MerckLanguage;
    hasSearched: boolean;
  }) => void;
  testID?: string;
};

type MerckPillColors = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

const MERCK_PILL_COLORS = {
  fullSummary: {
    backgroundColor: '#247AED',
    borderColor: '#247AED',
    color: '#EAF3FF',
  },
  etiology: {
    backgroundColor: '#747283',
    borderColor: '#747283',
    color: '#F7F7F7',
  },
  symptomsAndSigns: {
    backgroundColor: '#BF9FAA',
    borderColor: '#BF9FAA',
    color: '#F7F7F7',
  },
  diagnosis: {
    backgroundColor: '#D9A488',
    borderColor: '#D9A488',
    color: '#F7F7F7',
  },
  treatment: {
    backgroundColor: '#5C614B',
    borderColor: '#5C614B',
    color: '#F7F7F7',
  },
} as const;

const MERCK_PILL_PALETTE = Object.values(MERCK_PILL_COLORS);

const getSessionError = (): string =>
  'Your session expired. Please sign in again.';

const MERCK_COPYRIGHT_NOTICE =
  'Copyright © 2021 Merck & Co., Inc., known as MSD outside of the US, Kenilworth, New Jersey, USA. All rights reserved.';
const EMPTY_INITIAL_ENTRIES: MerckEntry[] = [];

const stripHtmlTags = (value: string): string => {
  let output = '';
  let insideTag = false;

  for (const char of value) {
    if (char === '<') {
      insideTag = true;
      output += ' ';
      continue;
    }
    if (char === '>') {
      insideTag = false;
      output += ' ';
      continue;
    }
    if (!insideTag) {
      output += char;
    }
  }

  return output;
};

const sanitizeTextForDisplay = (value: string): string => {
  const withoutTags = stripHtmlTags(String(value ?? ''));
  return withoutTags.replaceAll(/\s+/g, ' ').trim();
};

const pickPillColorFromLabel = (label: string): MerckPillColors => {
  let hash = 0;
  for (const char of label) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2147483647;
  }
  return MERCK_PILL_PALETTE[hash % MERCK_PILL_PALETTE.length];
};

const getMerckSubtopicPillColors = (label: string): MerckPillColors => {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes('full summary')) return MERCK_PILL_COLORS.fullSummary;
  if (normalized.includes('etiology')) return MERCK_PILL_COLORS.etiology;
  if (normalized.includes('symptoms and signs'))
    return MERCK_PILL_COLORS.symptomsAndSigns;
  if (normalized.includes('diagnosis')) return MERCK_PILL_COLORS.diagnosis;
  if (normalized.includes('treatment')) return MERCK_PILL_COLORS.treatment;
  return pickPillColorFromLabel(normalized || 'default');
};

const isReaderNavigationAllowed = (url: string): boolean => {
  const value = String(url ?? '').trim();
  if (!value || value === 'about:blank') {
    return true;
  }
  return isAllowedMerckUrl(value);
};

type MerckStyles = ReturnType<typeof createStyles>;

type MerckEntryCardProps = {
  entry: MerckEntry;
  styles: MerckStyles;
  theme: any;
  summaryLines: number;
  subLinkLimit: number;
  onOpenInReader: (url: string, title: string) => void;
  glass?: boolean;
};

const MerckEntryCard: React.FC<MerckEntryCardProps> = ({
  entry,
  styles,
  theme,
  summaryLines,
  subLinkLimit,
  onOpenInReader,
  glass = false,
}) => {
  const cardContent = (
    <View
      key={entry.id}
      style={glass ? styles.resultCardContent : styles.resultCard}>
      <Text style={styles.resultTitle}>
        {sanitizeTextForDisplay(entry.title)}
      </Text>
      <Text style={styles.resultSummary} numberOfLines={summaryLines}>
        {sanitizeTextForDisplay(entry.summaryText) || 'No summary available.'}
      </Text>

      <View style={styles.resultActions}>
        <LiquidGlassButton
          title="Open"
          onPress={() => {
            onOpenInReader(entry.primaryUrl, entry.title);
          }}
          height={48}
          borderRadius={theme.borderRadius.md}
          tintColor={theme.colors.secondary}
          style={styles.openButton}
          textStyle={styles.openButtonText}
          shadowIntensity="medium"
        />
      </View>

      {entry.subLinks.length ? (
        <View style={styles.linkPills}>
          {entry.subLinks.slice(0, subLinkLimit).map(link => {
            const colors = getMerckSubtopicPillColors(link.label);
            return (
              <Pressable
                key={`${entry.id}-${link.label}`}
                style={[
                  styles.linkPill,
                  {
                    backgroundColor: colors.backgroundColor,
                    borderColor: colors.borderColor,
                  },
                ]}
                onPress={() => {
                  onOpenInReader(link.url, entry.title);
                }}>
                <Text
                  style={[styles.linkPillText, {color: colors.color}]}
                  numberOfLines={1}>
                  {link.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  if (!glass) {
    return cardContent;
  }

  return (
    <View key={entry.id} style={styles.resultCardShadowWrapper}>
      <LiquidGlassCard
        glassEffect="clear"
        padding="0"
        shadow="base"
        style={styles.resultCardGlass}
        fallbackStyle={styles.resultCardGlassFallback}>
        {cardContent}
      </LiquidGlassCard>
    </View>
  );
};

type MerckResultsSectionProps = {
  compact: boolean;
  visibleEntries: MerckEntry[];
  hasMoreCompactResults: boolean;
  hasFullSearch: boolean;
  styles: MerckStyles;
  theme: any;
  onOpenInReader: (url: string, title: string) => void;
  onOpenFullSearch: () => void;
};

const MerckResultsSection: React.FC<MerckResultsSectionProps> = ({
  compact,
  visibleEntries,
  hasMoreCompactResults,
  hasFullSearch,
  styles,
  theme,
  onOpenInReader,
  onOpenFullSearch,
}) => {
  if (compact) {
    return (
      <View style={styles.resultsWrap}>
        {visibleEntries.map(entry => (
          <MerckEntryCard
            key={entry.id}
            entry={entry}
            styles={styles}
            theme={theme}
            summaryLines={2}
            subLinkLimit={2}
            onOpenInReader={onOpenInReader}
            glass
          />
        ))}

        {hasMoreCompactResults && hasFullSearch ? (
          <Pressable
            onPress={onOpenFullSearch}
            style={styles.viewMoreWrap}
            accessibilityRole="button"
            accessibilityLabel="View more MSD Veterinary Manual results">
            <Text style={styles.viewMoreHintText}>
              Showing top results only.
            </Text>
            <Text style={styles.viewMoreActionText}>
              View more in full search
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.copyrightText}>{MERCK_COPYRIGHT_NOTICE}</Text>
      </View>
    );
  }

  return (
    <View style={styles.resultsPanel}>
      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled>
        {visibleEntries.map(entry => (
          <MerckEntryCard
            key={entry.id}
            entry={entry}
            styles={styles}
            theme={theme}
            summaryLines={4}
            subLinkLimit={6}
            onOpenInReader={onOpenInReader}
          />
        ))}
      </ScrollView>

      <Text style={styles.copyrightText}>{MERCK_COPYRIGHT_NOTICE}</Text>
    </View>
  );
};

type MerckReaderModalProps = {
  visible: boolean;
  readerLoading: boolean;
  readerTitle: string;
  readerUrl: string | null;
  styles: MerckStyles;
  closeReader: () => void;
  handleReaderNavigation: (request: {url?: string}) => boolean;
  setReaderLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};

const MerckReaderModal: React.FC<MerckReaderModalProps> = ({
  visible,
  readerLoading,
  readerTitle,
  readerUrl,
  styles,
  closeReader,
  handleReaderNavigation,
  setReaderLoading,
  setError,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={closeReader}>
      <View
        style={[
          styles.readerBackdrop,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            paddingLeft: insets.left + 12,
            paddingRight: insets.right + 12,
          },
        ]}>
        <View style={styles.readerShell}>
          <View style={styles.readerHeader}>
            <Text style={styles.readerTitle} numberOfLines={1}>
              {readerTitle}
            </Text>
            <TouchableOpacity
              style={styles.readerCloseButton}
              onPress={closeReader}
              accessibilityRole="button"
              accessibilityLabel="Close MSD Veterinary Manual reader">
              <Image source={Images.closeIcon} style={styles.readerCloseIcon} />
            </TouchableOpacity>
          </View>

          <View style={styles.readerBody}>
            {readerLoading ? (
              <View style={styles.readerLoaderOverlay}>
                <Image
                  source={Images.yosemiteLoader}
                  style={styles.readerLoaderGif}
                />
                <Text style={styles.readerLoaderText}>Loading manual...</Text>
              </View>
            ) : null}
            {readerUrl ? (
              <WebView
                testID="merck-reader-webview"
                source={{uri: readerUrl}}
                originWhitelist={['https://*']}
                startInLoadingState={false}
                javaScriptEnabled
                javaScriptCanOpenWindowsAutomatically={false}
                domStorageEnabled
                thirdPartyCookiesEnabled={false}
                sharedCookiesEnabled={false}
                setSupportMultipleWindows={false}
                geolocationEnabled={false}
                allowFileAccess={false}
                allowFileAccessFromFileURLs={false}
                allowUniversalAccessFromFileURLs={false}
                mixedContentMode="never"
                allowsLinkPreview={false}
                mediaPlaybackRequiresUserAction
                incognito
                onShouldStartLoadWithRequest={handleReaderNavigation}
                onLoadStart={() => setReaderLoading(true)}
                onLoadEnd={() => setReaderLoading(false)}
                onError={() => {
                  setReaderLoading(false);
                  setError(
                    'Unable to open this MSD Veterinary Manual page right now.',
                  );
                }}
                onHttpError={() => {
                  setReaderLoading(false);
                  setError(
                    'Unable to load this MSD Veterinary Manual page right now.',
                  );
                }}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

type MerckSearchControllerArgs = {
  organisationId?: string | null;
  compact: boolean;
  initialQuery: string;
  initialEntries: MerckEntry[];
  initialLanguage: MerckLanguage;
  initialHasSearched: boolean;
  onOpenFullSearch?: MerckSearchWidgetProps['onOpenFullSearch'];
};

const useMerckSearchController = ({
  organisationId,
  compact,
  initialQuery,
  initialEntries,
  initialLanguage,
  initialHasSearched,
  onOpenFullSearch,
}: MerckSearchControllerArgs) => {
  const [query, setQuery] = React.useState(initialQuery);
  const [language, setLanguage] =
    React.useState<MerckLanguage>(initialLanguage);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<MerckEntry[]>(initialEntries);
  const [hasSearched, setHasSearched] = React.useState(initialHasSearched);
  const [refineOpen, setRefineOpen] = React.useState(false);

  const [readerOpen, setReaderOpen] = React.useState(false);
  const [readerLoading, setReaderLoading] = React.useState(false);
  const [readerUrl, setReaderUrl] = React.useState<string | null>(null);
  const [readerTitle, setReaderTitle] = React.useState('MSD Veterinary Manual');

  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  React.useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  React.useEffect(() => {
    if (compact) {
      return;
    }

    setEntries(initialEntries);
    setHasSearched(initialHasSearched);
  }, [compact, initialEntries, initialHasSearched]);

  React.useEffect(() => {
    if (compact) {
      setRefineOpen(false);
    }
  }, [compact]);

  const executeSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setEntries([]);
      setError(null);
      setHasSearched(false);
      return;
    }

    if (!organisationId) {
      setError(
        'MSD Veterinary Manual search is unavailable for this companion.',
      );
      setHasSearched(true);
      return;
    }

    setHasSearched(true);
    setLoading(true);
    setError(null);

    try {
      const tokens = await getFreshStoredTokens();
      const accessToken = tokens?.accessToken;

      if (!accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
        throw new Error(getSessionError());
      }

      const response = await merckApi.searchManuals({
        organisationId,
        query: trimmedQuery,
        language,
        media: 'hybrid',
        accessToken,
      });
      setEntries(response.entries);
    } catch (searchError) {
      const message =
        searchError instanceof Error
          ? searchError.message
          : 'Unable to search MSD Veterinary Manual right now.';
      setEntries([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [language, organisationId, query]);

  const closeReader = React.useCallback(() => {
    setReaderOpen(false);
    setReaderLoading(false);
    setReaderUrl(null);
  }, []);

  const openInReader = React.useCallback((url: string, manualTitle: string) => {
    if (!isAllowedMerckUrl(url)) {
      setError(
        'Blocked URL: only MSD Veterinary Manual consumer links are allowed.',
      );
      return;
    }

    setReaderTitle(
      sanitizeTextForDisplay(manualTitle) || 'MSD Veterinary Manual',
    );
    setReaderUrl(url);
    setReaderLoading(true);
    setReaderOpen(true);
  }, []);

  const handleReaderNavigation = React.useCallback(
    (request: {url?: string}) => {
      const targetUrl = String(request?.url ?? '');
      if (isReaderNavigationAllowed(targetUrl)) {
        return true;
      }

      setError(
        'Blocked URL: only MSD Veterinary Manual consumer links are allowed.',
      );
      return false;
    },
    [],
  );

  const visibleEntries = compact ? entries.slice(0, 2) : entries;
  const showNoResultsState =
    !loading && visibleEntries.length === 0 && hasSearched && !error;
  const showIdleState =
    !compact && !loading && !error && !hasSearched && !query.trim();
  const hasMoreCompactResults =
    compact && entries.length > visibleEntries.length;
  const handleOpenFullSearchPress = React.useCallback(() => {
    if (!onOpenFullSearch) {
      return;
    }
    onOpenFullSearch({
      query: query.trim(),
      entries,
      language,
      hasSearched,
    });
  }, [entries, hasSearched, language, onOpenFullSearch, query]);

  return {
    query,
    setQuery,
    language,
    setLanguage,
    loading,
    error,
    setError,
    entries,
    hasSearched,
    setHasSearched,
    refineOpen,
    setRefineOpen,
    readerOpen,
    readerLoading,
    setReaderLoading,
    readerUrl,
    readerTitle,
    executeSearch,
    closeReader,
    openInReader,
    handleReaderNavigation,
    visibleEntries,
    showNoResultsState,
    showIdleState,
    hasMoreCompactResults,
    handleOpenFullSearchPress,
  };
};

type MerckSearchWidgetViewProps = {
  title: string;
  description: string;
  compact: boolean;
  testID: string;
  onOpenFullSearch?: MerckSearchWidgetProps['onOpenFullSearch'];
  theme: any;
  styles: MerckStyles;
  controller: ReturnType<typeof useMerckSearchController>;
};

type MerckHeaderSectionProps = {
  title: string;
  description: string;
  compact: boolean;
  showLogo?: boolean;
  styles: MerckStyles;
  theme: any;
  hasFullSearch: boolean;
  onOpenFullSearch: () => void;
};

const MerckHeaderSection: React.FC<MerckHeaderSectionProps> = ({
  title,
  description,
  compact,
  showLogo = true,
  styles,
  theme,
  hasFullSearch,
  onOpenFullSearch,
}) => (
  <View style={styles.headingRow}>
    {showLogo ? <Image source={Images.merckLogo} style={styles.logo} /> : null}
    <View style={styles.headingInfoRow}>
      <View style={styles.headingTextWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{description}</Text>
      </View>
      {hasFullSearch && !compact ? (
        <LiquidGlassButton
          title="Open Full Search"
          onPress={onOpenFullSearch}
          height={48}
          borderRadius={theme.borderRadius.md}
          glassEffect="clear"
          forceBorder
          borderColor={theme.colors.secondary}
          style={styles.fullSearchButton}
          textStyle={styles.fullSearchButtonText}
          shadowIntensity="light"
        />
      ) : null}
    </View>
    {hasFullSearch && compact ? (
      <LiquidGlassButton
        title="Open Full Search"
        onPress={onOpenFullSearch}
        height={48}
        borderRadius={theme.borderRadius.md}
        glassEffect="clear"
        forceBorder
        borderColor={theme.colors.secondary}
        style={styles.fullSearchButtonCompact}
        textStyle={styles.fullSearchButtonText}
        shadowIntensity="light"
      />
    ) : null}
  </View>
);

type MerckSearchControlsProps = {
  compact: boolean;
  query: string;
  loading: boolean;
  refineOpen: boolean;
  language: MerckLanguage;
  styles: MerckStyles;
  theme: any;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onToggleRefine: () => void;
  onLanguageChange: (nextLanguage: MerckLanguage) => void;
};

type RefineToggleButtonProps = {
  refineOpen: boolean;
  styles: MerckStyles;
  theme: any;
  onToggleRefine: () => void;
};

const RefineToggleButton: React.FC<RefineToggleButtonProps> = ({
  refineOpen,
  styles,
  theme,
  onToggleRefine,
}) => (
  <Pressable
    onPress={onToggleRefine}
    style={styles.refineTogglePressable}
    accessibilityRole="button"
    accessibilityLabel={
      refineOpen ? 'Hide refine results' : 'Show refine results'
    }>
    <LiquidGlassCard
      glassEffect="clear"
      padding="0"
      tintColor={refineOpen ? theme.colors.primaryTint : undefined}
      style={[
        styles.refineGlassCard,
        refineOpen ? styles.refineGlassCardActive : null,
      ]}
      fallbackStyle={[
        styles.refineGlassCard,
        refineOpen ? styles.refineGlassCardActive : null,
      ]}>
      <View style={styles.refineIconButton}>
        <View style={styles.refineGlyph}>
          <View
            style={[
              styles.refineGlyphLine,
              styles.refineGlyphLineTop,
              refineOpen ? styles.refineGlyphLineActive : null,
            ]}
          />
          <View
            style={[
              styles.refineGlyphLine,
              styles.refineGlyphLineMiddle,
              refineOpen ? styles.refineGlyphLineActive : null,
            ]}
          />
          <View
            style={[
              styles.refineGlyphLine,
              styles.refineGlyphLineBottom,
              refineOpen ? styles.refineGlyphLineActive : null,
            ]}
          />
        </View>
      </View>
    </LiquidGlassCard>
  </Pressable>
);

type LanguageSelectorProps = {
  language: MerckLanguage;
  styles: MerckStyles;
  theme: any;
  onLanguageChange: (nextLanguage: MerckLanguage) => void;
};

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  language,
  styles,
  theme,
  onLanguageChange,
}) => (
  <View style={styles.languageRow}>
    <Text style={styles.languageLabel}>Language</Text>
    <View style={styles.languagePillWrap}>
      {(['en', 'es'] as const).map(code => {
        const active = language === code;
        return (
          <Pressable
            key={code}
            onPress={() => onLanguageChange(code)}
            style={styles.languagePillPressable}>
            <LiquidGlassCard
              glassEffect="clear"
              padding="0"
              tintColor={active ? theme.colors.primaryTint : undefined}
              style={[
                styles.languagePillGlass,
                active ? styles.languagePillGlassActive : null,
              ]}
              fallbackStyle={[
                styles.languagePillGlass,
                active ? styles.languagePillGlassActive : null,
              ]}>
              <View style={styles.languagePillInner}>
                <Text
                  style={[
                    styles.languagePillText,
                    active ? styles.languagePillTextActive : null,
                  ]}>
                  {code.toUpperCase()}
                </Text>
              </View>
            </LiquidGlassCard>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const MerckSearchControls: React.FC<MerckSearchControlsProps> = ({
  compact,
  query,
  loading,
  refineOpen,
  language,
  styles,
  theme,
  onQueryChange,
  onSearch,
  onToggleRefine,
  onLanguageChange,
}) => {
  const handleSearchPress = React.useCallback(() => {
    Keyboard.dismiss();
    onSearch();
  }, [onSearch]);

  return (
    <View style={styles.searchRow}>
      <View style={styles.searchInputRow}>
        <SearchBar
          mode="input"
          placeholder="Search MSD Veterinary Manual"
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onSearch}
          containerStyle={styles.searchBar}
          rightElement={loading ? <ActivityIndicator size="small" /> : null}
        />
        {compact ? null : (
          <RefineToggleButton
            refineOpen={refineOpen}
            styles={styles}
            theme={theme}
            onToggleRefine={onToggleRefine}
          />
        )}
      </View>

      {compact || !refineOpen ? null : (
        <LanguageSelector
          language={language}
          styles={styles}
          theme={theme}
          onLanguageChange={onLanguageChange}
        />
      )}

      <LiquidGlassButton
        title={loading ? 'Searching...' : 'Search'}
        onPress={handleSearchPress}
        height={48}
        borderRadius={theme.borderRadius.md}
        tintColor={theme.colors.secondary}
        style={styles.searchButton}
        textStyle={styles.openButtonText}
        disabled={loading || !query.trim()}
      />
    </View>
  );
};

type MerckStateMessagesProps = {
  compact: boolean;
  error: string | null;
  showIdleState: boolean;
  showNoResultsState: boolean;
  styles: MerckStyles;
};

const MerckStateMessages: React.FC<MerckStateMessagesProps> = ({
  compact,
  error,
  showIdleState,
  showNoResultsState,
  styles,
}) => (
  <>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}

    {showIdleState ? (
      <View style={styles.emptyStateCard}>
        <Image source={Images.merckLogo} style={styles.emptyStateLogo} />
        <Text style={styles.emptyStateTitle}>Search medical topics</Text>
        <Text style={styles.emptyStateDescription}>
          Find consumer-friendly MSD Veterinary Manual guidance for symptoms,
          care, and follow-up.
        </Text>
      </View>
    ) : null}

    {showNoResultsState && !compact ? (
      <View style={styles.emptyStateCard}>
        <Text style={styles.emptyStateTitle}>No manuals found</Text>
        <Text style={styles.emptyStateDescription}>
          Try a broader keyword, remove specifics, or switch language from
          refine filters.
        </Text>
      </View>
    ) : null}

    {showNoResultsState && compact ? (
      <Text style={styles.emptyText}>No manuals found for this search.</Text>
    ) : null}
  </>
);

const MerckSearchWidgetView: React.FC<MerckSearchWidgetViewProps> = ({
  title,
  description,
  compact,
  testID,
  onOpenFullSearch,
  theme,
  styles,
  controller,
}) => {
  const {
    query,
    setQuery,
    language,
    setLanguage,
    loading,
    error,
    setError,
    setHasSearched,
    refineOpen,
    setRefineOpen,
    readerOpen,
    readerLoading,
    setReaderLoading,
    readerUrl,
    readerTitle,
    executeSearch,
    closeReader,
    openInReader,
    handleReaderNavigation,
    visibleEntries,
    showNoResultsState,
    showIdleState,
    hasMoreCompactResults,
    handleOpenFullSearchPress,
  } = controller;
  const hasFullSearch = Boolean(onOpenFullSearch);
  const handleQueryChange = React.useCallback(
    (value: string) => {
      setQuery(value);
      setHasSearched(false);
    },
    [setHasSearched, setQuery],
  );
  const handleLanguageChange = React.useCallback(
    (nextLanguage: MerckLanguage) => {
      setLanguage(nextLanguage);
      setHasSearched(false);
    },
    [setHasSearched, setLanguage],
  );
  const handleToggleRefine = React.useCallback(() => {
    setRefineOpen(prev => !prev);
  }, [setRefineOpen]);

  const compactContent = (
    <View testID={testID} style={styles.content}>
      <MerckHeaderSection
        title={title}
        description={description}
        compact={compact}
        styles={styles}
        theme={theme}
        hasFullSearch={hasFullSearch}
        onOpenFullSearch={handleOpenFullSearchPress}
      />

      <LiquidGlassCard
        style={styles.compactSearchCard}
        fallbackStyle={styles.compactSearchCard}
        glassEffect="clear">
        <MerckSearchControls
          compact={compact}
          query={query}
          loading={loading}
          refineOpen={refineOpen}
          language={language}
          styles={styles}
          theme={theme}
          onQueryChange={handleQueryChange}
          onSearch={executeSearch}
          onToggleRefine={handleToggleRefine}
          onLanguageChange={handleLanguageChange}
        />
      </LiquidGlassCard>

      <MerckStateMessages
        compact={compact}
        error={error}
        showIdleState={showIdleState}
        showNoResultsState={showNoResultsState}
        styles={styles}
      />

      <MerckResultsSection
        compact={compact}
        visibleEntries={visibleEntries}
        hasMoreCompactResults={hasMoreCompactResults}
        hasFullSearch={hasFullSearch}
        styles={styles}
        theme={theme}
        onOpenInReader={openInReader}
        onOpenFullSearch={handleOpenFullSearchPress}
      />
    </View>
  );

  const fullContent = (
    <View testID={testID} style={styles.content}>
      <View style={styles.stickyControlsWrap}>
        <MerckSearchControls
          compact={compact}
          query={query}
          loading={loading}
          refineOpen={refineOpen}
          language={language}
          styles={styles}
          theme={theme}
          onQueryChange={handleQueryChange}
          onSearch={executeSearch}
          onToggleRefine={handleToggleRefine}
          onLanguageChange={handleLanguageChange}
        />
      </View>

      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled>
        <MerckHeaderSection
          title={title}
          description={description}
          compact={compact}
          showLogo={!showIdleState}
          styles={styles}
          theme={theme}
          hasFullSearch={hasFullSearch}
          onOpenFullSearch={handleOpenFullSearchPress}
        />

        <MerckStateMessages
          compact={compact}
          error={error}
          showIdleState={showIdleState}
          showNoResultsState={showNoResultsState}
          styles={styles}
        />

        {visibleEntries.map(entry => (
          <MerckEntryCard
            key={entry.id}
            entry={entry}
            styles={styles}
            theme={theme}
            summaryLines={4}
            subLinkLimit={6}
            onOpenInReader={openInReader}
            glass
          />
        ))}

        <Text style={styles.copyrightText}>{MERCK_COPYRIGHT_NOTICE}</Text>
      </ScrollView>
    </View>
  );

  const readerModal = (
    <MerckReaderModal
      visible={readerOpen}
      readerLoading={readerLoading}
      readerTitle={readerTitle}
      readerUrl={readerUrl}
      styles={styles}
      closeReader={closeReader}
      handleReaderNavigation={handleReaderNavigation}
      setReaderLoading={setReaderLoading}
      setError={setError}
    />
  );

  if (compact) {
    return (
      <View
        style={[
          styles.container,
          styles.compactContainer,
          styles.compactContainerPlain,
        ]}>
        {compactContent}
        {readerModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.fullContainer]}>
      {fullContent}
      {readerModal}
    </View>
  );
};

export const MerckSearchWidget: React.FC<MerckSearchWidgetProps> = ({
  organisationId,
  title = 'MSD Veterinary Manual',
  description = 'Search consumer-focused MSD Veterinary Manual content.',
  compact = false,
  initialQuery = '',
  initialEntries = EMPTY_INITIAL_ENTRIES,
  initialLanguage = 'en',
  initialHasSearched = false,
  onOpenFullSearch,
  testID = 'merck-search-widget',
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const controller = useMerckSearchController({
    organisationId,
    compact,
    initialQuery,
    initialEntries,
    initialLanguage,
    initialHasSearched,
    onOpenFullSearch,
  });

  return (
    <MerckSearchWidgetView
      title={title}
      description={description}
      compact={compact}
      testID={testID}
      onOpenFullSearch={onOpenFullSearch}
      theme={theme}
      styles={styles}
      controller={controller}
    />
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing['3.5'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    compactContainer: {
      flexGrow: 0,
    },
    compactContainerPlain: {
      overflow: 'visible',
    },
    fullContainer: {
      flex: 1,
    },
    compactSearchCard: {
      padding: theme.spacing['2.5'],
      borderRadius: theme.borderRadius.lg,
    },
    content: {
      gap: theme.spacing['2.5'],
      flex: 1,
    },
    stickyControlsWrap: {
      paddingBottom: theme.spacing['1'],
    },
    headingRow: {
      gap: theme.spacing['2'],
    },
    headingInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    headingTextWrap: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    logo: {
      width: 268,
      height: 68,
      resizeMode: 'contain',
      alignSelf: 'flex-start',
      marginLeft: -2,
    },
    title: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    languageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['2'],
    },
    languageLabel: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    languagePillWrap: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
    },
    languagePillPressable: {
      width: 44,
      height: 34,
      borderRadius: theme.borderRadius.full,
      overflow: 'hidden',
    },
    languagePillGlass: {
      width: '100%',
      height: '100%',
      borderRadius: theme.borderRadius.full,
      overflow: 'hidden',
    },
    languagePillGlassActive: {
      borderColor: theme.colors.secondary,
      borderWidth: 1,
    },
    languagePillInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    languagePillText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    languagePillTextActive: {
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    searchRow: {
      gap: theme.spacing['2.5'],
    },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
    },
    searchBar: {
      flex: 1,
    },
    searchButton: {
      marginTop: theme.spacing['1'],
    },
    refineIconButton: {
      flex: 1,
      borderRadius: theme.borderRadius.md,
      borderWidth: 0,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    refineTogglePressable: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
    },
    refineGlassCard: {
      width: '100%',
      height: '100%',
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
    },
    refineGlassCardActive: {
      borderColor: theme.colors.secondary,
      borderWidth: 1,
    },
    refineGlyph: {
      width: 18,
      height: 14,
      alignSelf: 'center',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    refineGlyphLine: {
      height: 2,
      borderRadius: 2,
      backgroundColor: theme.colors.textSecondary,
    },
    refineGlyphLineTop: {
      width: 16,
    },
    refineGlyphLineMiddle: {
      width: 12,
    },
    refineGlyphLineBottom: {
      width: 8,
    },
    refineGlyphLineActive: {
      backgroundColor: theme.colors.secondary,
    },
    errorText: {
      ...theme.typography.body12,
      color: theme.colors.error,
      marginTop: theme.spacing['1'],
    },
    emptyText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
    },
    emptyStateCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['5'],
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      marginTop: theme.spacing['1'],
    },
    emptyStateLogo: {
      width: 252,
      height: 64,
      resizeMode: 'contain',
      opacity: 0.92,
    },
    emptyStateTitle: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    emptyStateDescription: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    resultsWrap: {
      gap: theme.spacing['2.5'],
    },
    resultsPanel: {
      flex: 1,
      minHeight: 0,
      gap: theme.spacing['2'],
    },
    resultsScroll: {
      flex: 1,
      minHeight: 0,
      marginTop: theme.spacing['1'],
    },
    resultsScrollContent: {
      gap: theme.spacing['2.5'],
      paddingBottom: theme.spacing['3'],
    },
    resultCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing['3'],
      gap: theme.spacing['2'],
    },
    resultCardShadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.lg,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'visible',
    },
    resultCardGlass: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: 0,
      gap: theme.spacing['2'],
    },
    resultCardGlassFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    resultCardContent: {
      padding: theme.spacing['3'],
      gap: theme.spacing['2'],
      backgroundColor: 'transparent',
    },
    resultTitle: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
    },
    resultSummary: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    resultActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: theme.spacing['2'],
      marginTop: theme.spacing['1'],
    },
    openButton: {
      minWidth: 116,
    },
    openButtonText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.white,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    linkPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
    },
    linkPill: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      minHeight: 34,
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['1.5'],
      justifyContent: 'center',
    },
    linkPillText: {
      ...theme.typography.body12,
      fontWeight: '600',
      lineHeight: 16,
    },
    viewMoreWrap: {
      marginTop: theme.spacing['1'],
      paddingVertical: theme.spacing['1'],
      gap: theme.spacing['1'],
      alignItems: 'flex-start',
    },
    viewMoreHintText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    viewMoreActionText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
      textDecorationLine: 'underline',
    },
    copyrightText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      lineHeight: 14,
      marginTop: theme.spacing['1'],
    },
    secondaryButtonText: {
      ...theme.typography.body12,
      color: theme.colors.secondary,
      fontWeight: '600',
      textAlign: 'center',
    },
    fullSearchButton: {
      minWidth: 168,
      paddingHorizontal: theme.spacing['2'],
      flexShrink: 0,
      alignSelf: 'flex-start',
    },
    fullSearchButtonCompact: {
      width: '100%',
      marginTop: theme.spacing['1'],
    },
    fullSearchButtonText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
      lineHeight: 20,
      includeFontPadding: false,
      textAlignVertical: 'center',
      textAlign: 'center',
    },
    readerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.56)',
    },
    readerShell: {
      flex: 1,
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
    },
    readerHeader: {
      height: 56,
      paddingHorizontal: theme.spacing['3'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderMuted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    readerTitle: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
      flex: 1,
      marginRight: theme.spacing['2'],
    },
    readerCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    readerCloseIcon: {
      width: 16,
      height: 16,
      tintColor: theme.colors.secondary,
      resizeMode: 'contain',
    },
    readerBody: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    readerLoaderOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
    },
    readerLoaderGif: {
      width: 88,
      height: 88,
      resizeMode: 'contain',
    },
    readerLoaderText: {
      ...theme.typography.body12,
      color: theme.colors.secondary,
    },
  });

export default MerckSearchWidget;
