import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

/**
 * Tracks the OS "reduce motion" accessibility setting so animated placeholders
 * (skeleton shimmer, typing dots) can fall back to a static state. Returns the
 * current value and keeps it in sync while the component is mounted.
 */
export const useReducedMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) {
        setReduceMotion(value);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
};
