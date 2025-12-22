import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import DocumentListItem from '@/features/documents/components/DocumentListItem';
import {CategoryTile} from '@/shared/components/common/CategoryTile/CategoryTile';
import {EmptyDocumentsScreen} from '../EmptyDocumentsScreen/EmptyDocumentsScreen';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {DOCUMENT_CATEGORIES} from '@/features/documents/constants';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {fetchDocuments} from '@/features/documents/documentSlice';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type DocumentsNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;

export const DocumentsScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentsNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  // Get companions from Redux
  const companions = useSelector((state: RootState) => state.companion.companions);

  // Get selected companion from Redux
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);

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
            title="Documents"
            showBackButton={false}
            onRightPress={handleAddDocument}
            rightIcon={Images.addIconDark}
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
            <View key={category.id} style={styles.categoryTileShadow}>
              <CategoryTile
                icon={category.icon}
                title={category.label}
                subtitle={`${category.fileCount} file${category.fileCount === 1 ? '' : 's'}`}
                isSynced={category.isSynced}
                onPress={() => handleCategoryPress(category.id)}
                containerStyle={styles.categoryTile}
              />
            </View>
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
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['24'], // Extra padding for tab bar
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
    section: {
      marginBottom: theme.spacing['4'],
    },
    categoryTile: {
      width: '100%',
    },
    categoryTileShadow: {
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.md,
    },
    sectionTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['3'],
    },
  });
