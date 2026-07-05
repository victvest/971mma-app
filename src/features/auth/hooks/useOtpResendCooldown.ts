import { useCallback, useEffect, useState } from 'react';

export const OTP_RESEND_COOLDOWN_SEC = 30;

export function useOtpResendCooldown() {
  const [cooldownSec, setCooldownSec] = useState(0);
  const [showResentConfirmation, setShowResentConfirmation] = useState(false);

  useEffect(() => {
    if (cooldownSec <= 0) return undefined;

    const timer = setInterval(() => {
      setCooldownSec((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSec]);

  const startCooldown = useCallback(() => {
    setCooldownSec(OTP_RESEND_COOLDOWN_SEC);
    setShowResentConfirmation(true);
  }, []);

  const dismissResentConfirmation = useCallback(() => {
    setShowResentConfirmation(false);
  }, []);

  return {
    cooldownSec,
    canResend: cooldownSec <= 0,
    startCooldown,
    showResentConfirmation,
    dismissResentConfirmation,
  };
}
