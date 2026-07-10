import React, {useImperativeHandle, useMemo, useRef, useState} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Keyboard,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import CustomBottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';
import type {BottomSheetRef} from '@/shared/components/common/BottomSheet/BottomSheet';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {BottomSheetActions} from '@/shared/components/common/BottomSheetActions/BottomSheetActions';
import {useTheme, useAddressAutocomplete, useKeyboardVisible} from '@/hooks';
import type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';
import {
  AddressFields,
  type AddressFieldValues,
} from '@/shared/components/forms/AddressFields';
import {Images} from '@/assets/images';
import {
  createBottomSheetImperativeHandle,
  createBottomSheetStyles,
  createBottomSheetContainerStyles,
} from '@/shared/utils/bottomSheetHelpers';

export interface AddressBottomSheetRef {
  open: () => void;
  close: () => void;
}

type Address = AddressFieldValues;

export interface AddressBottomSheetProps {
  selectedAddress: Address;
  onSave: (address: Address) => void;
}

export const AddressBottomSheet = ({
  selectedAddress,
  onSave,
  ref,
}: AddressBottomSheetProps & {ref?: React.Ref<AddressBottomSheetRef>}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const closeButtonSize = theme.spacing['9'];
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const isKeyboardVisible = useKeyboardVisible();

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

  // Helper to reset state and close bottom sheet
  const closeSheet = () => {
    Keyboard.dismiss();
    clearSuggestions();
    resetError();
    bottomSheetRef.current?.close();
  };

  useImperativeHandle(
    ref,
    () =>
      createBottomSheetImperativeHandle(bottomSheetRef, () => {
        setTempAddress(selectedAddress);
        setAddressQuery(selectedAddress.addressLine ?? '', {
          suppressLookup: true,
        });
        clearSuggestions();
        resetError();
      }),
    [selectedAddress, setAddressQuery, clearSuggestions, resetError],
  );

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
    Keyboard.dismiss();
    onSave(tempAddress);
    closeSheet();
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    setTempAddress(selectedAddress);
    setAddressQuery(selectedAddress.addressLine ?? '', {suppressLookup: true});
    closeSheet();
  };

  const handleFieldChange = (
    field: keyof AddressFieldValues,
    value: string,
  ) => {
    setTempAddress(prev => ({...prev, [field]: value}));
    if (field === 'addressLine') {
      setAddressQuery(value);
    }
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={isKeyboardVisible ? ['93%', '96%'] : ['60%', '80%']}
      initialIndex={-1}
      onChange={index => {
        setIsSheetVisible(index !== -1);
        if (index === -1) {
          Keyboard.dismiss();
        }
      }}
      onAnimate={() => {
        Keyboard.dismiss();
      }}
      behavior={{
        panDownToClose: true,
        dynamicSizing: false,
        contentPanningGesture: false,
        handlePanningGesture: true,
        overDrag: true,
        backdrop: isSheetVisible,
      }}
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      onBackdropPress={Keyboard.dismiss}
      contentType="view"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize">
      <PressableOpacity
        activeOpacity={1}
        onPress={Keyboard.dismiss}
        accessible={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Address</Text>
            <LiquidGlassIconButton
              onPress={handleCancel}
              size={closeButtonSize}
              style={styles.closeButton}>
              <Image
                source={Images.crossIcon}
                style={styles.closeIcon}
                resizeMode="contain"
              />
            </LiquidGlassIconButton>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}>
            <AddressFields
              values={tempAddress}
              onChange={handleFieldChange}
              addressSuggestions={addressSuggestions}
              isFetchingSuggestions={isFetchingAddressSuggestions}
              error={addressLookupError}
              onSelectSuggestion={handleAddressSuggestionPress}
            />
          </ScrollView>

          <BottomSheetActions
            onCancel={handleCancel}
            onSave={handleSave}
            theme={theme}
            cancelTintColor={theme.colors.surface}
          />
        </View>
      </PressableOpacity>
    </CustomBottomSheet>
  );
};

AddressBottomSheet.displayName = 'AddressBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createBottomSheetContainerStyles(theme),
    ...createBottomSheetStyles(theme),
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'],
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default AddressBottomSheet;
