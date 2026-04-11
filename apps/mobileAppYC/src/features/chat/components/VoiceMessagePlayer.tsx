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

import React, {useState, useEffect} from 'react';
import {View, TouchableOpacity, StyleSheet, Text, ActivityIndicator} from 'react-native';
import Sound from 'react-native-nitro-sound';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '@/hooks';

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

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isPlaying) {
        Sound.stopPlayer();
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
      }
    };
  }, [isPlaying]);

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          Sound.addPlayBackListener((e) => {
            setCurrentPosition(e.currentPosition);
            setDuration(e.duration);
          });

          Sound.addPlaybackEndListener(() => {
            setIsPlaying(false);
            setCurrentPosition(0);
            Sound.removePlayBackListener();
            Sound.removePlaybackEndListener();
            ReactNativeHapticFeedback.trigger('notificationSuccess');
          });

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
      setIsPlaying(false);
      setCurrentPosition(0);
    } catch (error) {
      console.error('Audio stop error:', error);
    }
  };

  const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePlayPause}
        style={styles.playButton}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.white} size="small" />
        ) : (
          <Icon name={isPlaying ? 'pause' : 'play-arrow'} size={24} color={theme.colors.white} />
        )}
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {width: `${progress}%`}]} />
        </View>
        <Text style={styles.timeText}>
          {formatTime(currentPosition)} / {formatTime(duration)}
        </Text>
      </View>

      {isPlaying && (
        <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
          <Icon name="stop" size={20} color={theme.colors.error} />
        </TouchableOpacity>
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
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing['3'],
    },
    playButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressContainer: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    progressBar: {
      height: theme.spacing['1'],
      backgroundColor: theme.colors.border,
      borderRadius: theme.borderRadius.xs,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    timeText: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
    stopButton: {
      width: theme.spacing['8'],
      height: theme.spacing['8'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.errorSurface,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default VoiceMessagePlayer;
