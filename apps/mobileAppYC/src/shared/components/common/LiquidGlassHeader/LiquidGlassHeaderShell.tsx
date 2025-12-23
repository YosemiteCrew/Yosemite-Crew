import React from 'react';
import type {ViewStyle} from 'react-native';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {useLiquidGlassHeaderLayout} from '@/shared/hooks/useLiquidGlassHeaderLayout';

type LiquidGlassHeaderShellProps = {
  header: React.ReactNode;
  children: (contentPaddingStyle: ViewStyle | null) => React.ReactNode;
  contentPadding?: number;
  cardGap?: number;
};

export const LiquidGlassHeaderShell: React.FC<LiquidGlassHeaderShellProps> = ({
  header,
  children,
  contentPadding,
  cardGap,
}) => {
  const {headerProps, contentPaddingStyle} = useLiquidGlassHeaderLayout({
    contentPadding,
    cardGap,
  });

  return (
    <>
      <LiquidGlassHeader {...headerProps}>{header}</LiquidGlassHeader>
      {children(contentPaddingStyle)}
    </>
  );
};
