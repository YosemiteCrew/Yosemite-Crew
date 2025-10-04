import React, {useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, Image, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector, useDispatch} from 'react-redux';
import {Button, Loading} from '../../../components';
import {useTheme} from '../../../hooks';
import {PetStackScreenProps} from '../../../navigation/types';
import {RootState, AppDispatch} from '../../../store';
import {deletePet} from '../../../store/slices/petSlice';

type Props = PetStackScreenProps<'PetDetails'>;

export const PetDetailsScreen: React.FC<Props> = ({route, navigation}) => {
  const {petId} = route.params;
  const {theme} = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const {pets, isLoading} = useSelector((state: RootState) => state.pets);

  const pet = pets.find(p => p.id === petId);

  useEffect(() => {
    if (pet) {
      navigation.setOptions({title: pet.name});
    }
  }, [pet, navigation]);

  const handleEditPet = () => {
    // This would navigate to an edit screen in a real app
    Alert.alert('Edit Pet', 'Edit functionality would be implemented here', [
      {text: 'OK'},
    ]);
  };

  const handleAddRecord = () => {
    // This would navigate to add record screen in a real app
    Alert.alert('Add Record', 'Add health record functionality would be implemented here', [
      {text: 'OK'},
    ]);
  };

  const handleDeletePet = () => {
    Alert.alert(
      'Delete Pet',
      `Are you sure you want to delete ${pet?.name}? This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (pet) {
              try {
                await dispatch(deletePet(pet.id));
                navigation.goBack();
                Alert.alert('Success', `${pet.name} has been deleted.`);
              } catch (error) {
                console.error('Failed to delete pet', error);
                Alert.alert('Error', 'Failed to delete pet. Please try again.');
              }
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing['8'],
    },
    imageContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing['8'],
      backgroundColor: theme.colors.backgroundSecondary,
    },
    petImage: {
      width: 150,
      height: 150,
      borderRadius: theme.borderRadius.full,
      marginBottom: theme.spacing['4'],
    },
    petName: {
      ...theme.typography.h2,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing['1'],
    },
    petType: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    content: {
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['6'],
    },
    section: {
      marginBottom: theme.spacing['8'],
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.colors.text,
      marginBottom: theme.spacing['4'],
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
      ...theme.shadows.sm,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['2'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    lastInfoRow: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    infoValue: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.text,
      lineHeight: 24,
    },
    actionButtons: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['6'],
      gap: theme.spacing['3'],
    },
    buttonFlex: {
      flex: 1,
    },
    deleteButton: {
      marginTop: theme.spacing['4'],
      marginHorizontal: theme.spacing['6'],
    },
    notFoundContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['8'],
    },
    notFoundText: {
      ...theme.typography.h4,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['4'],
    },
    emptyStateIcon: {
      fontSize: 48,
      marginBottom: theme.spacing['4'],
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
      ...theme.shadows.sm,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      ...theme.typography.h4,
      color: theme.colors.primary,
      marginBottom: theme.spacing['1'],
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
  });

  if (isLoading) {
    return <Loading text="Loading pet details..." />;
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.emptyStateIcon}>🐾</Text>
          <Text style={styles.notFoundText}>Pet not found</Text>
          <Text style={[styles.description, {textAlign: 'center', marginBottom: theme.spacing['4']}]}>
            The pet you're looking for might have been removed or doesn't exist.
          </Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            variant="outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  const formatAge = (age?: number) => {
    if (!age) return 'Unknown';
    return age === 1 ? '1 year old' : `${age} years old`;
  };

  const formatWeight = (weight?: number) => {
    if (!weight) return 'Not specified';
    return `${weight} kg`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          <Image
            source={{uri: pet.image || 'https://picsum.photos/150/150'}}
            style={styles.petImage}
          />
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petType}>{pet.type} • {pet.breed || 'Mixed breed'}</Text>
        </View>

        <View style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.section}>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pet.weight || 0}</Text>
                <Text style={styles.statLabel}>kg</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Records</Text>
              </View>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{pet.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{pet.type}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Breed</Text>
                <Text style={styles.infoValue}>{pet.breed || 'Mixed breed'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age</Text>
                <Text style={styles.infoValue}>{formatAge(pet.age)}</Text>
              </View>
              <View style={[styles.infoRow, styles.lastInfoRow]}>
                <Text style={styles.infoLabel}>Weight</Text>
                <Text style={styles.infoValue}>{formatWeight(pet.weight)}</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {pet.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About {pet.name}</Text>
              <View style={styles.infoCard}>
                <Text style={styles.description}>{pet.description}</Text>
              </View>
            </View>
          )}

          {/* Care History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Care History</Text>
            <View style={styles.infoCard}>
              <Text style={styles.description}>
                📅 No care records yet. Start tracking {pet.name}'s health and activities by adding records.
              </Text>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.infoCard}>
              <Text style={styles.description}>
                🏠 Added to family on {new Date(pet.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          title="Edit Pet"
          onPress={handleEditPet}
          variant="outline"
          style={styles.buttonFlex}
        />
        <Button
          title="Add Record"
          onPress={handleAddRecord}
          style={styles.buttonFlex}
        />
      </View>

      {/* Delete Button */}
      <View style={styles.deleteButton}>
        <Button
          title="Delete Pet"
          onPress={handleDeletePet}
          variant="ghost"
        />
      </View>
    </SafeAreaView>
  );
};
