import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {createScreenContainerStyles, createErrorContainerStyles} from '@/shared/utils/screenStyles';
import AttachmentPreview from '@/shared/components/common/AttachmentPreview/AttachmentPreview';

type DocumentPreviewNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type DocumentPreviewRouteProp = RouteProp<DocumentStackParamList, 'DocumentPreview'>;

export const DocumentPreviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentPreviewNavigationProp>();
  const route = useRoute<DocumentPreviewRouteProp>();

  const {documentId} = route.params;

  const document = useSelector((state: RootState) =>
    state.documents.documents.find(doc => doc.id === documentId),
  );

  const companion = useSelector((state: RootState) =>
    document ? state.companion.companions.find(c => c.id === document.companionId) : null,
  );

  if (!document) {
    return (
      <SafeArea>
        <Header title="Blood Report" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Document not found</Text>
        </View>
      </SafeArea>
    );
  }

  // Sharing is handled inside AttachmentPreview for individual files

  const handleEdit = () => {
    navigation.navigate('EditDocument', {documentId});
  };

  // Only allow edit/delete for documents added by user from app, not from PMS
  const canEdit = document.isUserAdded;

  return (
    <SafeArea>
      <Header
        title={document.title}
        showBackButton={true}
        onBack={() => navigation.goBack()}
        onRightPress={canEdit ? handleEdit : undefined}
        rightIcon={canEdit ? Images.blackEdit : undefined}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{document.title} for {companion?.name || 'Unknown'}</Text>
          <Text style={styles.infoText}>{document.businessName}</Text>
          <Text style={styles.infoText}>{new Date(document.issueDate).toLocaleDateString()}</Text>
        </View>

        <View style={styles.documentPreview}>
          <AttachmentPreview attachments={document.files} />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createErrorContainerStyles(theme),
    infoCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[4],
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    infoTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
    },
    infoText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[1],
    },
    documentPreview: {
      gap: theme.spacing[4],
    },
  });
