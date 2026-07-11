import React from 'react';
import {View, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {EmptyState} from '@/shared/components/common/EmptyState/EmptyState';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import type {DocumentStackParamList} from '@/navigation/types';
import {useDocumentNavigation} from '@/features/documents/hooks/useDocumentNavigation';

type DocumentsNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

export const EmptyDocumentsScreen: React.FC = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<DocumentsNavigationProp>();
  const {handleAddDocument} = useDocumentNavigation(navigation);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Documents"
          variant="root"
          showBackButton={false}
          glass={false}
        />
      }
      contentPadding={theme.spacing['0']}
      useSafeAreaView
      containerStyle={styles.safeArea}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <View style={[styles.container, contentPaddingStyle]}>
          <EmptyState
            testID="empty-documents"
            icon={
              <Ionicons
                name="folder-open-outline"
                size={44}
                color={theme.colors.blueText}
              />
            }
            title="Nothing in the drawer yet"
            description="Insurance papers, lab results and adoption records will live here, together and searchable."
            actionLabel="Add first document"
            actionIcon={
              <Ionicons name="add" size={18} color={theme.colors.ctaText} />
            }
            onAction={handleAddDocument}
          />
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.screen,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
