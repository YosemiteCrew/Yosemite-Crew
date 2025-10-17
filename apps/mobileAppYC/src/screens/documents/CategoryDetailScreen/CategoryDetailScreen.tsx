import React, {useMemo, useState} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {SearchBar} from '@/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {DocumentCard} from '@/components/common/DocumentCard/DocumentCard';
import {SubcategoryAccordion} from '@/components/common/SubcategoryAccordion/SubcategoryAccordion';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES, SUBCATEGORY_ICONS} from '@/constants/documents.constants';
import {setSelectedCompanion} from '@/features/companion';

type CategoryDetailNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type CategoryDetailRouteProp = RouteProp<DocumentStackParamList, 'CategoryDetail'>;

export const CategoryDetailScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<CategoryDetailNavigationProp>();
  const route = useRoute<CategoryDetailRouteProp>();
  const dispatch = useDispatch<AppDispatch>();

  const {categoryId} = route.params;
  const category = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);

  const [searchQuery, setSearchQuery] = useState('');

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);
  const documents = useSelector((state: RootState) => state.documents.documents);

  // Filter documents by category and companion
  const categoryDocuments = useMemo(() => {
    return documents.filter(
      doc =>
        doc.category === categoryId &&
        (!selectedCompanionId || doc.companionId === selectedCompanionId),
    );
  }, [documents, categoryId, selectedCompanionId]);

  // Group documents by subcategory
  const documentsBySubcategory = useMemo(() => {
    const grouped: Record<string, typeof categoryDocuments> = {};

    // Initialize all subcategories
    category?.subcategories.forEach(sub => {
      grouped[sub.id] = [];
    });

    // Group documents by subcategory
    categoryDocuments.forEach(doc => {
      if (grouped[doc.subcategory]) {
        grouped[doc.subcategory].push(doc);
      }
    });

    return grouped;
  }, [category, categoryDocuments]);

  React.useEffect(() => {
    if (companions.length > 0 && !selectedCompanionId) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

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

  return (
    <SafeArea>
      <Header title={category.label} showBackButton={true} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <SearchBar
          placeholder="Search through documents"
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchBar}
        />

        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={(id) => dispatch(setSelectedCompanion(id))}
          showAddButton={false}
          containerStyle={styles.companionSelector}
        />

        {category.subcategories.map(subcategory => {
          const subcategoryDocs = documentsBySubcategory[subcategory.id] || [];
          const subcategoryIcon = SUBCATEGORY_ICONS[subcategory.id] || category.icon;

          return (
            <SubcategoryAccordion
              key={subcategory.id}
              title={subcategory.label}
              subtitle={`${subcategoryDocs.length} file${subcategoryDocs.length !== 1 ? 's' : ''}`}
              icon={subcategoryIcon}
              defaultExpanded={false}>
              {subcategoryDocs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No documents found</Text>
                </View>
              ) : (
                subcategoryDocs.map(doc => {
                  // Don't allow edit for synced documents (health, hygiene)
                  const canEdit = !doc.isSynced && doc.category !== 'health' && doc.category !== 'hygiene';
                  return (
                    <DocumentCard
                      key={doc.id}
                      title={doc.title}
                      businessName={doc.businessName}
                      visitType={doc.visitType}
                      issueDate={doc.issueDate}
                      showEditAction={canEdit}
                      onPressView={() => handleViewDocument(doc.id)}
                      onPressEdit={canEdit ? () => handleEditDocument(doc.id) : undefined}
                      onPress={() => handleViewDocument(doc.id)}
                    />
                  );
                })
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
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[6],
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.error,
    },
    searchBar: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[2],
    },
    companionSelector: {
      marginBottom: theme.spacing[4],
    },
    emptyContainer: {
      paddingVertical: theme.spacing[4],
      alignItems: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
    },
  });
