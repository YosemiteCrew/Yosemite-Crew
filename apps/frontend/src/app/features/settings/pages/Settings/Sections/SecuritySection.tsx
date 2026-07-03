import React, { useEffect, useState } from 'react';
import TOTP from 'supertokens-web-js/recipe/totp';

import { Button } from '@/app/ui';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { useNotify } from '@/app/hooks/useNotify';
import { getData, postData } from '@/app/services/axios';

type MfaStatus = {
  requiredFactors: string[];
  setupFactors: string[];
  totp: {
    required: boolean;
    setup: boolean;
  };
};

type MfaStatusResponse = {
  status: string;
  mfa: MfaStatus;
};

type TotpEnrollment = {
  deviceName: string;
  secret: string;
  qrCodeString: string;
};

const SecuritySection = () => {
  const { notify } = useNotify();
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getData<MfaStatusResponse>('/v1/auth/mfa/status')
      .then((response) => {
        if (!cancelled) {
          setMfaStatus(response.data.mfa);
        }
      })
      .catch(() => {
        // Status stays unknown; the section still renders with setup disabled.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = async () => {
    const response = await getData<MfaStatusResponse>('/v1/auth/mfa/status', {}, { dedupe: false });
    setMfaStatus(response.data.mfa);
  };

  const handleEnableTotp = async () => {
    setIsBusy(true);
    try {
      await postData('/v1/auth/mfa/totp/enable');
      const device = await TOTP.createDevice({ deviceName: 'Authenticator app' });
      if (device.status === 'DEVICE_ALREADY_EXISTS_ERROR') {
        await refreshStatus();
        notify('error', {
          title: 'Authenticator already exists',
          text: 'An authenticator device is already registered for this account.',
        });
        return;
      }
      setEnrollment({
        deviceName: device.deviceName,
        secret: device.secret,
        qrCodeString: device.qrCodeString,
      });
    } catch {
      notify('error', {
        title: 'Unable to start setup',
        text: 'Could not start authenticator setup. Please try again.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyDevice = async () => {
    const code = verificationCode.trim();
    if (!code) {
      setCodeError('Enter the 6-digit code');
      return;
    }
    if (!enrollment) return;
    setIsBusy(true);
    try {
      const result = await TOTP.verifyDevice({ deviceName: enrollment.deviceName, totp: code });
      if (result.status === 'OK') {
        setEnrollment(null);
        setVerificationCode('');
        await refreshStatus().catch(() => undefined);
        notify('success', {
          title: 'Authenticator enabled',
          text: 'Two-factor authentication with an authenticator app is now active.',
        });
        return;
      }
      if (result.status === 'INVALID_TOTP_ERROR') {
        setCodeError('Invalid code. Please try again.');
        return;
      }
      if (result.status === 'LIMIT_REACHED_ERROR') {
        setCodeError('Too many attempts. Please try again later.');
        return;
      }
      setCodeError('Verification failed. Please restart the setup.');
    } catch {
      notify('error', {
        title: 'Verification failed',
        text: 'Could not verify the authenticator code. Please try again.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisableTotp = async () => {
    setIsBusy(true);
    try {
      await postData('/v1/auth/mfa/totp/disable');
      setEnrollment(null);
      await refreshStatus().catch(() => undefined);
      notify('success', {
        title: 'Authenticator disabled',
        text: 'Sign-in now falls back to email verification codes.',
      });
    } catch {
      notify('error', {
        title: 'Unable to disable',
        text: 'Could not disable the authenticator. Please try again.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const totpActive = Boolean(mfaStatus?.totp.required && mfaStatus?.totp.setup);

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Security</div>
      </div>
      <div className="flex flex-col gap-3 px-6! py-6!">
        <div className="text-body-4 text-text-secondary">
          Two-factor authentication is required when signing in. Use an authenticator app for codes
          instead of email.
        </div>
        <div className="text-body-4 text-text-primary" data-testid="totp-status">
          {'Authenticator app: '}
          <span className={totpActive ? 'text-text-brand' : 'text-text-secondary'}>
            {totpActive ? 'Enabled' : 'Not enabled'}
          </span>
        </div>

        {enrollment ? (
          <div className="flex flex-col gap-3">
            <div className="text-body-4 text-text-primary">
              Add this secret to your authenticator app, then enter the generated 6-digit code to
              finish setup.
            </div>
            <div
              className="px-6 py-2.75 border border-input-border-default rounded-2xl text-body-4 text-text-primary break-all"
              data-testid="totp-secret"
            >
              {enrollment.secret}
            </div>
            <FormInput
              intype="text"
              inname="totp-code"
              value={verificationCode}
              inlabel="6-digit code"
              onChange={(e) => {
                setVerificationCode(e.target.value);
                setCodeError(undefined);
              }}
              error={codeError}
            />
            <div className="w-full flex justify-end! gap-2">
              <Button
                variant="secondary"
                text="Cancel"
                onClick={() => {
                  setEnrollment(null);
                  setVerificationCode('');
                  setCodeError(undefined);
                }}
              />
              <Button
                variant="primary"
                text={isBusy ? 'Verifying...' : 'Verify code'}
                onClick={handleVerifyDevice}
                isDisabled={isBusy}
              />
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-end!">
            {totpActive ? (
              <Button
                variant="danger"
                text={isBusy ? 'Working...' : 'Disable authenticator'}
                onClick={handleDisableTotp}
                isDisabled={isBusy}
              />
            ) : (
              <Button
                variant="primary"
                text={isBusy ? 'Working...' : 'Set up authenticator app'}
                onClick={handleEnableTotp}
                isDisabled={isBusy || mfaStatus === null}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecuritySection;
