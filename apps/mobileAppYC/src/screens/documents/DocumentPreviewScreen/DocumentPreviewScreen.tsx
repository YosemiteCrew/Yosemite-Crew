import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert, Share} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';

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

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${document.title} - ${document.businessName}`,
        url: document.files[0]?.s3Url || '',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share document');
    }
  };

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
          {document.files.map((file, index) => (
            <View key={file.id} style={styles.previewCard}>
              {file.type.startsWith('image/') ? (
                <Image
                  source={{uri: file.uri}}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.pdfPlaceholder}>
                  <Image source={Images.documentIcon} style={styles.pdfIcon} />
                  <Text style={styles.pdfText}>{file.name}</Text>
                </View>
              )}
              <Text style={styles.pageNumber}>Page {index + 1} of {document.files.length}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Image source={Images.shareIcon} style={styles.shareIcon} />
        </TouchableOpacity>
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
    previewCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[4],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      alignItems: 'center',
    },
    previewImage: {
      width: '100%',
      height: 400,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing[2],
    },
    pdfPlaceholder: {
      width: '100%',
      height: 300,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing[2],
    },
    pdfIcon: {
      width: 64,
      height: 64,
      resizeMode: 'contain',
      marginBottom: theme.spacing[3],
    },
    pdfText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
    },
    pageNumber: {
      ...theme.typography.labelSmBold,
      color: theme.colors.textSecondary,
    },
    shareButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: theme.spacing[6],
      ...theme.shadows.lg,
    },
    shareIcon: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
  });
