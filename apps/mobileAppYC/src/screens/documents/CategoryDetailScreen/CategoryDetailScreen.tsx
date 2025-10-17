import React, {useMemo, useState} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {SearchBar} from '@/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {DocumentCard} from '@/components/common/DocumentCard/DocumentCard';
import {CategoryTile} from '@/components/common/CategoryTile/CategoryTile';
import {useTheme} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES, SUBCATEGORY_ICONS} from '@/constants/documents.constants';

type CategoryDetailNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type CategoryDetailRouteProp = RouteProp<DocumentStackParamList, 'CategoryDetail'>;

export const CategoryDetailScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<CategoryDetailNavigationProp>();
  const route = useRoute<CategoryDetailRouteProp>();

  const {categoryId} = route.params;
  const category = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const companions = useSelector((state: RootState) => state.companion.companions);
  const documents = useSelector((state: RootState) => state.documents.documents);

  // Filter documents by category and companion
  const categoryDocuments = useMemo(() => {
    return documents.filter(
      doc =>
        doc.category === categoryId &&
        (!selectedCompanionId || doc.companionId === selectedCompanionId),
    );
  }, [documents, categoryId, selectedCompanionId]);

  // Get recent document (1 for category view)
  const recentDocument = useMemo(() => {
    return [...categoryDocuments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1);
  }, [categoryDocuments]);

  // Calculate subcategory counts
  const subcategoriesWithCounts = useMemo(() => {
    return (category?.subcategories || []).map(sub => {
      const count = categoryDocuments.filter(doc => doc.subcategory === sub.id).length;
      return {
        ...sub,
        fileCount: count,
      };
    });
  }, [category, categoryDocuments]);

  React.useEffect(() => {
    if (companions.length > 0 && !selectedCompanionId) {
      setSelectedCompanionId(companions[0].id);
    }
  }, [companions, selectedCompanionId]);

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

  const handleSubcategoryPress = (subcategoryId: string) => {
    navigation.navigate('SubcategoryDetail', {categoryId, subcategoryId});
  };

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
          onSelect={setSelectedCompanionId}
          showAddButton={false}
          containerStyle={styles.companionSelector}
        />

        {recentDocument.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {recentDocument.map(doc => (
              <DocumentCard
                key={doc.id}
                title={doc.title}
                businessName={doc.businessName}
                visitType={doc.visitType}
                issueDate={doc.issueDate}
                showEditAction={!doc.isSynced}
                onPressView={() => handleViewDocument(doc.id)}
                onPressEdit={() => handleEditDocument(doc.id)}
                onPress={() => handleViewDocument(doc.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          {subcategoriesWithCounts.map(subcategory => (
            <CategoryTile
              key={subcategory.id}
              icon={SUBCATEGORY_ICONS[subcategory.id] || category.icon}
              title={subcategory.label}
              subtitle={`${subcategory.fileCount} file${subcategory.fileCount !== 1 ? 's' : ''}`}
              isSynced={false}
              onPress={() => handleSubcategoryPress(subcategory.id)}
            />
          ))}
        </View>
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
    section: {
      marginBottom: theme.spacing[4],
    },
    sectionTitle: {
      ...theme.typography.headlineSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
    },
  });
