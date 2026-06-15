import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MenuContextValue = {
  visible: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const openMenu = useCallback(() => setVisible(true), []);
  const closeMenu = useCallback(() => setVisible(false), []);
  const toggleMenu = useCallback(() => setVisible((v) => !v), []);

  const value = useMemo(
    () => ({ visible, openMenu, closeMenu, toggleMenu }),
    [visible, openMenu, closeMenu, toggleMenu],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('useMenu must be used within MenuProvider');
  return ctx;
}
