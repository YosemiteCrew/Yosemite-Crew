// src/shared/components/common/ListLoadingState/ListLoadingState.tsx
//
// The third of the four list phases to get a UI. `resolveListPhase` has
// returned 'loading' since it was written, but no screen rendered it, so the
// list area went blank during the first fetch and again for the whole duration
// of a retry. A slow retry looked like a retry that had done nothing.
//
// Deliberately NOT the full-screen `Loading` component: this sits inline in a
// scrolling screen that already has a header and a companion selector above it,
// so it must not paint its own background or claim flex: 1.

import React from 'react';
import {View, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {useTranslation} from 'react-i18next';

import {GifLoader} from '@/shared/components/common/GifLoader/GifLoader';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export interface ListLoadingStateProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ListLoadingState: React.FC<ListLoadingStateProps> = ({
  style,
  testID = 'list-loading-state',
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[styles.container, style]}>
      <GifLoader size="medium" />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['8'],
    },
  });
