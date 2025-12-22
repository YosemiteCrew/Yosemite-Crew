import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import DocumentListItem from '@/features/documents/components/DocumentListItem';
import {SubcategoryAccordion} from '@/shared/components/common/SubcategoryAccordion/SubcategoryAccordion';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES, SUBCATEGORY_ICONS} from '@/features/documents/constants';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {fetchDocuments} from '@/features/documents/documentSlice';
import {formatLabel} from '@/shared/utils/helpers';
import {
  createScreenContainerStyles,
  createErrorContainerStyles,
  createEmptyStateStyles,
  createSearchAndSelectorStyles,
} from '@/shared/utils/screenStyles';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type CategoryDetailNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type CategoryDetailRouteProp = RouteProp<DocumentStackParamList, 'CategoryDetail'>;

export const CategoryDetailScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<CategoryDetailNavigationProp>();
  const route = useRoute<CategoryDetailRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  const {categoryId} = route.params;
  const category = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);
  const documents = useSelector((state: RootState) => state.documents.documents);

  // Filter documents by category and companion
  const categoryDocuments = useMemo(() => {
    return documents.filter(
      doc =>
        doc.category === categoryId &&
        (selectedCompanionId === null || doc.companionId === selectedCompanionId),
    );
  }, [documents, categoryId, selectedCompanionId]);

  // Group documents by subcategory
  const documentsBySubcategory = useMemo(() => {
    const grouped: Record<string, typeof categoryDocuments> = {};

    // Initialize all subcategories
    if (category?.subcategories) {
      for (const sub of category.subcategories) {
        grouped[sub.id] = [];
      }
    }

    // Group documents by subcategory
    for (const doc of categoryDocuments) {
      const bucketKey = doc.subcategory || 'other';
      if (!grouped[bucketKey]) {
        grouped[bucketKey] = [];
      }
      grouped[bucketKey].push(doc);
    }

    return grouped;
  }, [category, categoryDocuments]);

  const subcategoriesToRender = useMemo(() => {
    const existing = category?.subcategories ?? [];
    const extras = Object.keys(documentsBySubcategory)
      .filter(id => !existing.some(sub => sub.id === id))
      .map(id => ({
        id,
        label: formatLabel(id, 'Other'),
        fileCount: 0,
      }));
    return [...existing, ...extras];
  }, [category?.subcategories, documentsBySubcategory]);

  React.useEffect(() => {
    if (companions.length > 0 && selectedCompanionId === null) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  React.useEffect(() => {
    if (selectedCompanionId) {
      dispatch(fetchDocuments({companionId: selectedCompanionId}));
    }
  }, [dispatch, selectedCompanionId]);

  if (!category) {
    return (
      <SafeArea>
        <Header title="Category" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Category not found</Text>
        </View>
      </SafeArea>
    );
  }

  const handleViewDocument = (documentId: string) => {
    navigation.navigate('DocumentPreview', {documentId});
  };

  const handleEditDocument = (documentId: string) => {
    navigation.navigate('EditDocument', {documentId});
  };

  const handleAddDocument = () => {
    navigation.navigate('AddDocument');
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
            title={category.label}
            showBackButton={true}
            onBack={() => navigation.goBack()}
            rightIcon={Images.addIconDark}
            onRightPress={handleAddDocument}
            glass={false}
          />
          <SearchBar
            placeholder="Search through documents"
            mode="readonly"
            onPress={() => navigation.navigate('DocumentSearch')}
            containerStyle={styles.searchBar}
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
        showsVerticalScrollIndicator={false}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={(id) => dispatch(setSelectedCompanion(id))}
          showAddButton={false}
          containerStyle={styles.companionSelector}
          requiredPermission="documents"
          permissionLabel="documents"
        />

        {subcategoriesToRender.map(subcategory => {
          const subcategoryDocs = documentsBySubcategory[subcategory.id] || [];
          const subcategoryIcon = SUBCATEGORY_ICONS[subcategory.id] || category.icon;
          const subcategorySuffix = subcategoryDocs.length === 1 ? '' : 's';

          return (
            <SubcategoryAccordion
              key={subcategory.id}
              title={subcategory.label}
              subtitle={`${subcategoryDocs.length} file${subcategorySuffix}`}
              icon={subcategoryIcon}
              defaultExpanded={false}
              containerStyle={styles.accordionItem}>
              {subcategoryDocs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No documents found</Text>
                </View>
              ) : (
                subcategoryDocs.map(doc => (
                  <DocumentListItem
                    key={doc.id}
                    document={doc}
                    onPressView={handleViewDocument}
                    onPressEdit={handleEditDocument}
                  />
                ))
              )}
            </SubcategoryAccordion>
          );
        })}
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createErrorContainerStyles(theme),
    ...createEmptyStateStyles(theme),
    ...createSearchAndSelectorStyles(theme),
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
    companionSelector: {
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['4'],
    },
    accordionItem: {
      width: '100%',
    },
  });
