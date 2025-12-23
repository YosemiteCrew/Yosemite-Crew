import React from 'react';
import type {ViewStyle} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common';
import {LiquidGlassHeaderShell} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderShell';

type LiquidGlassHeaderScreenProps = {
  header: React.ReactNode;
  children: (contentPaddingStyle: ViewStyle | null) => React.ReactNode;
  contentPadding?: number;
  cardGap?: number;
  containerStyle?: ViewStyle;
  edges?: ReadonlyArray<Edge>;
  mode?: 'padding' | 'margin';
  useSafeAreaView?: boolean;
};

export const LiquidGlassHeaderScreen: React.FC<LiquidGlassHeaderScreenProps> = ({
  header,
  children,
  contentPadding,
  cardGap,
  containerStyle,
  edges,
  mode,
  useSafeAreaView = false,
}) => {
  const {theme} = useTheme();
  const content = (
    <LiquidGlassHeaderShell
      header={header}
      contentPadding={contentPadding}
      cardGap={cardGap}>
      {children}
    </LiquidGlassHeaderShell>
  );

  if (useSafeAreaView) {
    return (
      <SafeAreaView
        style={[{flex: 1, backgroundColor: theme.colors.background}, containerStyle]}
        edges={edges}>
        {content}
      </SafeAreaView>
    );
  }

  return (
    <SafeArea style={containerStyle} edges={edges} mode={mode}>
      {content}
    </SafeArea>
  );
};
