// src/screens/pets/AddPetScreen/AddPetScreen.tsx - Fixed style array issue
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDispatch} from 'react-redux';
import {Button, Input} from '../../../components';
import {useTheme} from '../../../hooks';
import {PetStackScreenProps} from '../../../navigation/types';
import {addPet} from '../../../store/slices/petSlice';
import {AppDispatch} from '../../../store';

type Props = PetStackScreenProps<'AddPet'>;

export const AddPetScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');

  // Error state
  const [nameError, setNameError] = useState('');
  const [typeError, setTypeError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setNameError('');
    setTypeError('');

    if (!name.trim()) {
      setNameError('Pet name is required');
      isValid = false;
    }

    if (!type.trim()) {
      setTypeError('Pet type is required');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await dispatch(
        addPet({
          name: name.trim(),
          type: type.trim(),
          breed: breed.trim() || undefined,
          age: age ? parseInt(age, 10) : undefined,
          weight: weight ? parseFloat(weight) : undefined,
          description: description.trim() || undefined,
          ownerId: '1', // This would come from auth context
          image: `https://picsum.photos/200/200?random=${Date.now()}`,
        })
      );

      Alert.alert('Success', 'Pet added successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Failed to add pet', error);
      Alert.alert('Error', 'Failed to add pet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['6'],
    },
    header: {
      marginBottom: theme.spacing['8'],
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    form: {
      flex: 1,
    },
    inputContainer: {
      marginBottom: theme.spacing['4'],
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
    },
    rowInput: {
      flex: 1,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['6'],
      paddingTop: theme.spacing['4'],
    },
    buttonFlex: {
      flex: 1,
    },
  });

  // Fixed: Create proper style objects for the row inputs
  const getRowInputStyle = (): ViewStyle => ({
    ...styles.inputContainer,
    ...styles.rowInput,
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Add New Pet</Text>
              <Text style={styles.subtitle}>
                Fill in the details about your new furry friend
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Pet Name *"
                value={name}
                onChangeText={setName}
                placeholder="e.g., Buddy, Whiskers"
                error={nameError}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Type *"
                value={type}
                onChangeText={setType}
                placeholder="e.g., Dog, Cat, Bird"
                error={typeError}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Breed"
                value={breed}
                onChangeText={setBreed}
                placeholder="e.g., Golden Retriever, Persian"
                containerStyle={styles.inputContainer}
              />

              <View style={styles.row}>
                <Input
                  label="Age (years)"
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g., 3"
                  keyboardType="numeric"
                  containerStyle={getRowInputStyle()}
                />

                <Input
                  label="Weight (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="e.g., 25.5"
                  keyboardType="decimal-pad"
                  containerStyle={getRowInputStyle()}
                />
              </View>

              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Tell us about your pet's personality..."
                multiline
                numberOfLines={4}
                containerStyle={styles.inputContainer}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.buttonFlex}
            disabled={isLoading}
          />
          <Button
            title="Add Pet"
            onPress={handleSubmit}
            style={styles.buttonFlex}
            loading={isLoading}
            disabled={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
