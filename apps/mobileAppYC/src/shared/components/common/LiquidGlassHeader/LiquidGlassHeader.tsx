import React from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

type LiquidGlassHeaderProps = {
  insetsTop: number;
  currentHeight: number;
  onHeightChange: (height: number) => void;
  topSectionStyle: StyleProp<ViewStyle>;
  shadowWrapperStyle?: StyleProp<ViewStyle>;
  cardStyle: StyleProp<ViewStyle>;
  fallbackStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export const LiquidGlassHeader: React.FC<LiquidGlassHeaderProps> = ({
  insetsTop,
  currentHeight,
  onHeightChange,
  topSectionStyle,
  shadowWrapperStyle,
  cardStyle,
  fallbackStyle,
  children,
}) => (
  <View
    style={topSectionStyle}
    onLayout={event => {
      const height = event.nativeEvent.layout.height;
      if (height !== currentHeight) {
        onHeightChange(height);
      }
    }}>
    <View style={shadowWrapperStyle}>
      <LiquidGlassCard
        glassEffect="clear"
        interactive={false}
        shadow="none"
        style={[cardStyle, {paddingTop: insetsTop}]}
        fallbackStyle={fallbackStyle}>
        {children}
      </LiquidGlassCard>
    </View>
  </View>
);
