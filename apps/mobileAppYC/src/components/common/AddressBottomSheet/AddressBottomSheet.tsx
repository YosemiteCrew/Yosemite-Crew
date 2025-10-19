import React, {useState, forwardRef, useImperativeHandle, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import CustomBottomSheet from '../BottomSheet/BottomSheet';
import type {BottomSheetRef} from '../BottomSheet/BottomSheet';
import {Input} from '../Input/Input';
import LiquidGlassButton from '../LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../../hooks';
import {Images} from '../../../assets/images';
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  MissingApiKeyError,
  type PlaceSuggestion,
} from '../../../services/maps/googlePlaces';

export interface AddressBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface Address {
  addressLine?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

export interface AddressBottomSheetProps {
  selectedAddress: Address;
  onSave: (address: Address) => void;
}

export const AddressBottomSheet = forwardRef<
  AddressBottomSheetRef,
  AddressBottomSheetProps
>(({selectedAddress, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempAddress, setTempAddress] = useState<Address>(selectedAddress);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetchingAddressSuggestions, setIsFetchingAddressSuggestions] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState<string | null>(null);
  const skipNextAutocompleteRef = useRef(false);
  const lastAutocompleteSignatureRef = useRef<string>('');

  const styles = createStyles(theme);

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempAddress(selectedAddress);
      setAddressQuery(selectedAddress.addressLine || '');
      setAddressSuggestions([]);
      setAddressLookupError(null);
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  useEffect(() => {
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const search = addressQuery.trim();
    if (search.length < 3) {
      setAddressSuggestions([]);
      setAddressLookupError(null);
      lastAutocompleteSignatureRef.current = '';
      return;
    }

    const signature = `${search}`;

    if (signature === lastAutocompleteSignatureRef.current) {
      return;
    }

    lastAutocompleteSignatureRef.current = signature;

    let isActive = true;
    setIsFetchingAddressSuggestions(true);
    const timeoutId = setTimeout(async () => {
      try {
        const suggestions = await fetchPlaceSuggestions({
          query: search,
        });
        if (!isActive) {
          return;
        }
        setAddressSuggestions(suggestions);
        setAddressLookupError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }
        if (error instanceof MissingApiKeyError) {
          setAddressLookupError(
            'Address autocomplete is unavailable. Please enter your address manually.',
          );
        } else {
          setAddressLookupError('Unable to fetch address suggestions.');
        }
        setAddressSuggestions([]);
      } finally {
        if (isActive) {
          setIsFetchingAddressSuggestions(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [addressQuery]);

  const handleAddressSuggestionPress = async (suggestion: PlaceSuggestion) => {
    skipNextAutocompleteRef.current = true;
    lastAutocompleteSignatureRef.current = '';
    setIsFetchingAddressSuggestions(true);
    try {
      const details = await fetchPlaceDetails(suggestion.placeId);
      const addressLine = details.addressLine ?? suggestion.primaryText;

      setTempAddress(prev => ({
        ...prev,
        addressLine,
        city: details.city || prev.city,
        stateProvince: details.stateProvince || prev.stateProvince,
        postalCode: details.postalCode || prev.postalCode,
        country: details.country || prev.country,
      }));
      setAddressQuery(addressLine);

      setAddressLookupError(null);
      setAddressSuggestions([]);
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        setAddressLookupError(
          'Address autocomplete is unavailable. Please enter your address manually.',
        );
      } else {
        setAddressLookupError('Unable to fetch the selected address details.');
      }
    } finally {
      setAddressSuggestions([]);
      setIsFetchingAddressSuggestions(false);
    }
  };

  const handleSave = () => {
    onSave(tempAddress);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempAddress(selectedAddress);
    setAddressQuery(selectedAddress.addressLine || '');
    setAddressSuggestions([]);
    setAddressLookupError(null);
    bottomSheetRef.current?.close();
  };

  const handleFieldChange = (field: keyof Address, value: string) => {
    setTempAddress(prev => ({ ...prev, [field]: value }));
    if (field === 'addressLine') {
      setAddressQuery(value);
    }
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['60%', '80%']}
      initialIndex={-1}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={true}
      enableOverDrag={true}
      enableBackdrop={true}
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      contentType="view"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Address
          </Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image
              source={Images.crossIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Address Line with Autocomplete */}
          <View style={styles.inputContainer}>
            <Input
              label="Address"
              value={tempAddress.addressLine || ''}
              onChangeText={(value) => handleFieldChange('addressLine', value)}
              error={addressLookupError || undefined}
              multiline
              maxLength={200}
              containerStyle={styles.inputContainer}
            />

            {(isFetchingAddressSuggestions || addressSuggestions.length > 0 || addressLookupError) && (
              <View style={styles.addressAutocompleteContainer}>
                {isFetchingAddressSuggestions ? (
                  <View style={styles.addressAutocompleteLoadingRow}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.addressAutocompleteLoadingText}>Searching for addresses…</Text>
                  </View>
                ) : null}
                {!isFetchingAddressSuggestions &&
                  addressSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={suggestion.placeId}
                      style={[
                        styles.addressSuggestionItem,
                        index === addressSuggestions.length - 1 && styles.addressSuggestionItemLast,
                      ]}
                      onPress={() => handleAddressSuggestionPress(suggestion)}
                    >
                      <Text style={styles.addressSuggestionPrimary}>{suggestion.primaryText}</Text>
                      {suggestion.secondaryText ? (
                        <Text style={styles.addressSuggestionSecondary}>{suggestion.secondaryText}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                {addressLookupError && !isFetchingAddressSuggestions ? (
                  <Text style={styles.addressSuggestionError}>{addressLookupError}</Text>
                ) : null}
                {(isFetchingAddressSuggestions || addressSuggestions.length > 0) && (
                  <Text style={styles.addressPoweredBy}>Powered by Google</Text>
                )}
              </View>
            )}
          </View>

          {/* City and Postal Code Row */}
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="City"
                value={tempAddress.city || ''}
                onChangeText={(value) => handleFieldChange('city', value)}
                maxLength={50}
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Postal code"
                value={tempAddress.postalCode || ''}
                onChangeText={(value) => handleFieldChange('postalCode', value)}
                keyboardType="default"
                maxLength={10}
              />
            </View>
          </View>

          {/* State/Province */}
          <Input
            label="State/Province"
            value={tempAddress.stateProvince || ''}
            onChangeText={(value) => handleFieldChange('stateProvince', value)}
            maxLength={50}
            containerStyle={styles.inputContainer}
          />

          {/* Country */}
          <Input
            label="Country"
            value={tempAddress.country || ''}
            onChangeText={(value) => handleFieldChange('country', value)}
            maxLength={50}
            containerStyle={styles.inputContainer}
          />

        </ScrollView>

        {/* Buttons - Always Visible */}
        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Cancel"
            onPress={handleCancel}
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
            tintColor="#FFFFFF"
            shadowIntensity="light"
            forceBorder
            borderColor="rgba(0, 0, 0, 0.12)"
            height={56}
            borderRadius={16}
          />

          <LiquidGlassButton
            title="Save"
            onPress={handleSave}
            style={StyleSheet.flatten([
              styles.saveButton,
              Platform.OS === 'android' ? styles.saveButtonAndroid : null,
            ])}
            textStyle={styles.saveButtonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
            height={56}
            borderRadius={16}
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

AddressBottomSheet.displayName = 'AddressBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'], // 20
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'], // 16
      position: 'relative',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'], // 8
    },
    closeIcon: {
      width: theme.spacing['6'], // 24
      height: theme.spacing['6'], // 24
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing['4'], // 16
    },
    inputContainer: {
      marginBlock: theme.spacing['2'], // 20
    },
    addressAutocompleteContainer: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      marginTop: theme.spacing['2'],
      overflow: 'hidden',
    },
    addressAutocompleteLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    addressAutocompleteLoadingText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    addressSuggestionItem: {
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['4'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    addressSuggestionItemLast: {
      borderBottomWidth: 0,
    },
    addressSuggestionPrimary: {
      ...theme.typography.paragraph,
      color: theme.colors.text,
    },
    addressSuggestionSecondary: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
    },
    addressSuggestionError: {
      ...theme.typography.caption,
      color: theme.colors.error,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      backgroundColor: theme.colors.cardBackground,
    },
    addressPoweredBy: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['3'],
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing['3'], // 12
      marginBottom: theme.spacing['5'], // 20
    },
    halfInput: {
      flex: 1,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'], // 12
      paddingVertical: theme.spacing['4'], // 16
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.white,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    cancelButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.colors.secondary,
    },
    saveButtonAndroid: {
      backgroundColor: theme.colors.secondary,
    },
    saveButtonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
    // Bottom Sheet Styles
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.black,
      width: 80,
      height: 6,
      opacity: 0.2,
    },
  });
