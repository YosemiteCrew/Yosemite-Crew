import React, {useEffect, useMemo} from 'react';
import {View, StyleSheet, ScrollView, Image, Text, ActivityIndicator, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import {CoParentCard} from '../../components/CoParentCard/CoParentCard';
import {selectCoParents, selectCoParentLoading, fetchCoParents} from '../../index';
import type {HomeStackParamList} from '@/navigation/types';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
} from '@/features/companion';
import {selectAuthUser} from '@/features/auth/selectors';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoParents'>;

export const CoParentsScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParents = useSelector(selectCoParents);
  const loading = useSelector(selectCoParentLoading);
  const authUser = useSelector(selectAuthUser);
  const companions = useSelector(selectCompanions);
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const selectedCompanion = useMemo(
    () =>
      companions.find(c => c.id === selectedCompanionId) ??
      companions[0] ??
      null,
    [companions, selectedCompanionId],
  );

  useEffect(() => {
    if (!selectedCompanionId && companions[0]?.id) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, dispatch, selectedCompanionId]);

  useEffect(() => {
    if (selectedCompanion?.id) {
      dispatch(
        fetchCoParents({
          companionId: selectedCompanion.id,
          companionName: selectedCompanion.name,
          companionImage: selectedCompanion.profileImage ?? undefined,
        }),
      );
    }
  }, [
    dispatch,
    selectedCompanion?.id,
    selectedCompanion?.name,
    selectedCompanion?.profileImage,
  ]);

  const visibleCoParents = useMemo(
    () =>
      coParents.filter(cp => {
        const isPrimary = (cp.role ?? '').toUpperCase().includes('PRIMARY');
        if (isPrimary && cp.parentId === authUser?.parentId) {
          return false;
        }
        return true;
      }),
    [authUser?.parentId, coParents],
  );

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleAdd = () => {
    if (!selectedCompanion?.id) {
      Alert.alert('Select companion', 'Please select a companion before adding a co-parent.');
      return;
    }
    navigation.navigate('AddCoParent');
  };

  const handleViewCoParent = (coParentId: string) => {
    navigation.navigate('EditCoParent', {coParentId});
  };

  const handleEditCoParent = (coParentId: string) => {
    navigation.navigate('EditCoParent', {coParentId});
  };

  // Show empty state when no co-parents
  if (!loading && visibleCoParents.length === 0) {
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
          <Text style={styles.emptyTitle}>
            Looks like your friends{'\n'}are busy!
          </Text>
          <Text style={styles.emptySubtitle}>
            No worries we can still ask them{'\n'}to play with your furry friends
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
          {visibleCoParents.map((coParent, index) => (
            <CoParentCard
              key={coParent.parentId || coParent.id}
              coParent={coParent}
              onPressView={() => handleViewCoParent(coParent.parentId || coParent.id)}
              onPressEdit={
                (coParent.role ?? '').toUpperCase().includes('PRIMARY')
                  ? undefined
                  : () => handleEditCoParent(coParent.parentId || coParent.id)
              }
              hideSwipeActions={(coParent.role ?? '').toUpperCase().includes('PRIMARY')}
              showEditAction={!(coParent.role ?? '').toUpperCase().includes('PRIMARY')}
              divider={index < visibleCoParents.length - 1}
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
      paddingVertical: theme.spacing[6],
      paddingBottom: theme.spacing[10],
    },
    selectorContainer: {
      paddingBottom: theme.spacing[4],
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
      ...theme.typography.businessSectionTitle20,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[3],
    },
    emptySubtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default CoParentsScreen;
