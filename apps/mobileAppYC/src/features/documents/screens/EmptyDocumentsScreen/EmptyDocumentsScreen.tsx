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

type DocumentsNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

export const EmptyDocumentsScreen: React.FC = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<DocumentsNavigationProp>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Documents always belong to a companion. If none exists yet, the
  // "AddDocument" form has no companion to attach to and can't be
  // submitted — send the user to add a companion first instead.
  const handleAddCompanion = () =>
    navigation.getParent<any>()?.navigate('HomeStack', {
      screen: 'AddCompanion',
    });

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
            title="Add a companion to get started"
            description="Insurance papers, lab results and adoption records are tied to a companion. Add one first to start uploading documents."
            actionLabel="Add a companion"
            actionIcon={
              <Ionicons name="add" size={18} color={theme.colors.ctaText} />
            }
            onAction={handleAddCompanion}
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
