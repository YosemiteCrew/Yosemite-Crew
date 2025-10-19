import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomBottomSheet from '@/components/common/BottomSheet/BottomSheet';
import type {BottomSheetRef} from '@/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme, useAddressAutocomplete} from '@/hooks';
import type {PlaceSuggestion} from '@/services/maps/googlePlaces';
import {AddressFields, type AddressFieldValues} from '@/components/forms/AddressFields';
import {Images} from '@/assets/images';

export interface AddressBottomSheetRef {
  open: () => void;
  close: () => void;
}

type Address = AddressFieldValues;

export interface AddressBottomSheetProps {
  selectedAddress: Address;
  onSave: (address: Address) => void;
}

export const AddressBottomSheet = forwardRef<
  AddressBottomSheetRef,
  AddressBottomSheetProps
>(({selectedAddress, onSave}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempAddress, setTempAddress] = useState<Address>(selectedAddress);
  const {
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isFetching: isFetchingAddressSuggestions,
    error: addressLookupError,
    clearSuggestions,
    selectSuggestion,
    resetError,
  } = useAddressAutocomplete();

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempAddress(selectedAddress);
      setAddressQuery(selectedAddress.addressLine ?? '', {suppressLookup: true});
      clearSuggestions();
      resetError();
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      clearSuggestions();
      resetError();
      bottomSheetRef.current?.close();
    },
  }));

  const handleAddressSuggestionPress = async (suggestion: PlaceSuggestion) => {
    const details = await selectSuggestion(suggestion);
    if (!details) {
      return;
    }

    const addressLine = details.addressLine ?? suggestion.primaryText;
    setTempAddress(prev => ({
      ...prev,
      addressLine,
      city: details.city ?? prev.city,
      stateProvince: details.stateProvince ?? prev.stateProvince,
      postalCode: details.postalCode ?? prev.postalCode,
      country: details.country ?? prev.country,
    }));
  };

  const handleSave = () => {
    onSave(tempAddress);
    clearSuggestions();
    resetError();
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempAddress(selectedAddress);
    setAddressQuery(selectedAddress.addressLine ?? '', {suppressLookup: true});
    clearSuggestions();
    resetError();
    bottomSheetRef.current?.close();
  };

  const handleFieldChange = (field: keyof AddressFieldValues, value: string) => {
    setTempAddress(prev => ({...prev, [field]: value}));
    if (field === 'addressLine') {
      setAddressQuery(value);
    }
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['60%', '80%']}
      initialIndex={-1}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableOverDrag
      enableBackdrop
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      contentType="view"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Address</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image source={Images.crossIcon} style={styles.closeIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <AddressFields
            values={tempAddress}
            onChange={handleFieldChange}
            addressSuggestions={addressSuggestions}
            isFetchingSuggestions={isFetchingAddressSuggestions}
            error={addressLookupError}
            onSelectSuggestion={handleAddressSuggestionPress}
          />
        </ScrollView>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Cancel"
            onPress={handleCancel}
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
            tintColor={theme.colors.surface}
            shadowIntensity="light"
            forceBorder
            borderColor="rgba(0, 0, 0, 0.12)"
            height={56}
            borderRadius={16}
          />

          <LiquidGlassButton
            title="Save"
            onPress={handleSave}
            style={styles.saveButton}
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
      paddingHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
      position: 'relative',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'],
    },
    closeIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing['4'],
      gap: theme.spacing['4'],
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['4'],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    cancelButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    saveButton: {
      flex: 1,
    },
    saveButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius['3xl'],
      borderTopRightRadius: theme.borderRadius['3xl'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.borderMuted,
    },
  });

export default AddressBottomSheet;
