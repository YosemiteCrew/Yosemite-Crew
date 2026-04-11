import React from 'react';
import type {ViewStyle} from 'react-native';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {BottomFadeOverlay} from '@/shared/components/common/BottomFadeOverlay/BottomFadeOverlay';
import {useLiquidGlassHeaderLayout} from '@/shared/hooks/useLiquidGlassHeaderLayout';

type LiquidGlassHeaderShellProps = {
  header: React.ReactNode;
  children: (contentPaddingStyle: ViewStyle | null) => React.ReactNode;
  contentPadding?: number;
  cardGap?: number;
  showBottomFade?: boolean;
  bottomFadeHeight?: number;
  bottomFadeIntensity?: 'light' | 'medium' | 'strong';
  bottomFadeOffset?: number;
};

export const LiquidGlassHeaderShell: React.FC<LiquidGlassHeaderShellProps> = ({
  header,
  children,
  contentPadding,
  cardGap,
  showBottomFade = false,
  bottomFadeHeight = 80,
  bottomFadeIntensity = 'medium',
  bottomFadeOffset = 0,
}) => {
  const {headerProps, contentPaddingStyle} = useLiquidGlassHeaderLayout({
    contentPadding,
    cardGap,
  });

  return (
    <>
      <LiquidGlassHeader {...headerProps}>{header}</LiquidGlassHeader>
      {children(contentPaddingStyle)}
      {showBottomFade && (
        <BottomFadeOverlay
          height={bottomFadeHeight}
          intensity={bottomFadeIntensity}
          bottomOffset={bottomFadeOffset}
        />
      )}
    </>
  );
};
