import React, {useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector, useDispatch} from 'react-redux';
import {Button, Loading} from '../../../components';
import {useTheme} from '../../../hooks';
import {PetStackScreenProps} from '../../../navigation/types';
import {RootState} from '../../../store';
import {fetchPets} from '../../../store/slices/petSlice';
import {Pet} from '../../../store/types';

type Props = PetStackScreenProps<'PetList'>;

export const PetListScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const dispatch = useDispatch();
  const {pets, isLoading, error} = useSelector((state: RootState) => state.pets);

  useEffect(() => {
    dispatch(fetchPets() as any);
  }, [dispatch]);

  const renderPetItem = ({item}: {item: Pet}) => (
    <TouchableOpacity
      style={styles.petCard}
      onPress={() => navigation.navigate('PetDetails', {petId: item.id})}>
      <Image
        source={{uri: item.image || 'https://picsum.photos/80/80'}}
        style={styles.petImage}
      />
      <View style={styles.petInfo}>
        <Text style={styles.petName}>{item.name}</Text>
        <Text style={styles.petType}>{item.type} • {item.breed}</Text>
        <Text style={styles.petAge}>{item.age} years old</Text>
      </View>
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['4'],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing['6'],
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    addButton: {
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['2'],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['8'],
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: theme.spacing['4'],
    },
    emptyTitle: {
      ...theme.typography.h4,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    emptySubtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['8'],
    },
    petCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
      flexDirection: 'row',
      alignItems: 'center',
      ...theme.shadows.sm,
    },
    petImage: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.full,
      marginRight: theme.spacing['4'],
    },
    petInfo: {
      flex: 1,
    },
    petName: {
      ...theme.typography.h5,
      color: theme.colors.text,
      marginBottom: theme.spacing['1'],
    },
    petType: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['1'],
    },
    petAge: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    arrow: {
      marginLeft: theme.spacing['2'],
    },
    arrowText: {
      ...theme.typography.h4,
      color: theme.colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['8'],
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: theme.spacing['4'],
    },
  });

  if (isLoading) {
    return <Loading text="Loading your pets..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={() => dispatch(fetchPets() as any)}
            variant="outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>My Pets</Text>
          <Button
            title="Add Pet"
            onPress={() => navigation.navigate('AddPet')}
            size="small"
            style={styles.addButton}
          />
        </View>

        {pets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🐾</Text>
            <Text style={styles.emptyTitle}>No pets yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first furry friend to get started with pet care tracking
            </Text>
            <Button
              title="Add Your First Pet"
              onPress={() => navigation.navigate('AddPet')}
            />
          </View>
        ) : (
          <FlatList
            data={pets}
            renderItem={renderPetItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};