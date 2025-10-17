import React, {useMemo, useState} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {SearchBar} from '@/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {DocumentCard} from '@/components/common/DocumentCard/DocumentCard';
import {CategoryTile} from '@/components/common/CategoryTile/CategoryTile';
import {EmptyDocumentsScreen} from '../EmptyDocumentsScreen/EmptyDocumentsScreen';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES} from '@/constants/documents.constants';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';

type DocumentsNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;

export const DocumentsScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentsNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();

  const [searchQuery, setSearchQuery] = useState('');

  // Get companions from Redux
  const companions = useSelector((state: RootState) => state.companion.companions);

  // Get selected companion from Redux
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);

  // Get documents from Redux
  const documents = useSelector((state: RootState) => state.documents.documents);

  // Filter documents by selected companion
  const filteredDocuments = useMemo(() => {
    if (!selectedCompanionId) return documents;
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
    if (companions.length > 0 && !selectedCompanionId) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

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
    <SafeArea>
      <Header
        title="Documents"
        showBackButton={false}
        onRightPress={handleAddDocument}
        rightIcon={Images.addIconDark}
      />
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

        {recentDocuments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {recentDocuments.map(doc => {
              // Don't allow edit for synced documents (health, hygiene maintenance)
              const canEdit =
                !doc.isSynced && doc.category !== 'health' && doc.category !== 'hygiene-maintenance';
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
            })}
          </View>
        )}

        <View style={styles.section}>
          {categoriesWithCounts.map(category => (
            <CategoryTile
              key={category.id}
              icon={category.icon}
              title={category.label}
              subtitle={`${category.fileCount} file${category.fileCount !== 1 ? 's' : ''}`}
              isSynced={category.isSynced}
              onPress={() => handleCategoryPress(category.id)}
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
      paddingBottom: theme.spacing[24], // Extra padding for tab bar
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
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
    },
  });
