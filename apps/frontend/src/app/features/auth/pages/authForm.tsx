'use client';

import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import {
  IoAlertCircleOutline,
  IoArrowForwardOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoPhonePortraitOutline,
} from 'react-icons/io5';
import {
  PASSWORD_STRENGTH_MAX_SCORE,
  passwordStrengthLabel,
  scorePassword,
} from '@/app/features/auth/lib/passwordStrength';

/**
 * Shared building blocks for the sign in / sign up screens. Both pages render the
 * same warm-bone auth chrome, so the heading, fields, password toggle, submit
 * button, and footnote live here once instead of being copied into each page.
 */

const headingStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-newsreader)',
  fontSize: 'clamp(30px, 3.2vw, 39px)',
  fontWeight: 400,
  lineHeight: 1.06,
  letterSpacing: '-0.03em',
  color: 'var(--ink)',
};

const subtitleStyle: CSSProperties = {
  margin: '12px 0 26px',
  fontSize: 15.5,
  lineHeight: 1.55,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
};

const authFormStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
};

const fieldGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
};

const labelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const errorTextStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: 'var(--danger-text)',
  letterSpacing: '-0.01em',
};

const toggleButtonStyle: CSSProperties = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  color: 'var(--ink-faint)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const strengthMeterStyle: CSSProperties = {
  display: 'flex',
  gap: 5,
  marginTop: 2,
};

const strengthBarStyle: CSSProperties = {
  flex: 1,
  height: 4,
  borderRadius: 2,
  background: 'var(--hairline)',
};

const strengthLabelStyle: CSSProperties = {
  fontSize: 12.5,
  color: 'var(--ink-faint)',
  letterSpacing: '-0.01em',
};

const STRENGTH_BAR_COLOR: Record<string, string> = {
  'Too weak': 'var(--color-danger-500)',
  Weak: 'var(--color-warning-500)',
  Fair: 'var(--color-warning-300)',
  Strong: 'var(--color-success-600)',
};

const submitButtonStyle: CSSProperties = {
  marginTop: 4,
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 16,
  padding: '16px 24px',
  borderRadius: 13,
  boxShadow: '0 14px 30px var(--sh22)',
};

const altNoteStyle: CSSProperties = {
  marginTop: 22,
  paddingTop: 18,
  borderTop: '1px solid var(--hairline)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  justifyContent: 'center',
  textAlign: 'center',
  fontSize: 13.5,
  lineHeight: 1.5,
  color: 'var(--ink-faint)',
  letterSpacing: '-0.01em',
};

export const AuthHeading = ({ children }: Readonly<{ children: ReactNode }>) => (
  <h1 style={headingStyle}>{children}</h1>
);

export const AuthSubtitle = ({ children }: Readonly<{ children: ReactNode }>) => (
  <p style={subtitleStyle}>{children}</p>
);

export const AuthForm = ({
  onSubmit,
  method,
  children,
}: Readonly<{
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  method?: string;
  children: ReactNode;
}>) => (
  <form onSubmit={onSubmit} method={method} noValidate style={authFormStyle}>
    {children}
  </form>
);

export const FieldError = ({ id, message }: Readonly<{ id?: string; message?: string }>) =>
  message ? (
    <div id={id} role="alert" style={errorTextStyle}>
      <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
      {message}
    </div>
  ) : null;

const FieldLabel = ({
  htmlFor,
  label,
  accessory,
}: Readonly<{ htmlFor: string; label: string; accessory?: ReactNode }>) =>
  accessory ? (
    <div style={labelRowStyle}>
      <label className="yc-lbl" htmlFor={htmlFor}>
        {label}
      </label>
      {accessory}
    </div>
  ) : (
    <label className="yc-lbl" htmlFor={htmlFor}>
      {label}
    </label>
  );

interface AuthTextFieldProps {
  id: string;
  label: string;
  name: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  labelAccessory?: ReactNode;
}

export const AuthTextField = ({
  id,
  label,
  name,
  ariaLabel,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  error,
  labelAccessory,
}: Readonly<AuthTextFieldProps>) => {
  const errorId = `${id}-error`;
  return (
    <div style={fieldGroupStyle}>
      <FieldLabel htmlFor={id} label={label} accessory={labelAccessory} />
      <input
        id={id}
        name={name}
        className="yc-field"
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
};

const PasswordStrengthMeter = ({ password }: Readonly<{ password: string }>) => {
  const score = scorePassword(password);
  const label = passwordStrengthLabel(score);
  const filledBars = Math.max(1, Math.ceil((score / PASSWORD_STRENGTH_MAX_SCORE) * 4));
  return (
    <div aria-live="polite">
      <div style={strengthMeterStyle} aria-hidden="true">
        {[0, 1, 2, 3].map((barIndex) => (
          <div
            key={barIndex}
            style={{
              ...strengthBarStyle,
              background: barIndex < filledBars ? STRENGTH_BAR_COLOR[label] : 'var(--hairline)',
            }}
          />
        ))}
      </div>
      <span style={strengthLabelStyle}>Password strength: {label}</span>
    </div>
  );
};

interface AuthPasswordFieldProps {
  id: string;
  label: string;
  name: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  autoComplete: string;
  placeholder: string;
  error?: string;
  labelAccessory?: ReactNode;
  showStrength?: boolean;
}

export const AuthPasswordField = ({
  id,
  label,
  name,
  ariaLabel,
  value,
  onChange,
  showPassword,
  onToggleShowPassword,
  autoComplete,
  placeholder,
  error,
  labelAccessory,
  showStrength,
}: Readonly<AuthPasswordFieldProps>) => {
  const errorId = `${id}-error`;
  return (
    <div style={fieldGroupStyle}>
      <FieldLabel htmlFor={id} label={label} accessory={labelAccessory} />
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          name={name}
          className="yc-field"
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 46 }}
        />
        <button
          type="button"
          onClick={onToggleShowPassword}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          style={toggleButtonStyle}
        >
          {showPassword ? (
            <IoEyeOffOutline style={{ fontSize: 19 }} aria-hidden="true" />
          ) : (
            <IoEyeOutline style={{ fontSize: 19 }} aria-hidden="true" />
          )}
        </button>
      </div>
      {showStrength && value ? <PasswordStrengthMeter password={value} /> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
};

export const AuthSubmitButton = ({
  idle,
  busy,
  isSubmitting,
}: Readonly<{ idle: string; busy: string; isSubmitting: boolean }>) => (
  <button
    type="submit"
    className="yc-btn-primary"
    disabled={isSubmitting}
    style={submitButtonStyle}
  >
    {isSubmitting ? busy : idle}
    <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
  </button>
);

export const AuthAltNote = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div style={altNoteStyle}>
    <IoPhonePortraitOutline
      style={{ fontSize: 17, flex: 'none', color: 'var(--ink-faint2)' }}
      aria-hidden="true"
    />
    <span>{children}</span>
  </div>
);
