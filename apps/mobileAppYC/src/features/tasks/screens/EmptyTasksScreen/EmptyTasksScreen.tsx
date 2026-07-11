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
import type {TaskStackParamList} from '@/navigation/types';

type TasksNavigationProp = NativeStackNavigationProp<TaskStackParamList>;

export const EmptyTasksScreen: React.FC = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<TasksNavigationProp>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleAddTask = () => navigation.navigate('AddTask');

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Tasks"
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
            title="Nothing on the list"
            description="Doses, grooming and feeding plans will land here, with reminders that arrive on time."
            actionLabel="Add first task"
            actionIcon={
              <Ionicons name="add" size={18} color={theme.colors.ctaText} />
            }
            onAction={handleAddTask}
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
