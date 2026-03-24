import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {SafeAreaView} from 'react-native-safe-area-context';
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

const sanitizeTextForDisplay = (value: string): string => {
  const withoutTags = String(value ?? '').replace(/<[^>]*>/g, ' ');
  return withoutTags.replace(/\s+/g, ' ').trim();
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

export const MerckSearchWidget: React.FC<MerckSearchWidgetProps> = ({
  organisationId,
  title = 'Merck Manuals',
  description = 'Search consumer-focused Merck manuals content.',
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
  const [readerTitle, setReaderTitle] = React.useState('Merck Manual');

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
      setError('Merck search is unavailable for this companion.');
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
          : 'Unable to search Merck manuals right now.';
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
      setError('Blocked URL: only Merck/MSD consumer links are allowed.');
      return;
    }

    setReaderTitle(sanitizeTextForDisplay(manualTitle) || 'Merck Manual');
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

      setError('Blocked URL: only Merck/MSD consumer links are allowed.');
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

  return (
    <LiquidGlassCard style={styles.container} fallbackStyle={styles.container}>
      <View testID={testID} style={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.headingTextWrap}>
            <Image source={Images.merckLogo} style={styles.logo} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{description}</Text>
          </View>
          {onOpenFullSearch ? (
            <LiquidGlassButton
              title="Open Full Search"
              onPress={() =>
                onOpenFullSearch({
                  query: query.trim(),
                  entries,
                  language,
                  hasSearched,
                })
              }
              height={40}
              borderRadius={theme.borderRadius.md}
              glassEffect="clear"
              forceBorder
              borderColor={theme.colors.secondary}
              textStyle={styles.secondaryButtonText}
              shadowIntensity="light"
            />
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputRow}>
            <SearchBar
              mode="input"
              placeholder="Search Merck manuals"
              value={query}
              onChangeText={value => {
                setQuery(value);
                setHasSearched(false);
              }}
              onSubmitEditing={() => {
                executeSearch();
              }}
              containerStyle={styles.searchBar}
              rightElement={loading ? <ActivityIndicator size="small" /> : null}
            />
            {!compact ? (
              <Pressable
                onPress={() => setRefineOpen(prev => !prev)}
                style={[
                  styles.refineIconButton,
                  refineOpen ? styles.refineIconButtonActive : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  refineOpen ? 'Hide refine results' : 'Show refine results'
                }>
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
              </Pressable>
            ) : null}
          </View>

          {!compact && refineOpen ? (
            <View style={styles.languageRow}>
              <Text style={styles.languageLabel}>Language</Text>
              <View style={styles.languagePillWrap}>
                <Pressable
                  onPress={() => {
                    setLanguage('en');
                    setHasSearched(false);
                  }}
                  style={[
                    styles.languagePill,
                    language === 'en' ? styles.languagePillActive : null,
                  ]}>
                  <Text
                    style={[
                      styles.languagePillText,
                      language === 'en' ? styles.languagePillTextActive : null,
                    ]}>
                    EN
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLanguage('es');
                    setHasSearched(false);
                  }}
                  style={[
                    styles.languagePill,
                    language === 'es' ? styles.languagePillActive : null,
                  ]}>
                  <Text
                    style={[
                      styles.languagePillText,
                      language === 'es' ? styles.languagePillTextActive : null,
                    ]}>
                    ES
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <LiquidGlassButton
            title={loading ? 'Searching...' : 'Search'}
            onPress={() => {
              executeSearch();
            }}
            height={48}
            borderRadius={theme.borderRadius.md}
            tintColor={theme.colors.secondary}
            style={styles.searchButton}
            textStyle={styles.openButtonText}
            disabled={loading || !query.trim()}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {showIdleState ? (
          <View style={styles.emptyStateCard}>
            <Image source={Images.merckLogo} style={styles.emptyStateLogo} />
            <Text style={styles.emptyStateTitle}>Search medical topics</Text>
            <Text style={styles.emptyStateDescription}>
              Find consumer-friendly Merck Manuals guidance for symptoms, care,
              and follow-up.
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
          <Text style={styles.emptyText}>
            No manuals found for this search.
          </Text>
        ) : null}

        {compact ? (
          <View style={styles.resultsWrap}>
            {visibleEntries.map(entry => (
              <View key={entry.id} style={styles.resultCard}>
                <Text style={styles.resultTitle}>
                  {sanitizeTextForDisplay(entry.title)}
                </Text>
                <Text style={styles.resultSummary} numberOfLines={2}>
                  {sanitizeTextForDisplay(entry.summaryText) ||
                    'No summary available.'}
                </Text>

                <View style={styles.resultActions}>
                  <LiquidGlassButton
                    title="Open"
                    onPress={() => {
                      openInReader(entry.primaryUrl, entry.title);
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
                    {entry.subLinks.slice(0, 2).map(link => {
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
                            openInReader(link.url, entry.title);
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
            ))}

            {hasMoreCompactResults && onOpenFullSearch ? (
              <Pressable
                onPress={() =>
                  onOpenFullSearch({
                    query: query.trim(),
                    entries,
                    language,
                    hasSearched,
                  })
                }
                style={styles.viewMoreWrap}
                accessibilityRole="button"
                accessibilityLabel="View more Merck results">
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
        ) : (
          <View style={styles.resultsPanel}>
            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled>
              {visibleEntries.map(entry => (
                <View key={entry.id} style={styles.resultCard}>
                  <Text style={styles.resultTitle}>
                    {sanitizeTextForDisplay(entry.title)}
                  </Text>
                  <Text style={styles.resultSummary} numberOfLines={4}>
                    {sanitizeTextForDisplay(entry.summaryText) ||
                      'No summary available.'}
                  </Text>

                  <View style={styles.resultActions}>
                    <LiquidGlassButton
                      title="Open"
                      onPress={() => {
                        openInReader(entry.primaryUrl, entry.title);
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
                      {entry.subLinks.slice(0, 6).map(link => {
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
                              openInReader(link.url, entry.title);
                            }}>
                            <Text
                              style={[
                                styles.linkPillText,
                                {color: colors.color},
                              ]}
                              numberOfLines={1}>
                              {link.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <Text style={styles.copyrightText}>{MERCK_COPYRIGHT_NOTICE}</Text>
          </View>
        )}
      </View>

      <Modal
        visible={readerOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeReader}>
        <View style={styles.readerBackdrop}>
          <SafeAreaView style={styles.readerSafeArea}>
            <View style={styles.readerShell}>
              <View style={styles.readerHeader}>
                <Text style={styles.readerTitle} numberOfLines={1}>
                  {readerTitle}
                </Text>
                <TouchableOpacity
                  style={styles.readerCloseButton}
                  onPress={closeReader}
                  accessibilityRole="button"
                  accessibilityLabel="Close Merck reader">
                  <Image
                    source={Images.closeIcon}
                    style={styles.readerCloseIcon}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.readerBody}>
                {readerLoading ? (
                  <View style={styles.readerLoaderOverlay}>
                    <Image
                      source={Images.yosemiteLoader}
                      style={styles.readerLoaderGif}
                    />
                    <Text style={styles.readerLoaderText}>
                      Loading manual...
                    </Text>
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
                      setError('Unable to open this Merck page right now.');
                    }}
                    onHttpError={() => {
                      setReaderLoading(false);
                      setError('Unable to load this Merck page right now.');
                    }}
                  />
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing['3.5'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      overflow: 'hidden',
      flex: 1,
    },
    content: {
      gap: theme.spacing['2.5'],
      flex: 1,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    headingTextWrap: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    logo: {
      width: 88,
      height: 24,
      resizeMode: 'contain',
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
    languagePill: {
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
    },
    languagePillActive: {
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.primaryTint,
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
      marginTop: theme.spacing['2'],
    },
    refineIconButton: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refineIconButtonActive: {
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.primaryTint,
    },
    refineGlyph: {
      width: 18,
      height: 14,
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
      width: 96,
      height: 26,
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
    readerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.56)',
      padding: theme.spacing['3'],
    },
    readerSafeArea: {
      flex: 1,
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
