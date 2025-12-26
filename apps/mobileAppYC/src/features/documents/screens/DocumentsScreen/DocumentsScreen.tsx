import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import DocumentListItem from '@/features/documents/components/DocumentListItem';
import {CategoryTile} from '@/shared/components/common/CategoryTile/CategoryTile';
import {EmptyDocumentsScreen} from '../EmptyDocumentsScreen/EmptyDocumentsScreen';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES} from '@/features/documents/constants';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {fetchDocuments} from '@/features/documents/documentSlice';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useCompanionFormScreen} from '@/shared/hooks/useFormScreen';
import {DocumentsListHeader} from '@/features/documents/components/DocumentsListHeader';
import {createSearchAndSelectorStyles} from '@/shared/utils/screenStyles';

type DocumentsNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;

export const DocumentsScreen: React.FC = () => {
  const {theme, dispatch, companions, selectedCompanionId} = useCompanionFormScreen();
  const navigation = useNavigation<DocumentsNavigationProp>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Get documents from Redux
  const documents = useSelector((state: RootState) => state.documents.documents);

  // Filter documents by selected companion
  const filteredDocuments = useMemo(() => {
    if (selectedCompanionId === null) {
      return documents;
    }
    return documents.filter(doc => doc.companionId === selectedCompanionId);
  }, [documents, selectedCompanionId]);

  // Get recent documents (latest 1)
  const recentDocuments = useMemo(() => {
    return [...filteredDocuments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1);
  }, [filteredDocuments]);

  // Calculate category file counts
  const categoriesWithCounts = useMemo(() => {
    return DOCUMENT_CATEGORIES.map(category => {
      const categoryDocs = filteredDocuments.filter(
        doc => doc.category === category.id,
      );
      return {
        ...category,
        fileCount: categoryDocs.length,
      };
    });
  }, [filteredDocuments]);

  // Set first companion as selected on mount
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

  // Show empty screen if no companions
  if (companions.length === 0) {
    return <EmptyDocumentsScreen />;
  }

  const handleAddDocument = () => {
    navigation.navigate('AddDocument');
  };

  const handleViewDocument = (documentId: string) => {
    navigation.navigate('DocumentPreview', {documentId});
  };

  const handleEditDocument = (documentId: string) => {
    navigation.navigate('EditDocument', {documentId});
  };

  const handleCategoryPress = (categoryId: string) => {
    navigation.navigate('CategoryDetail', {categoryId});
  };

  return (
    <LiquidGlassHeaderScreen
      header={
        <DocumentsListHeader
          title="Documents"
          searchPlaceholder="Search through documents"
          onSearchPress={() => navigation.navigate('DocumentSearch')}
          rightIcon={Images.addIconDark}
          onRightPress={handleAddDocument}
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
          {recentDocuments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent</Text>
              {recentDocuments.map(doc => (
                <DocumentListItem
                  key={doc.id}
                  document={doc}
                  onPressView={handleViewDocument}
                  onPressEdit={handleEditDocument}
                />
              ))}
            </View>
          )}

          <View style={styles.section}>
            {categoriesWithCounts.map(category => (
              <CategoryTile
                key={category.id}
                icon={category.icon}
                title={category.label}
                subtitle={`${category.fileCount} file${category.fileCount === 1 ? '' : 's'}`}
                isSynced={category.isSynced}
                onPress={() => handleCategoryPress(category.id)}
                containerStyle={styles.categoryTile}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createSearchAndSelectorStyles(theme),
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['32'], // Extra padding for tab bar and bottom breathing room
    },
    section: {
      marginBottom: theme.spacing['4'],
    },
    categoryTile: {
      width: '100%',
    },
    sectionTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['3'],
    },
  });
