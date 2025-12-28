import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import DocumentListItem from '@/features/documents/components/DocumentListItem';
import {SubcategoryAccordion} from '@/shared/components/common/SubcategoryAccordion/SubcategoryAccordion';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
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
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useCompanionFormScreen} from '@/shared/hooks/useFormScreen';
import {DocumentsListHeader} from '@/features/documents/components/DocumentsListHeader';

type CategoryDetailNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type CategoryDetailRouteProp = RouteProp<DocumentStackParamList, 'CategoryDetail'>;

export const CategoryDetailScreen: React.FC = () => {
  const {theme, dispatch, companions, selectedCompanionId} = useCompanionFormScreen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<CategoryDetailNavigationProp>();
  const route = useRoute<CategoryDetailRouteProp>();

  const {categoryId} = route.params;
  const category = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);

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
    <LiquidGlassHeaderScreen
      header={
        <DocumentsListHeader
          title={category.label}
          showBackButton={true}
          onBack={() => navigation.goBack()}
          rightIcon={Images.addIconDark}
          onRightPress={handleAddDocument}
          searchPlaceholder="Search through documents"
          onSearchPress={() => navigation.navigate('DocumentSearch')}
          searchContainerStyle={styles.searchBar}
        />
      }
      cardGap={theme.spacing['3']}
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          <CompanionSelector
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onSelect={id => dispatch(setSelectedCompanion(id))}
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
      )}
    </LiquidGlassHeaderScreen>
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
    accordionItem: {
      width: '100%',
    },
  });
