import React, {useImperativeHandle, useMemo, useRef} from 'react';
import {Alert, Image, Linking, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {PrimaryActionButton} from '@/shared/components/common/PrimaryActionButton/PrimaryActionButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {Theme} from '@/theme';
import type {AppUpdatePrompt} from '@/features/appUpdate/services/appUpdatePolicy';

export type AppUpdateBottomSheetRef = {
  open: () => void;
  close: () => void;
};

type AppUpdateBottomSheetProps = {
  prompt: AppUpdatePrompt;
  onDeferred?: () => void;
  initialOpen?: boolean;
};

// Category icons for the changelog rows (warm-bone design). The list text comes
// from real update-policy data; the icons cycle to give each line a category
// glyph, tinted `blueText`.
const CHANGELOG_ICONS = [
  'sparkles-outline',
  'flash-outline',
  'bug-outline',
] as const;

const AppUpdateBottomSheet = ({
  prompt,
  onDeferred,
  initialOpen = false,
  ref,
}: AppUpdateBottomSheetProps & {ref?: React.Ref<AppUpdateBottomSheetRef>}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const deferredHandledRef = useRef(false);
  const hasOpenedRef = useRef(false);
  const isRequired = prompt.kind === 'required';

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.snapToIndex(0),
    close: () => bottomSheetRef.current?.close(),
  }));

  const title =
    prompt.title ||
    (isRequired ? t('appUpdate.requiredTitle') : t('appUpdate.optionalTitle'));

  const message =
    prompt.message ||
    (isRequired
      ? t('appUpdate.requiredMessage')
      : t('appUpdate.optionalMessage'));

  const changelog = message
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const versionLine = prompt.latestVersion
    ? `${prompt.currentVersion} → ${prompt.latestVersion}`
    : prompt.currentVersion;

  const handleOpenStore = async () => {
    if (!prompt.storeUrl) {
      Alert.alert(t('common.error'), t('appUpdate.missingStoreUrl'));
      return;
    }

    try {
      await Linking.openURL(prompt.storeUrl);
    } catch (error) {
      console.warn('[AppUpdate] Failed to open store URL', error);
      Alert.alert(t('common.error'), t('appUpdate.openStoreFailed'));
    }
  };

  const handleDefer = () => {
    deferredHandledRef.current = true;
    onDeferred?.();
    bottomSheetRef.current?.close();
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['90%']}
      initialIndex={initialOpen ? 0 : -1}
      zIndex={100}
      behavior={{
        panDownToClose: !isRequired,
        dynamicSizing: true,
        backdrop: true,
        handlePanningGesture: !isRequired,
        contentPanningGesture: false,
      }}
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior={isRequired ? 'none' : 'close'}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      contentType="view"
      onChange={index => {
        if (index >= 0) {
          hasOpenedRef.current = true;
        }

        if (
          index === -1 &&
          hasOpenedRef.current &&
          prompt.kind === 'optional' &&
          !deferredHandledRef.current
        ) {
          onDeferred?.();
        }
        if (index === -1) {
          deferredHandledRef.current = false;
          hasOpenedRef.current = false;
        }
      }}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Image
            source={Images.yosemiteLogo}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.versionLine}>{versionLine}</Text>
          </View>
        </View>

        {changelog.length > 0 ? (
          <View style={styles.changelog}>
            {changelog.map((line, index) => (
              <View key={`changelog-${index}`} style={styles.changelogRow}>
                <Icon
                  name={CHANGELOG_ICONS[index % CHANGELOG_ICONS.length]}
                  size={15}
                  color={theme.colors.blueText}
                  style={styles.changelogIcon}
                />
                <Text style={styles.changelogText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <PrimaryActionButton
          title={t('appUpdate.updateNowButton')}
          onPress={() => {
            handleOpenStore();
          }}
          disabled={isRequired && !prompt.storeUrl}
        />

        {isRequired ? null : (
          <PressableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('appUpdate.laterButton')}
            onPress={handleDefer}
            style={styles.dismissLink}>
            <Text style={styles.dismissText}>{t('appUpdate.laterButton')}</Text>
          </PressableOpacity>
        )}
      </View>
    </CustomBottomSheet>
  );
};

AppUpdateBottomSheet.displayName = 'AppUpdateBottomSheet';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.sheet,
      borderTopRightRadius: theme.borderRadius.sheet,
    },
    sheetHandle: {
      width: 40,
      height: 4.5,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.divider,
    },
    container: {
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['2.5'],
      paddingBottom: theme.spacing['10'],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3.5'],
    },
    logo: {
      width: 46,
      height: 46,
      borderRadius: theme.borderRadius.field,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...theme.typography.paragraph18Bold,
      color: theme.colors.ink,
    },
    versionLine: {
      ...theme.typography.body12,
      fontSize: 12.5,
      color: theme.colors.inkFaint,
      fontVariant: ['tabular-nums'],
    },
    changelog: {
      gap: theme.spacing['2'],
    },
    changelogRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2.5'],
    },
    changelogIcon: {
      marginTop: 2,
    },
    changelogText: {
      ...theme.typography.mobileFootnote,
      flex: 1,
      color: theme.colors.inkMuted,
    },
    dismissLink: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismissText: {
      ...theme.typography.labelSmall,
      fontSize: 14.5,
      color: theme.colors.inkMuted,
    },
  });

export default AppUpdateBottomSheet;
