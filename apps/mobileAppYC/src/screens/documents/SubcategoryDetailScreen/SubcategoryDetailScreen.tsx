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
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES} from '@/constants/documents.constants';

type SubcategoryDetailNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type SubcategoryDetailRouteProp = RouteProp<DocumentStackParamList, 'SubcategoryDetail'>;

export const SubcategoryDetailScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<SubcategoryDetailNavigationProp>();
  const route = useRoute<SubcategoryDetailRouteProp>();

  const {categoryId, subcategoryId} = route.params;
  const category = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);
  const subcategory = category?.subcategories.find(s => s.id === subcategoryId);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const companions = useSelector((state: RootState) => state.companion.companions);
  const documents = useSelector((state: RootState) => state.documents.documents);

  // Filter documents by subcategory and companion
  const subcategoryDocuments = useMemo(() => {
    return documents.filter(
      doc =>
        doc.category === categoryId &&
        doc.subcategory === subcategoryId &&
        (!selectedCompanionId || doc.companionId === selectedCompanionId),
    );
  }, [documents, categoryId, subcategoryId, selectedCompanionId]);

  // Group documents by visit type
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, typeof subcategoryDocuments> = {};
    subcategoryDocuments.forEach(doc => {
      if (!groups[doc.visitType]) {
        groups[doc.visitType] = [];
      }
      groups[doc.visitType].push(doc);
    });
    return groups;
  }, [subcategoryDocuments]);

  React.useEffect(() => {
    if (companions.length > 0 && !selectedCompanionId) {
      setSelectedCompanionId(companions[0].id);
    }
  }, [companions, selectedCompanionId]);

  if (!category || !subcategory) {
    return (
      <SafeArea>
        <Header title="Subcategory" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Subcategory not found</Text>
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
      <Header title={subcategory.label} showBackButton={true} onBack={() => navigation.goBack()} />
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

        {Object.keys(groupedDocuments).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No documents found</Text>
          </View>
        ) : (
          Object.entries(groupedDocuments).map(([visitType, docs]) => (
            <SubcategoryAccordion
              key={visitType}
              title={visitType.charAt(0).toUpperCase() + visitType.slice(1)}
              subtitle={`${docs.length} file${docs.length !== 1 ? 's' : ''}`}
              defaultExpanded={false}>
              {docs.map(doc => (
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
            </SubcategoryAccordion>
          ))
        )}
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
      paddingVertical: theme.spacing[8],
      alignItems: 'center',
    },
    emptyText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.textSecondary,
    },
  });
