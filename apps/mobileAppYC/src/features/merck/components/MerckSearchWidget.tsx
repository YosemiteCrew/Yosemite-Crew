import React from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  onOpenFullSearch?: (query: string) => void;
  testID?: string;
};

const getSessionError = (): string =>
  'Your session expired. Please sign in again.';

export const MerckSearchWidget: React.FC<MerckSearchWidgetProps> = ({
  organisationId,
  title = 'Merck Manuals',
  description = 'Search consumer-focused Merck manuals content.',
  compact = false,
  initialQuery = '',
  onOpenFullSearch,
  testID = 'merck-search-widget',
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [query, setQuery] = React.useState(initialQuery);
  const [language, setLanguage] = React.useState<MerckLanguage>('en');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<MerckEntry[]>([]);

  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const executeSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setEntries([]);
      setError(null);
      return;
    }

    if (!organisationId) {
      setError('Merck search is unavailable for this appointment.');
      return;
    }

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

  const openExternal = React.useCallback(async (url: string) => {
    if (!isAllowedMerckUrl(url)) {
      setError('Blocked URL: only Merck/MSD consumer links are allowed.');
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      setError('Unable to open this Merck page right now.');
    }
  }, []);

  const visibleEntries = compact ? entries.slice(0, 2) : entries;

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
              onPress={() => onOpenFullSearch(query.trim())}
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

        <View style={styles.languageRow}>
          <Pressable
            onPress={() => setLanguage('en')}
            style={[
              styles.languagePill,
              language === 'en' ? styles.languagePillActive : null,
            ]}>
            <Text
              style={[
                styles.languagePillText,
                language === 'en' ? styles.languagePillTextActive : null,
              ]}>
              English
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setLanguage('es')}
            style={[
              styles.languagePill,
              language === 'es' ? styles.languagePillActive : null,
            ]}>
            <Text
              style={[
                styles.languagePillText,
                language === 'es' ? styles.languagePillTextActive : null,
              ]}>
              Espanol
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <SearchBar
            mode="input"
            placeholder="Search Merck manuals"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              executeSearch();
            }}
            containerStyle={styles.searchBar}
            rightElement={loading ? <ActivityIndicator size="small" /> : null}
          />
          <LiquidGlassButton
            title={loading ? 'Searching...' : 'Search'}
            onPress={() => {
              executeSearch();
            }}
            height={48}
            borderRadius={theme.borderRadius.md}
            tintColor={theme.colors.secondary}
            textStyle={styles.primaryButtonText}
            disabled={loading || !query.trim()}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading &&
        visibleEntries.length === 0 &&
        query.trim().length > 0 &&
        !error ? (
          <Text style={styles.emptyText}>
            No manuals found for this search.
          </Text>
        ) : null}

        <View style={styles.resultsWrap}>
          {visibleEntries.map(entry => (
            <View key={entry.id} style={styles.resultCard}>
              <Text style={styles.resultTitle}>{entry.title}</Text>
              <Text
                style={styles.resultSummary}
                numberOfLines={compact ? 2 : 4}>
                {entry.summaryText || 'No summary available.'}
              </Text>

              <View style={styles.resultActions}>
                <LiquidGlassButton
                  title="Open"
                  onPress={() => {
                    openExternal(entry.primaryUrl);
                  }}
                  height={42}
                  borderRadius={theme.borderRadius.md}
                  tintColor={theme.colors.secondary}
                  textStyle={styles.primaryButtonText}
                  shadowIntensity="medium"
                />
              </View>

              {entry.subLinks.length ? (
                <View style={styles.linkPills}>
                  {entry.subLinks.slice(0, compact ? 2 : 5).map(link => (
                    <Pressable
                      key={`${entry.id}-${link.label}`}
                      style={styles.linkPill}
                      onPress={() => {
                        openExternal(link.url);
                      }}>
                      <Text style={styles.linkPillText} numberOfLines={1}>
                        {link.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing['4'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      overflow: 'hidden',
    },
    content: {
      gap: theme.spacing['3'],
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
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
    },
    languageRow: {
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
      gap: theme.spacing['2'],
    },
    searchBar: {
      width: '100%',
    },
    errorText: {
      ...theme.typography.body12,
      color: theme.colors.error,
    },
    emptyText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    resultsWrap: {
      gap: theme.spacing['2'],
    },
    resultCard: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing['3'],
      gap: theme.spacing['2'],
    },
    resultTitle: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
    },
    resultSummary: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    resultActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: theme.spacing['2'],
    },
    linkPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
    },
    linkPill: {
      maxWidth: '100%',
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
    },
    linkPillText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    primaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
    secondaryButtonText: {
      ...theme.typography.body12,
      color: theme.colors.secondary,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

export default MerckSearchWidget;
