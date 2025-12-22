import React, {useMemo, useState, useRef, useCallback} from 'react';
import {View, Text, ScrollView, StyleSheet, ActivityIndicator} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import DocumentListItem from '@/features/documents/components/DocumentListItem';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {setSelectedCompanion} from '@/features/companion';
import {searchDocuments, clearSearchResults} from '@/features/documents/documentSlice';
import {createScreenContainerStyles, createErrorContainerStyles} from '@/shared/utils/screenStyles';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type DocumentSearchNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;

export const DocumentSearchScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentSearchNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = useState(0);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);
  const {searchResults = [], searchLoading = false, searchError = null} = useSelector(
    (state: RootState) => state.documents ?? {},
  );

  const [query, setQuery] = useState('');
  const lastQueryRef = useRef('');

  React.useEffect(() => {
    if (companions.length > 0 && selectedCompanionId === null) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  React.useEffect(() => {
    if (!query.trim()) {
      dispatch(clearSearchResults());
    }
  }, [query, dispatch]);

  React.useEffect(() => {
    if (lastQueryRef.current && selectedCompanionId) {
      dispatch(searchDocuments({companionId: selectedCompanionId, query: lastQueryRef.current}));
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
    dispatch(searchDocuments({companionId: selectedCompanionId, query: trimmed}));
  }, [query, selectedCompanionId, dispatch, searchResults.length]);

  React.useEffect(() => {
    if (!query.trim()) {
      dispatch(clearSearchResults());
      return;
    }
    const timer = setTimeout(() => {
      triggerSearch();
    }, 1000);
    return () => clearTimeout(timer);
  }, [query, selectedCompanionId, triggerSearch, dispatch]);

  const handleViewDocument = (documentId: string) => {
    navigation.navigate('DocumentPreview', {documentId});
  };

  const handleEditDocument = (documentId: string) => {
    navigation.navigate('EditDocument', {documentId});
  };

  return (
    <SafeArea>
      <View
        style={[styles.topSection, {paddingTop: insets.top}]}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive={false}
          style={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header
            title="Search documents"
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
          <SearchBar
            mode="input"
            placeholder="Search by title, category, or issuer"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={triggerSearch}
            autoFocus
            containerStyle={styles.searchBar}
            rightElement={searchLoading ? <ActivityIndicator size="small" /> : null}
          />
        </LiquidGlassCard>
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['1']}
            : null,
        ]}
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

        {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

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
          <View style={styles.resultsContainer}>
            {searchResults.map(doc => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                onPressView={handleViewDocument}
                onPressEdit={handleEditDocument}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createErrorContainerStyles(theme),
    contentContainer: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['6'],
    },
    topSection: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
    },
    topGlassCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing['3'],
      gap: theme.spacing['3'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    topGlassFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
    searchBar: {
      marginBottom: theme.spacing['2'],
      marginInline: theme.spacing['6'],
    },
    selector: {
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['4'],
    },
    loaderContainer: {
      paddingVertical: theme.spacing['8'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      paddingVertical: theme.spacing['8'],
      gap: theme.spacing['2'],
    },
    emptyTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    emptySubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    resultsContainer: {
      gap: theme.spacing['3'],
      paddingBottom: theme.spacing['10'],
    },
  });

export default DocumentSearchScreen;
