import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect as useReactEffect,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {Document} from '@/features/documents/types';
import {setSelectedCompanion} from '@/features/companion';
import {
  searchDocuments,
  clearSearchResults,
} from '@/features/documents/documentSlice';
import {formatLabel} from '@/shared/utils/helpers';
import {createAllCommonStyles} from '@/shared/utils/screenStyles';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type DocumentSearchNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

const RECENT_SEARCH_LIMIT = 6;

const formatMetaDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-US', {day: 'numeric', month: 'short'});
};

const buildMetaLine = (document: Document): string =>
  [
    formatLabel(document.category, ''),
    formatLabel(document.subcategory || document.visitType, ''),
    formatMetaDate(document.issueDate),
  ]
    .filter(Boolean)
    .join(' · ');

const canEditDocument = (document: Document): boolean =>
  document.isUserAdded && !document.uploadedByPmsUserId;

export const DocumentSearchScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentSearchNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();

  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const {
    searchResults = [],
    searchLoading = false,
    searchError = null,
  } = useSelector((state: RootState) => state.documents ?? {});

  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const lastQueryRef = useRef('');

  useReactEffect(() => {
    if (companions.length > 0 && selectedCompanionId === null) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  useReactEffect(() => {
    if (!query.trim()) {
      dispatch(clearSearchResults());
    }
  }, [query, dispatch]);

  useReactEffect(() => {
    if (lastQueryRef.current && selectedCompanionId) {
      dispatch(
        searchDocuments({
          companionId: selectedCompanionId,
          query: lastQueryRef.current,
        }),
      );
    }
  }, [dispatch, selectedCompanionId]);

  const triggerSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || !selectedCompanionId) {
      dispatch(clearSearchResults());
      return;
    }
    if (trimmed === lastQueryRef.current && searchResults.length) {
      return;
    }
    lastQueryRef.current = trimmed;
    dispatch(
      searchDocuments({companionId: selectedCompanionId, query: trimmed}),
    );
  }, [query, selectedCompanionId, dispatch, searchResults.length]);

  const triggerSearchRef = useRef(triggerSearch);
  triggerSearchRef.current = triggerSearch;

  useReactEffect(() => {
    if (!query.trim()) {
      dispatch(clearSearchResults());
      return;
    }
    const timer = setTimeout(() => {
      triggerSearchRef.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [query, selectedCompanionId, dispatch]);

  const recordRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return;
    }
    setRecentSearches(prev =>
      [
        trimmed,
        ...prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, RECENT_SEARCH_LIMIT),
    );
  }, []);

  const handleSubmit = useCallback(() => {
    recordRecentSearch(query);
    triggerSearch();
  }, [query, recordRecentSearch, triggerSearch]);

  const handleRecentSearchPress = useCallback((term: string) => {
    setQuery(term);
  }, []);

  const handleViewDocument = (documentId: string) => {
    navigation.navigate('DocumentPreview', {documentId});
  };

  const handleEditDocument = (documentId: string) => {
    navigation.navigate('EditDocument', {documentId});
  };

  const highlightTerm = query.trim();

  const renderHighlightedTitle = (title: string): React.ReactNode => {
    if (!highlightTerm) {
      return title;
    }
    const lowerTitle = title.toLowerCase();
    const lowerTerm = highlightTerm.toLowerCase();
    const segments: React.ReactNode[] = [];
    let cursor = 0;
    let matchIndex = lowerTitle.indexOf(lowerTerm, cursor);
    while (matchIndex !== -1) {
      if (matchIndex > cursor) {
        segments.push(title.slice(cursor, matchIndex));
      }
      const matchEnd = matchIndex + highlightTerm.length;
      segments.push(
        <Text key={`hl-${matchIndex}`} style={styles.highlight}>
          {title.slice(matchIndex, matchEnd)}
        </Text>,
      );
      cursor = matchEnd;
      matchIndex = lowerTitle.indexOf(lowerTerm, cursor);
    }
    if (cursor < title.length) {
      segments.push(title.slice(cursor));
    }
    return segments;
  };

  const selectedCompanion = companions.find(
    companion => companion.id === selectedCompanionId,
  );
  const scopeLabel = selectedCompanion?.name
    ? `${selectedCompanion.name}'s documents`
    : 'your documents';
  const resultsCountLabel = `${searchResults.length} ${
    searchResults.length === 1 ? 'result' : 'results'
  } across ${scopeLabel}`;

  return (
    <LiquidGlassHeaderScreen
      header={
        <View style={styles.searchHeaderRow}>
          <SearchBar
            mode="input"
            placeholder="Search by title, category, or issuer"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            autoFocus
            containerStyle={styles.searchField}
            rightElement={
              searchLoading ? <ActivityIndicator size="small" /> : null
            }
          />
          <PressableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="search-cancel-button"
            hitSlop={{
              top: theme.spacing['2'],
              bottom: theme.spacing['2'],
              left: theme.spacing['2'],
              right: theme.spacing['2'],
            }}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </PressableOpacity>
        </View>
      }
      contentPadding={theme.spacing['1']}
      cardGap={theme.spacing['3']}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, contentPaddingStyle]}
          keyboardShouldPersistTaps="handled">
          <CompanionSelector
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onSelect={id => dispatch(setSelectedCompanion(id))}
            showAddButton={false}
            containerStyle={styles.selector}
            requiredPermission="documents"
            permissionLabel="documents"
          />

          {searchError ? (
            <Text style={styles.errorText}>{searchError}</Text>
          ) : null}

          {searchLoading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator />
            </View>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No documents found</Text>
              <Text style={styles.emptySubtitle}>
                Try another keyword or select a different pet to search.
              </Text>
            </View>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <>
              <Text style={styles.resultsCount}>{resultsCountLabel}</Text>
              <View style={styles.resultsContainer}>
                {searchResults.map(doc => (
                  <PressableOpacity
                    key={doc.id}
                    style={styles.resultRow}
                    activeOpacity={0.85}
                    onPress={() => handleViewDocument(doc.id)}
                    onLongPress={
                      canEditDocument(doc)
                        ? () => handleEditDocument(doc.id)
                        : undefined
                    }
                    accessibilityRole="button"
                    accessibilityLabel={doc.title}
                    testID={`doc-item-${doc.id}`}>
                    <View style={styles.resultIconTile}>
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color={theme.colors.blueText}
                      />
                    </View>
                    <View style={styles.resultTextBlock}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {renderHighlightedTitle(doc.title)}
                      </Text>
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {buildMetaLine(doc)}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color={theme.colors.inkFaint2}
                    />
                  </PressableOpacity>
                ))}
              </View>
            </>
          )}

          {recentSearches.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.recentHeader}>Recent searches</Text>
              <View style={styles.recentChips}>
                {recentSearches.map(term => (
                  <PressableOpacity
                    key={term}
                    style={styles.recentChip}
                    activeOpacity={0.85}
                    onPress={() => handleRecentSearchPress(term)}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${term}`}
                    testID={`recent-search-${term}`}>
                    <Text style={styles.recentChipLabel}>{term}</Text>
                  </PressableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) => {
  const commonStyles = createAllCommonStyles(theme);
  return StyleSheet.create({
    ...commonStyles,
    contentContainer: {
      ...commonStyles.contentContainer,
      paddingHorizontal: theme.spacing['5'],
    },
    searchHeaderRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing['2.5'],
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['3'],
    },
    searchField: {
      flex: 1,
      backgroundColor: theme.colors.fieldBg,
      borderColor: theme.colors.blue,
      borderWidth: 1.5,
      boxShadow: `0px 0px 0px 3px ${theme.colors.blueSoft}`,
    },
    cancelLabel: {
      ...theme.typography.labelSmall,
      fontWeight: '600' as const,
      color: theme.colors.blueText,
    },
    selector: {
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['4'],
    },
    loaderContainer: {
      paddingVertical: theme.spacing['8'],
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    emptyState: {
      paddingVertical: theme.spacing['8'],
      gap: theme.spacing['2'],
    },
    emptyTitle: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
    },
    emptySubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    resultsCount: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
      marginBottom: theme.spacing['2'],
    },
    resultsContainer: {
      gap: theme.spacing['2.5'],
    },
    resultRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.cardSmall,
      ...theme.shadows.card,
    },
    resultIconTile: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    resultTextBlock: {
      flex: 1,
    },
    resultTitle: {
      ...theme.typography.body14,
      fontWeight: '600' as const,
      color: theme.colors.inkBody,
    },
    resultMeta: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
      marginTop: theme.spacing['0'],
    },
    highlight: {
      backgroundColor: theme.colors.blueSoft,
      color: theme.colors.navActive,
      borderRadius: 4,
    },
    recentSection: {
      marginTop: theme.spacing['5'],
    },
    recentHeader: {
      ...theme.typography.eyebrow,
      color: theme.colors.inkFaint,
    },
    recentChips: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: theme.spacing['2'],
      marginTop: theme.spacing['2.5'],
    },
    recentChip: {
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['3.5'],
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.chip,
    },
    recentChipLabel: {
      ...theme.typography.labelXs,
      color: theme.colors.inkMuted,
    },
  });
};

export default DocumentSearchScreen;
