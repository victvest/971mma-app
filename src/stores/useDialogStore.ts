import type { ReactNode } from 'react';
import { create } from 'zustand';

export type DialogButtonVariant = 'primary' | 'secondary' | 'destructive';

export type DialogButton = {
  label: string;

  variant?: DialogButtonVariant;

  onPress?: () => void;
};

export type DialogConfig = {
  title: string;

  message?: string;

  children?: ReactNode;

  buttons: [DialogButton] | [DialogButton, DialogButton];

  dismissOnBackdropPress?: boolean;

  useBlurBackground?: boolean;

  onClose?: () => void;
};

type DialogStore = {
  config: DialogConfig | null;
  visible: boolean;
  show: (config: DialogConfig) => void;
  hide: () => void;

  _afterHide: () => void;
};

export const useDialogStore = create<DialogStore>((set) => ({
  config: null,
  visible: false,
  show: (config) => set({ config, visible: true }),
  hide: () => set({ visible: false }),
  _afterHide: () => set({ config: null }),
}));
