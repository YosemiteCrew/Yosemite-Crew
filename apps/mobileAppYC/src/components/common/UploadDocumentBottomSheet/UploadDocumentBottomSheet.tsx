import React, {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import {Text, View, StyleSheet, TouchableOpacity, Image} from 'react-native';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/components/common/BottomSheet/BottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface UploadDocumentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface UploadDocumentBottomSheetProps {
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  onUploadDrive: () => void;
}

export const UploadDocumentBottomSheet = forwardRef<
  UploadDocumentBottomSheetRef,
  UploadDocumentBottomSheetProps
>(({onTakePhoto, onChooseGallery, onUploadDrive}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleClose = () => {
    bottomSheetRef.current?.close();
  };

  const handleOptionPress = (callback: () => void) => {
    callback();
    handleClose();
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['35%']}
      initialIndex={-1}
      style={styles.bottomSheet}
      enablePanDownToClose
      enableBackdrop
      enableHandlePanningGesture
      enableContentPanningGesture={false}
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      contentType="view">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Upload documents</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Image
              source={Images.crossIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.optionsList}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => handleOptionPress(onTakePhoto)}
            activeOpacity={0.7}>
            <Text style={styles.optionText}>Take Photo</Text>
            <Image source={Images.cameraWhite} style={styles.optionIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => handleOptionPress(onChooseGallery)}
            activeOpacity={0.7}>
            <Text style={styles.optionText}>Choose from Gallery</Text>
            <Image source={Images.galleryIcon} style={styles.optionIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionItem, styles.optionItemLast]}
            onPress={() => handleOptionPress(onUploadDrive)}
            activeOpacity={0.7}>
            <Text style={styles.optionText}>Upload from Drive</Text>
            <Image source={Images.driveIcon} style={styles.optionIcon} />
          </TouchableOpacity>
        </View>
      </View>
    </CustomBottomSheet>
  );
});

UploadDocumentBottomSheet.displayName = 'UploadDocumentBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    bottomSheet: {
      zIndex: 1000,
      elevation: 24,
    },
    bottomSheetBackground: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius['3xl'],
      borderTopRightRadius: theme.borderRadius['3xl'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.borderMuted,
    },
    container: {
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['4'],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing['6'],
      position: 'relative',
    },
    title: {
      ...theme.typography.h5Clash23,
      color: theme.colors.secondary,
      textAlign: 'center',
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
    optionsList: {
      gap: 0,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['4'],
      paddingHorizontal: theme.spacing['4'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderMuted,
    },
    optionItemLast: {
      borderBottomWidth: 0,
    },
    optionText: {
      ...theme.typography.paragraph,
      color: theme.colors.secondary,
    },
    optionIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      tintColor: theme.colors.secondary,
    },
  });

export default UploadDocumentBottomSheet;
