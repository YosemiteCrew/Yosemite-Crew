import { useCallback, useEffect, useRef, useState } from 'react';

const OTP_LENGTH = 6;

/**
 * State and keyboard handling for a segmented one-time-code input:
 * one digit per box, auto-advance on entry, backspace/arrow navigation.
 */
export const useOtpCodeInput = (onDigitEntered?: () => void) => {
  const [code, setCode] = useState<string[]>(() => new Array(OTP_LENGTH).fill(''));
  const [activeInput, setActiveInput] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setOtpRef = useCallback((el: HTMLInputElement | null, idx: number) => {
    otpRefs.current[idx] = el;
  }, []);

  const resetCode = useCallback((focusFirst = false) => {
    setCode(new Array(OTP_LENGTH).fill(''));
    if (focusFirst) setActiveInput(0);
  }, []);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
      const val = e.target.value.replaceAll(/\D/g, '');
      if (!val) return;
      setCode((prev) => {
        const next = [...prev];
        next[idx] = val[0];
        return next;
      });
      onDigitEntered?.();
      if (idx < OTP_LENGTH - 1) {
        otpRefs.current[idx + 1]?.focus();
        setActiveInput(idx + 1);
      }
    },
    [onDigitEntered]
  );

  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
      if (e.key === 'Backspace') {
        if (code[idx]) {
          setCode((prev) => {
            const next = [...prev];
            next[idx] = '';
            return next;
          });
        } else if (idx > 0) {
          otpRefs.current[idx - 1]?.focus();
          setActiveInput(idx - 1);
        }
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        otpRefs.current[idx - 1]?.focus();
        setActiveInput(idx - 1);
      } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
        otpRefs.current[idx + 1]?.focus();
        setActiveInput(idx + 1);
      }
    },
    [code]
  );

  useEffect(() => {
    otpRefs.current[activeInput]?.focus();
  }, [activeInput]);

  return { code, handleCodeChange, handleCodeKeyDown, resetCode, setOtpRef };
};
