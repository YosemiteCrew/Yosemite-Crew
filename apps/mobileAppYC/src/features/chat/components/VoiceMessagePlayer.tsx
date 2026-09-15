/**
 * Voice Message Player Component
 *
 * Plays audio attachments using Nitro Sound
 * Features:
 * - Play/Pause control
 * - Progress bar
 * - Duration display
 * - Haptic feedback
 */

import React, {useState, useEffect, useRef} from 'react';
import {View, StyleSheet, Text, ActivityIndicator} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import Sound from 'react-native-nitro-sound';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '@/hooks';

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration: initialDuration,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);

  // Nitro Sound is one player shared by every bubble, so unmount tears it down
  // only when this bubble owns a session: started and not yet stopped or ended,
  // whether playing or paused. Gating on isPlaying leaked a paused bubble's
  // listeners; depending on isPlaying in the effect ran this cleanup on every
  // pause and hard-stopped playback, breaking resume.
  const hasSessionRef = useRef(false);

  useEffect(() => {
    return () => {
      // Cleanup on unmount only
      if (hasSessionRef.current) {
        Sound.stopPlayer();
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
      }
    };
  }, []);

  const handlePlayPause = async () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setIsLoading(true);

    try {
      if (isPlaying) {
        // Pause
        await Sound.pausePlayer();
        setIsPlaying(false);
      } else {
        // Play
        if (currentPosition === 0) {
          // Start from beginning
          Sound.addPlayBackListener(e => {
            setCurrentPosition(e.currentPosition);
            setDuration(e.duration);
          });

          Sound.addPlaybackEndListener(() => {
            setIsPlaying(false);
            setCurrentPosition(0);
            Sound.removePlayBackListener();
            Sound.removePlaybackEndListener();
            hasSessionRef.current = false;
            ReactNativeHapticFeedback.trigger('notificationSuccess');
          });

          hasSessionRef.current = true;
          await Sound.startPlayer(audioUrl);
        } else {
          // Resume
          await Sound.resumePlayer();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    try {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      Sound.removePlaybackEndListener();
      hasSessionRef.current = false;
      setIsPlaying(false);
      setCurrentPosition(0);
    } catch (error) {
      console.error('Audio stop error:', error);
    }
  };

  const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <PressableOpacity
        onPress={handlePlayPause}
        style={styles.playButton}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        accessibilityState={{disabled: isLoading}}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.ctaText} size="small" />
        ) : (
          <Icon
            name={isPlaying ? 'pause' : 'play-arrow'}
            size={24}
            color={theme.colors.ctaText}
          />
        )}
      </PressableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {width: `${progress}%`}]} />
        </View>
        <Text style={styles.timeText}>
          {formatTime(currentPosition)} / {formatTime(duration)}
        </Text>
      </View>

      {isPlaying && (
        <PressableOpacity
          onPress={handleStop}
          style={styles.stopButton}
          accessibilityRole="button"
          accessibilityLabel="Stop">
          <Icon name="stop" size={20} color={theme.colors.dangerText} />
        </PressableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing['3'],
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      gap: theme.spacing['3'],
    },
    playButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.cta,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressContainer: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    progressBar: {
      height: theme.spacing['1'],
      backgroundColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.xs,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.blue,
    },
    timeText: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkMuted,
    },
    stopButton: {
      width: theme.spacing['8'],
      height: theme.spacing['8'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.dangerSurface,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default VoiceMessagePlayer;
