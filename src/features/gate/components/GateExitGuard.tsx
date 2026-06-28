import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  gateExitPinRequiresSetup,
  validateGateExitPin,
} from '@/features/gate/utils/gateExitPin';
import { Button } from '@/shared/components/ui/Button';
import { triggerLightImpact, triggerMediumImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type GateExitContextValue = {
  requestExit: () => void;
};

const GateExitContext = createContext<GateExitContextValue | null>(null);

export function useGateExit(): GateExitContextValue {
  const value = useContext(GateExitContext);
  if (!value) {
    throw new Error('useGateExit must be used within GateExitGuard');
  }
  return value;
}

type Props = {
  children: React.ReactNode;
};

type ExitStep = 'idle' | 'confirm' | 'unconfigured';

const EXIT_LONG_PRESS_MS = 3000;

export function GateExitGuard({ children }: Props) {
  const { colors, typography, inset, radius, gap } = useTheme();
  const { signOut } = useAuth();
  const [step, setStep] = useState<ExitStep>('idle');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetModal = useCallback(() => {
    setStep('idle');
    setPin('');
    setError(null);
    setBusy(false);
  }, []);

  const requestExit = useCallback(() => {
    triggerLightImpact();
    void (async () => {
      try {
        const needsAdminPin = await gateExitPinRequiresSetup();
        setStep(needsAdminPin ? 'unconfigured' : 'confirm');
        setPin('');
        setError(null);
      } catch {
        setStep('unconfigured');
        setError('Unable to verify exit PIN settings. Check the connection and try again.');
      }
    })();
  }, []);

  const handleExit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const valid = await validateGateExitPin(pin);
      if (!valid) {
        triggerMediumImpact();
        setError('Incorrect PIN.');
        setBusy(false);
        return;
      }
      resetModal();
      await signOut();
    } catch {
      setError('Unable to exit. Try again.');
      setBusy(false);
    }
  }, [pin, resetModal, signOut]);

  const visible = step !== 'idle';

  const title =
    step === 'unconfigured' ? 'Exit PIN not configured' : 'Exit gate mode?';

  const message =
    step === 'unconfigured'
      ? 'An admin must set the gate exit PIN in the admin panel before this tablet can sign out.'
      : 'Enter the gate PIN to sign out and leave display mode.';

  return (
    <GateExitContext.Provider value={{ requestExit }}>
      <View style={styles.root}>
        {children}

        <Pressable
          accessibilityLabel="Exit gate mode"
          accessibilityHint="Long press for three seconds to exit"
          delayLongPress={EXIT_LONG_PRESS_MS}
          onLongPress={requestExit}
          style={styles.exitHotZone}
        />

        <Modal visible={visible} transparent animationType="fade" onRequestClose={resetModal}>
          <View style={[styles.backdrop, { backgroundColor: colors.background.overlay }]}>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.background.elevated,
                  borderRadius: radius.modal,
                  padding: inset.lg,
                  gap: gap.md,
                },
              ]}
            >
              <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
                {title}
              </Text>
              <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                {message}
              </Text>

              {step === 'confirm' ? (
                <TextInput
                  value={pin}
                  onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={colors.text.tertiary}
                  accessibilityLabel="Exit PIN"
                  style={[
                    styles.input,
                    {
                      borderColor: colors.border.default,
                      borderRadius: radius.input,
                      color: colors.text.primary,
                      backgroundColor: colors.background.primary,
                    },
                  ]}
                />
              ) : null}

              {error ? (
                <Text style={[typography.textPresets.footnote, { color: colors.status.error }]}>
                  {error}
                </Text>
              ) : null}

              <View style={[styles.actions, { gap: gap.sm }]}>
                <Button label="Cancel" variant="secondary" onPress={resetModal} disabled={busy} />
                {step === 'confirm' ? (
                  <Button
                    label="Sign out"
                    variant="primary"
                    onPress={handleExit}
                    loading={busy}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GateExitContext.Provider>
  );
}

export const GATE_EXIT_LONG_PRESS_MS = EXIT_LONG_PRESS_MS;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  exitHotZone: {
    bottom: 0,
    height: 72,
    position: 'absolute',
    right: 0,
    width: 72,
  },
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    maxWidth: 420,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
