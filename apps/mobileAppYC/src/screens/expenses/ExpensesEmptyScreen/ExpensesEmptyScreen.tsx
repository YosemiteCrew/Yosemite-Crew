import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {ExpenseStackParamList} from '@/navigation/types';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList>;

export const ExpensesEmptyScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Navigation>();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeArea>
      <Header
        title="Expenses"
        showBackButton
        onBack={handleBack}
      />
      <View style={styles.container}>
        <Image source={Images.emptyExpenseIllustration} style={styles.illustration} />
        <Text style={styles.title}>Zero Bucks Spent!</Text>
        <Text style={styles.subtitle}>
          It seems like you and your buddy is in saving mode!
        </Text>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing[6],
      backgroundColor: theme.colors.background,
    },
    illustration: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing[6],
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[3],
    },
    subtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
  });

export default ExpensesEmptyScreen;
