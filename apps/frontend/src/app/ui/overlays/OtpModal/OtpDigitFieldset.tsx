import React from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';

type OtpDigitFieldsetProps = {
  code: string[];
  otpHintId: string;
  otpStatusId: string;
  invalidOtp: boolean;
  setOtpRef: (el: HTMLInputElement | null, idx: number) => void;
  onCodeChange: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onCodeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => void;
};

const OtpDigitFieldset = ({
  code,
  otpHintId,
  otpStatusId,
  invalidOtp,
  setOtpRef,
  onCodeChange,
  onCodeKeyDown,
}: Readonly<OtpDigitFieldsetProps>) => (
  <div className="verifyInputDiv">
    <fieldset
      className="verifyInput"
      style={{ marginBottom: 24 }}
      aria-label="Email verification code"
      aria-describedby={`${otpHintId} ${invalidOtp ? otpStatusId : ''}`.trim()}
    >
      {code.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => setOtpRef(el, idx)}
          type="text"
          maxLength={1}
          value={digit}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${idx + 1} of 6`}
          onChange={(e) => onCodeChange(e, idx)}
          onKeyDown={(e) => onCodeKeyDown(e, idx)}
        />
      ))}
    </fieldset>
    <p id={otpHintId} className="text-caption-1 text-text-secondary">
      Enter the 6-digit code from your email.
    </p>
    {invalidOtp ? (
      <p id={otpStatusId} role="alert">
        <Icon icon="solar:danger-circle-bold" width="18" height="18" /> Invalid OTP
      </p>
    ) : (
      ''
    )}{' '}
  </div>
);

export default OtpDigitFieldset;
