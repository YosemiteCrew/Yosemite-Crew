import React, {useCallback, useEffect, useMemo} from 'react';
import {View, StyleSheet, FlatList, Image, Text, Alert} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import type {AppDispatch, RootState} from '@/app/store';
import type {Theme} from '@/theme';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {SkeletonList} from '@/shared/components/common';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {Images} from '@/assets/images';
import {CoParentCard} from '../../components/CoParentCard/CoParentCard';
import {fetchCoParents} from '../../thunks';
import {selectCoParents, selectCoParentLoading} from '../../selectors';
import type {HomeStackParamList} from '@/navigation/types';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
} from '@/features/companion';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoParents'>;

export const CoParentsScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParents = useSelector(selectCoParents);
  const loading = useSelector(selectCoParentLoading);
  const companions = useSelector(selectCompanions);
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const companionAccess = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? {},
  );
  const defaultAccess = useSelector(
    (state: RootState) => state.coParent?.defaultAccess ?? null,
  );
  const selectedCompanion = useMemo(
    () =>
      companions.find(c => c.id === selectedCompanionId) ??
      companions[0] ??
      null,
    [companions, selectedCompanionId],
  );
  const currentAccess =
    selectedCompanion?.id && companionAccess[selectedCompanion.id]
      ? companionAccess[selectedCompanion.id]
      : defaultAccess;
  const canAddCoParent = (currentAccess?.role ?? '')
    .toUpperCase()
    .includes('PRIMARY');
  const companionName = selectedCompanion?.name?.trim() || 'your companion';

  useEffect(() => {
    if (!selectedCompanionId && companions[0]?.id) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, dispatch, selectedCompanionId]);

  useFocusEffect(
    useCallback(() => {
      if (!selectedCompanion?.id) {
        return;
      }
      dispatch(
        fetchCoParents({
          companionId: selectedCompanion.id,
          companionName: selectedCompanion.name,
          companionImage: selectedCompanion.profileImage ?? undefined,
        }),
      );
    }, [
      dispatch,
      selectedCompanion?.id,
      selectedCompanion?.name,
      selectedCompanion?.profileImage,
    ]),
  );

  const visibleCoParents = useMemo(() => coParents, [coParents]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleAdd = () => {
    if (!selectedCompanion?.id) {
      Alert.alert(
        'Select companion',
        'Please select a companion before adding a co-parent.',
      );
      return;
    }
    navigation.navigate('AddCoParent');
  };

  const handleViewCoParent = useCallback(
    (coParentId: string) => {
      navigation.navigate('EditCoParent', {coParentId});
    },
    [navigation],
  );

  const handleEditCoParent = useCallback(
    (coParentId: string) => {
      navigation.navigate('EditCoParent', {coParentId});
    },
    [navigation],
  );

  const renderCoParent = useCallback(
    (renderItemInfo: {
      item: (typeof visibleCoParents)[number];
      index: number;
    }) => {
      const {item: coParent, index} = renderItemInfo;
      const isPrimaryEntry = (coParent.role ?? '')
        .toUpperCase()
        .includes('PRIMARY');
      const targetId = coParent.parentId || coParent.id;

      return (
        <CoParentCard
          coParent={coParent}
          onPressView={
            isPrimaryEntry ? undefined : () => handleViewCoParent(targetId)
          }
          onPressEdit={
            isPrimaryEntry ? undefined : () => handleEditCoParent(targetId)
          }
          hideSwipeActions={isPrimaryEntry}
          showEditAction={!isPrimaryEntry}
          divider={index < visibleCoParents.length - 1}
        />
      );
    },
    [handleEditCoParent, handleViewCoParent, visibleCoParents.length],
  );

  // Show empty state when no co-parents
  if (!loading && visibleCoParents.length === 0) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Co-Parents"
            showBackButton
            onBack={handleBack}
            rightIcon={canAddCoParent ? Images.addIconDark : undefined}
            onRightPress={canAddCoParent ? handleAdd : undefined}
            glass={false}
          />
        }
        cardGap={theme.spacing['4']}
        contentPadding={theme.spacing['4']}>
        {contentPaddingStyle => (
          <View style={[styles.container, contentPaddingStyle]}>
            <View style={styles.emptyContainer}>
              <Image
                source={Images.coparentEmpty}
                style={styles.illustration}
              />
              <Text style={styles.emptyTitle}>
                Looks like your friends{'\n'}are busy!
              </Text>
              <Text style={styles.emptySubtitle}>
                No worries we can still ask them{'\n'}to play with your furry
                friends
              </Text>
            </View>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Co-Parents"
          showBackButton
          onBack={handleBack}
          rightIcon={canAddCoParent ? Images.addIconDark : undefined}
          onRightPress={canAddCoParent ? handleAdd : undefined}
          glass={false}
        />
      }
      cardGap={theme.spacing['4']}
      contentPadding={theme.spacing['4']}>
      {contentPaddingStyle => (
        <>
          {loading ? (
            <SkeletonList
              showHeader={false}
              showFilters={false}
              style={contentPaddingStyle}
            />
          ) : (
            <FlatList
              data={visibleCoParents}
              keyExtractor={coParent => coParent.parentId || coParent.id}
              renderItem={renderCoParent}
              style={styles.scrollView}
              contentContainerStyle={[styles.content, contentPaddingStyle]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={styles.intro}>
                  Everyone who cares for {companionName} sees the same record,
                  the same reminders, the same vet thread.
                </Text>
              }
              ListFooterComponent={
                <View style={styles.footer}>
                  {canAddCoParent && (
                    <PressableOpacity
                      activeOpacity={0.85}
                      onPress={handleAdd}
                      style={styles.inviteButton}>
                      <Icon
                        name="add"
                        size={17}
                        color={theme.colors.blueText}
                      />
                      <Text style={styles.inviteButtonText}>
                        Invite a co-parent
                      </Text>
                    </PressableOpacity>
                  )}
                  <View style={styles.infoBanner}>
                    <Icon
                      name="information-circle-outline"
                      size={17}
                      color={theme.colors.navActive}
                      style={styles.infoBannerIcon}
                    />
                    <Text style={styles.infoBannerText}>
                      Co-parents sign in with their own account. You choose what
                      each person can see and do.
                    </Text>
                  </View>
                </View>
              }
            />
          )}
        </>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['3'],
    },
    intro: {
      ...theme.typography.body14,
      color: theme.colors.inkMuted,
      marginBottom: theme.spacing['1'],
    },
    footer: {
      gap: theme.spacing['3'],
      marginTop: theme.spacing['1'],
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      height: 50,
      borderRadius: theme.borderRadius.field,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.divider,
    },
    inviteButtonText: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.blueText,
    },
    infoBanner: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3.5'],
      backgroundColor: theme.colors.blueSoft,
      borderRadius: theme.borderRadius.field,
    },
    infoBannerIcon: {
      marginTop: 1,
    },
    infoBannerText: {
      ...theme.typography.body13,
      flex: 1,
      color: theme.colors.navActive,
    },
    selectorContainer: {
      paddingBottom: theme.spacing['4'],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['5'],
    },
    illustration: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing['6'],
    },
    emptyTitle: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
      textAlign: 'center',
      marginBottom: theme.spacing['3'],
    },
    emptySubtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
  });

export default CoParentsScreen;
