import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {Alert, Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import ConfirmActionBottomSheet, {
  ConfirmActionBottomSheetRef,
} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import type {AppUpdatePrompt} from '@/features/appUpdate/services/appUpdatePolicy';

export type AppUpdateBottomSheetRef = {
  open: () => void;
  close: () => void;
};

type AppUpdateBottomSheetProps = {
  prompt: AppUpdatePrompt;
  onDeferred?: () => void;
};

const AppUpdateBottomSheet = forwardRef<
  AppUpdateBottomSheetRef,
  AppUpdateBottomSheetProps
>(({prompt, onDeferred}, ref) => {
  const {t} = useTranslation();
  const bottomSheetRef = useRef<ConfirmActionBottomSheetRef>(null);
  const deferredHandledRef = useRef(false);
  const hasOpenedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const title =
    prompt.title ||
    (prompt.kind === 'required'
      ? t('appUpdate.requiredTitle')
      : t('appUpdate.optionalTitle'));

  const message =
    prompt.message ||
    (prompt.kind === 'required'
      ? t('appUpdate.requiredMessage')
      : t('appUpdate.optionalMessage'));

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

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title={title}
      message={message}
      snapPoints={['40%']}
      initialIndex={-1}
      enablePanDown={prompt.kind !== 'required'}
      enableHandlePanning={prompt.kind !== 'required'}
      showCloseButton={prompt.kind !== 'required'}
      backdropPressBehavior={prompt.kind === 'required' ? 'none' : 'close'}
      onSheetChange={index => {
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
      }}
      primaryButton={{
        label: t('appUpdate.updateNowButton'),
        onPress: handleOpenStore,
        forceBorder: true,
      }}
      secondaryButton={
        prompt.kind === 'optional'
          ? {
              label: t('appUpdate.laterButton'),
              onPress: () => {
                deferredHandledRef.current = true;
                onDeferred?.();
                bottomSheetRef.current?.close();
              },
            }
          : undefined
      }
    />
  );
});

AppUpdateBottomSheet.displayName = 'AppUpdateBottomSheet';

export default AppUpdateBottomSheet;
