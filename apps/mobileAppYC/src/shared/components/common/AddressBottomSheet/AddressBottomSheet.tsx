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
  View,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import CustomBottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';
import type {BottomSheetRef} from '@/shared/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {useTheme, useAddressAutocomplete} from '@/hooks';
import type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';
import {AddressFields, type AddressFieldValues} from '@/shared/components/forms/AddressFields';
import {Images} from '@/assets/images';
import {
  createBottomSheetImperativeHandle,
  createBottomSheetStyles,
  createBottomSheetContainerStyles,
  createBottomSheetButtonStyles,
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

export const AddressBottomSheet = forwardRef<
  AddressBottomSheetRef,
  AddressBottomSheetProps
>(({selectedAddress, onSave}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const closeButtonSize = theme.spacing['9'];
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
        setAddressQuery(selectedAddress.addressLine ?? '', {suppressLookup: true});
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

  const handleFieldChange = (field: keyof AddressFieldValues, value: string) => {
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
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableOverDrag
      enableBackdrop={isSheetVisible}
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Address</Text>
          <LiquidGlassIconButton
            onPress={handleCancel}
            size={closeButtonSize}
            style={styles.closeButton}>
            <Image source={Images.crossIcon} style={styles.closeIcon} resizeMode="contain" />
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
      </TouchableWithoutFeedback>
    </CustomBottomSheet>
  );
});

AddressBottomSheet.displayName = 'AddressBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createBottomSheetContainerStyles(theme),
    ...createBottomSheetButtonStyles(theme),
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
