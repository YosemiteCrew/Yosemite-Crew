import React, {useEffect, useMemo} from 'react';
import {View, StyleSheet, ScrollView, Image, Text, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import {CoParentCard} from '../../components/CoParentCard/CoParentCard';
import {selectCoParents, selectCoParentLoading, fetchCoParents} from '../../index';
import {selectAuthUser} from '@/features/auth/selectors';
import type {HomeStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoParents'>;

export const CoParentsScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParents = useSelector(selectCoParents);
  const loading = useSelector(selectCoParentLoading);
  const authUser = useSelector(selectAuthUser);

  useEffect(() => {
    if (authUser?.id) {
      dispatch(fetchCoParents(authUser.id));
    }
  }, [authUser?.id, dispatch]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleAdd = () => {
    navigation.navigate('AddCoParent');
  };

  const handleViewCoParent = (coParentId: string) => {
    navigation.navigate('EditCoParent', {coParentId});
  };

  const handleEditCoParent = (coParentId: string) => {
    navigation.navigate('EditCoParent', {coParentId});
  };

  // Show empty state when no co-parents
  if (!loading && coParents.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Co-Parents"
          showBackButton
          onBack={handleBack}
          rightIcon={Images.addIconDark}
          onRightPress={handleAdd}
        />
        <View style={styles.emptyContainer}>
          <Image source={Images.coparentEmpty} style={styles.illustration} />
          <Text style={styles.emptyTitle}>Looks like your friends are busy!</Text>
          <Text style={styles.emptySubtitle}>
            No worries we can still ask them to play with your furry friends
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Co-Parents"
        showBackButton
        onBack={handleBack}
        rightIcon={Images.addIconDark}
        onRightPress={handleAdd}
      />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {coParents.map((coParent, index) => (
            <CoParentCard
              key={coParent.id}
              coParent={coParent}
              onPressView={() => handleViewCoParent(coParent.id)}
              onPressEdit={() => handleEditCoParent(coParent.id)}
              divider={index < coParents.length - 1}
            />
          ))}
        </ScrollView>
      )}
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
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      paddingBottom: theme.spacing[10],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[5],
    },
    illustration: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing[6],
    },
    emptyTitle: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[3],
    },
    emptySubtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default CoParentsScreen;
