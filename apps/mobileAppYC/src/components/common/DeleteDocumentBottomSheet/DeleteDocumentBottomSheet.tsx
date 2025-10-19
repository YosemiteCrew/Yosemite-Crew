import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Text, View, StyleSheet} from 'react-native';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';

export interface DeleteDocumentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DeleteDocumentBottomSheetProps {
  documentTitle?: string;
  onCancel?: () => void;
  onDelete: () => Promise<void> | void;
}

export const DeleteDocumentBottomSheet = forwardRef<
  DeleteDocumentBottomSheetRef,
  DeleteDocumentBottomSheetProps
>(({documentTitle = 'this document', onCancel, onDelete}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleCancel = () => {
    handleClose();
    onCancel?.();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      handleClose();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
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
        <Text style={styles.title}>Delete file</Text>

        <Text style={styles.subtitle}>
          Are you sure you want to delete the file {documentTitle}?
        </Text>

        <View style={styles.actionsRow}>
          <LiquidGlassButton
            title="Cancel"
            onPress={handleCancel}
            glassEffect="clear"
            tintColor={theme.colors.surface}
            borderRadius="lg"
            textStyle={styles.buttonText}
            style={styles.cancelButton}
            disabled={isDeleting}
          />
          <LiquidGlassButton
            title={isDeleting ? 'Deleting...' : 'Delete'}
            onPress={handleDelete}
            glassEffect="clear"
            tintColor={theme.colors.secondary}
            borderRadius="lg"
            textStyle={styles.deleteText}
            style={styles.deleteButton}
            disabled={isDeleting}
            loading={isDeleting}
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

DeleteDocumentBottomSheet.displayName = 'DeleteDocumentBottomSheet';

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
      gap: theme.spacing['5'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['6'],
    },
    title: {
      ...theme.typography.h5Clash23,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.paragraph18Bold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['2'],
    },
    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    deleteButton: {
      flex: 1,
    },
    buttonText: {
      ...theme.typography.buttonH6Clash19,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    deleteText: {
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
      color: theme.colors.white,
    },
  });

export default DeleteDocumentBottomSheet;
