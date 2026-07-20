import React from 'react';
import {View, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {EmptyState} from '@/shared/components/common/EmptyState/EmptyState';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import type {TaskStackParamList} from '@/navigation/types';

type TasksNavigationProp = NativeStackNavigationProp<TaskStackParamList>;

export const EmptyTasksScreen: React.FC = () => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<TasksNavigationProp>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Tasks always belong to a companion. If none exists yet, the "AddTask"
  // form has no companion to attach to and can't be submitted — send the
  // user to add a companion first instead of a form they can't complete.
  const handleAddCompanion = () =>
    navigation.getParent<any>()?.navigate('HomeStack', {
      screen: 'AddCompanion',
    });

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={t('tasks.title')}
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
            testID="empty-tasks"
            icon={
              <Ionicons
                name="checkbox-outline"
                size={42}
                color={theme.colors.blueText}
              />
            }
            title={t('tasks.emptyNoCompanionTitle')}
            description={t('tasks.emptyNoCompanionDescription')}
            actionLabel={t('tasks.emptyNoCompanionAction')}
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

export default EmptyTasksScreen;
