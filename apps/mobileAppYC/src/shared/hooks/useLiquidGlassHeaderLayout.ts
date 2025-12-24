import {useMemo, useState} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

type LiquidGlassHeaderLayoutOptions = {
  cardGap?: number;
  contentPadding?: number;
};

export const useLiquidGlassHeaderLayout = (
  options: LiquidGlassHeaderLayoutOptions = {},
) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = useState(0);

  const headerStyles = useMemo(
    () => createLiquidGlassHeaderStyles(theme, {cardGap: options.cardGap}),
    [options.cardGap, theme],
  );

  const contentPaddingStyle = useMemo(() => {
    if (!topGlassHeight) return null;
    const padding = options.contentPadding ?? theme.spacing['3'];
    return {
      paddingTop: Math.max(0, topGlassHeight - insets.top) + padding,
    };
  }, [insets.top, options.contentPadding, theme, topGlassHeight]);

  return {
    headerProps: {
      insetsTop: insets.top,
      currentHeight: topGlassHeight,
      onHeightChange: setTopGlassHeight,
      topSectionStyle: headerStyles.topSection,
      shadowWrapperStyle: (headerStyles as any).topGlassShadowWrapper,
      cardStyle: headerStyles.topGlassCard,
      fallbackStyle: headerStyles.topGlassFallback,
    },
    contentPaddingStyle,
  };
};
