import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {
  SearchDropdownOverlay,
  type SearchDropdownOverlayProps,
} from './SearchDropdownOverlay';

type SearchDropdownWithBackdropProps<T> = SearchDropdownOverlayProps<T> & {
  onDismiss: () => void;
};

export function SearchDropdownWithBackdrop<T = unknown>({
  onDismiss,
  ...overlayProps
}: Readonly<SearchDropdownWithBackdropProps<T>>) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dropdownStyle = useMemo(
    () => StyleSheet.flatten([styles.dropdown, overlayProps.containerStyle]),
    [overlayProps.containerStyle, styles.dropdown],
  );

  if (!overlayProps.visible) return null;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <SearchDropdownOverlay
        {...overlayProps}
        containerStyle={dropdownStyle}
      />
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 90,
    },
    dropdown: {
      left: theme.spacing['6'],
      right: theme.spacing['6'],
      zIndex: 100,
    },
  });

export default SearchDropdownWithBackdrop;
