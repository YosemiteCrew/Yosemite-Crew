// InkAnnotation — the hand-drawn "encircle" (and swoosh-underline) that draws on
// around an accent word, the signature Yosemite-Crew brand motion. Ported from
// the design system's site-motion.js `initInkAnnotation`: a wobbling, slightly
// over-wound ellipse (or one confident underline swoosh) rendered as an SVG path
// that animates its stroke on with a pen-on-paper easing in the word's own
// accent colour.
import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  TextStyle,
  StyleProp,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Pen-on-paper: hesitates as the nib lands, accelerates through the stroke,
// settles at the lift. Matches site-motion.js cubic-bezier(0.6,0.04,0.28,1).
const PEN_EASING = Easing.bezier(0.6, 0.04, 0.28, 1);

type AnnotationType = 'circle' | 'underline';

interface InkAnnotationProps {
  children: string;
  /** Stroke + text colour. Defaults to the accent (pink) passed by the caller. */
  color: string;
  type?: AnnotationType;
  /** Delay before the stroke starts drawing, in ms (lets the word settle first). */
  delay?: number;
  textStyle?: StyleProp<TextStyle>;
  /** Draw the accent word in italic (matches the design's serif accent). */
  italic?: boolean;
  /**
   * When controlled, the stroke draws once this becomes true and replays each
   * time it flips false -> true (e.g. a carousel slide re-entering view).
   * Defaults to true (draws as soon as it is measured).
   */
  active?: boolean;
}

interface Geometry {
  d: string;
  width: number;
  height: number;
  padX: number;
  padY: number;
  length: number;
}

const smooth = (pts: number[][]): string => {
  if (pts.length < 2) {
    return '';
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d +=
      ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ` +
      `${c2x.toFixed(1)} ${c2y.toFixed(1)}, ` +
      `${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

const polylineLength = (pts: number[][]): number => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
};

const buildCircle = (w: number, h: number): Geometry => {
  const padX = Math.max(14, w * 0.09);
  const padY = Math.max(11, h * 0.26);
  const cx = padX + w / 2;
  const cy = padY + h / 2;
  const rx = w / 2 + Math.max(9, w * 0.06);
  const ry = h / 2 + Math.max(6, h * 0.14);
  const start = -Math.PI * 0.6; // begin upper-right
  const end = start + Math.PI * 2 * 1.09; // overshoot ~1.09 turns so it crosses over
  const N = 46;
  const pts: number[][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = start + (end - start) * t;
    const drift = 1 + Math.sin(a * 3 + 1.2) * 0.014; // subtle radius wobble = hand-drawn
    pts.push([
      cx + Math.cos(a) * rx * drift + Math.sin(t * 7) * 0.7,
      cy + Math.sin(a) * ry * drift,
    ]);
  }
  return {
    d: smooth(pts),
    width: w + padX * 2,
    height: h + padY * 2,
    padX,
    padY,
    length: polylineLength(pts) * 1.05,
  };
};

const buildUnderline = (w: number, h: number): Geometry => {
  const padX = Math.max(14, w * 0.09);
  const padY = Math.max(11, h * 0.26);
  const y = padY + h * 0.99;
  const x0 = padX - w * 0.02;
  const x1 = padX + w * 1.02;
  const s = x1 - x0;
  // one confident swoosh: dips slightly under the middle, lifts a touch at the end
  const d =
    `M ${x0.toFixed(1)} ${(y - 1).toFixed(1)}` +
    ` C ${(x0 + s * 0.26).toFixed(1)} ${(y + 4.5).toFixed(1)}, ` +
    `${(x0 + s * 0.5).toFixed(1)} ${(y + 5).toFixed(1)}, ` +
    `${(x0 + s * 0.68).toFixed(1)} ${(y + 1.5).toFixed(1)}` +
    ` S ${(x1 - s * 0.05).toFixed(1)} ${(y - 4.5).toFixed(1)}, ` +
    `${x1.toFixed(1)} ${(y - 3).toFixed(1)}`;
  return {
    d,
    width: w + padX * 2,
    height: h + padY * 2,
    padX,
    padY,
    length: s * 1.12,
  };
};

export const InkAnnotation: React.FC<InkAnnotationProps> = ({
  children,
  color,
  type = 'circle',
  delay = 0,
  textStyle,
  italic = false,
  active = true,
}) => {
  const [size, setSize] = useState<{w: number; h: number} | null>(null);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0); // 0 = undrawn, 1 = fully drawn

  const geometry = useMemo<Geometry | null>(() => {
    if (!size || size.w < 2 || size.h < 2) {
      return null;
    }
    return type === 'circle'
      ? buildCircle(size.w, size.h)
      : buildUnderline(size.w, size.h);
  }, [size, type]);

  const startDraw = useCallback(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    const duration = type === 'circle' ? 1550 : 1150;
    progress.value = withDelay(
      delay,
      withTiming(1, {duration, easing: PEN_EASING}),
    );
  }, [delay, progress, reducedMotion, type]);

  // Kick the draw once the word has been measured (geometry available), and
  // replay whenever it re-enters the active state (e.g. a carousel slide).
  React.useEffect(() => {
    if (!geometry) {
      return;
    }
    if (active) {
      startDraw();
    } else {
      progress.value = 0;
    }
  }, [geometry, active, startDraw, progress]);

  const animatedProps = useAnimatedProps(() => {
    const len = geometry?.length ?? 0;
    return {strokeDashoffset: len * (1 - progress.value)};
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setSize(prev =>
      prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : {w: width, h: height},
    );
  }, []);

  return (
    <View style={styles.wrap}>
      <Text
        onLayout={onLayout}
        style={[textStyle, {color}, italic && styles.italic]}
        allowFontScaling={false}>
        {children}
      </Text>
      {geometry ? (
        <Svg
          pointerEvents="none"
          width={geometry.width}
          height={geometry.height}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          style={[styles.svg, {left: -geometry.padX, top: -geometry.padY}]}>
          <AnimatedPath
            d={geometry.d}
            stroke={color}
            strokeWidth={type === 'circle' ? 2.4 : 3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.9}
            strokeDasharray={geometry.length}
            animatedProps={animatedProps}
          />
        </Svg>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  svg: {
    position: 'absolute',
  },
  italic: {
    fontStyle: 'italic',
  },
});
