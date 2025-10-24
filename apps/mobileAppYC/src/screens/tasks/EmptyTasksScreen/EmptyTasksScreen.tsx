import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export const EmptyTasksScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeArea>
      <Header title="Tasks" showBackButton={false} />
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <Image source={Images.emptyDocuments} style={styles.emptyImage} />
          <Text style={styles.title}>No tasks yet!</Text>
          <Text style={styles.subtitle}>
            Add a companion first to start creating tasks{'\\n'}for their health, hygiene, and care!
          </Text>
        </View>
      </View>
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
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing[6],
    },
    emptyImage: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing[6],
    },
    title: {
      ...theme.typography.headlineMedium,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default EmptyTasksScreen;
