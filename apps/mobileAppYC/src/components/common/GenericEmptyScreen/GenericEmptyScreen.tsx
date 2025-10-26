import React from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '@/hooks';

interface GenericEmptyScreenProps {
  title: string;
  subtitle: string;
}

export const GenericEmptyScreen: React.FC<GenericEmptyScreenProps> = ({
  title,
  subtitle,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      padding: 24,
      gap: 16,
    },
    card: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 24,
      ...theme.shadows.xs,
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      marginBottom: 8,
      textAlign: 'left',
    },
    subtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
  });
