import React, {useState} from 'react';
import {View, Platform, Linking, Alert} from 'react-native';
import {useTranslation} from 'react-i18next';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {passportApi} from '@/features/passport/services/passportService';
import {ensurePassportAccessToken} from '@/features/passport/passportSlice';

type WalletTarget = 'apple' | 'google' | null;

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// Apple/Google are brand names, so the wallet is interpolated into the
// translated sentence rather than translated itself.
const showWalletError = (t: TranslateFn, wallet: 'Apple' | 'Google') => {
  Alert.alert(
    t('passport.walletErrorTitle'),
    t('passport.walletErrorMessage', {wallet}),
  );
};

export const PassportWalletButtons: React.FC<{
  companionId: string;
  styles: any;
  theme: any;
}> = ({companionId, styles, theme}) => {
  const {t} = useTranslation();
  const [walletBusy, setWalletBusy] = useState<WalletTarget>(null);

  // Both endpoints are authenticated, so the pass is fetched with the caller's
  // token rather than by handing a protected URL to the OS.
  const handleAddToAppleWallet = () => {
    setWalletBusy('apple');
    ensurePassportAccessToken()
      .then(token => passportApi.downloadApplePass(companionId, token))
      .then(fileUrl => Linking.openURL(fileUrl))
      .catch(() => showWalletError(t, 'Apple'))
      .finally(() => setWalletBusy(null));
  };

  const handleAddToGoogleWallet = () => {
    setWalletBusy('google');
    ensurePassportAccessToken()
      .then(token => passportApi.getGoogleWalletUrl(companionId, token))
      .then(url => Linking.openURL(url))
      .catch(() => showWalletError(t, 'Google'))
      .finally(() => setWalletBusy(null));
  };

  return (
    <View style={styles.walletRow}>
      {/* Moved to the bottom, as a footer action - same placement as
          the "Get Directions" button in BusinessDetailsScreen.tsx,
          whose styling these buttons already match. */}
      {Platform.OS === 'ios' ? (
        <LiquidGlassButton
          title={t('passport.addToAppleWallet')}
          onPress={handleAddToAppleWallet}
          loading={walletBusy === 'apple'}
          disabled={walletBusy !== null}
          height={theme.spacing['14']}
          borderRadius={theme.borderRadius.lg}
          tintColor={theme.colors.secondary}
          textStyle={styles.walletButtonText}
          glassEffect="clear"
          shadowIntensity="none"
          forceBorder
          borderColor={theme.colors.borderMuted}
          style={styles.walletButton}
        />
      ) : null}
      <LiquidGlassButton
        title={t('passport.addToGoogleWallet')}
        onPress={handleAddToGoogleWallet}
        loading={walletBusy === 'google'}
        disabled={walletBusy !== null}
        height={theme.spacing['14']}
        borderRadius={theme.borderRadius.lg}
        tintColor={theme.colors.secondary}
        textStyle={styles.walletButtonText}
        glassEffect="clear"
        shadowIntensity="none"
        forceBorder
        borderColor={theme.colors.borderMuted}
        style={styles.walletButton}
      />
    </View>
  );
};
