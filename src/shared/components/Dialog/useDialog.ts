import { useCallback } from 'react';
import { useDialogStore, type DialogConfig } from '@/stores/useDialogStore';

export function useDialog() {
  const show = useDialogStore((s) => s.show);
  const hide = useDialogStore((s) => s.hide);

  const showDialog = useCallback(
    (config: DialogConfig) => show(config),
    [show],
  );

  const hideDialog = useCallback(() => hide(), [hide]);

  const showAlert = useCallback(
    (title: string, message?: string, onClose?: () => void) => {
      show({
        title,
        message,
        buttons: [
          {
            label: 'OK',
            variant: 'primary',
            onPress: () => {
              onClose?.();
            },
          },
        ],
      });
    },
    [show],
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: {
        confirmLabel?: string;
        cancelLabel?: string;
        destructive?: boolean;
      },
    ) => {
      show({
        title,
        message,
        dismissOnBackdropPress: !options?.destructive,
        buttons: [
          {
            label: options?.cancelLabel ?? 'Cancel',
            variant: 'secondary',
          },
          {
            label: options?.confirmLabel ?? 'Confirm',
            variant: options?.destructive ? 'destructive' : 'primary',
            onPress: () => {
              onConfirm();
            },
          },
        ],
      });
    },
    [show],
  );

  return { showDialog, hideDialog, showAlert, showConfirm };
}
