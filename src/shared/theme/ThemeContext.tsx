import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type AppColors } from './colors';
import { textPresets, fontFamily, fontWeight, fontSize, letterSpacing, fontStacks, resolveFontFamily, resolveFontRole, displayMinFontSize } from './typography';
import { spacing, inset, gap, layout } from './spacing';
import { radii, radius } from './radii';
import { shadows } from './shadows';
import { animations } from './animations';

const staticTokens = {
  typography: {
    textPresets,
    fontFamily,
    fontWeight,
    fontSize,
    letterSpacing,
    fontStacks,
    resolveFontFamily,
    resolveFontRole,
    displayMinFontSize,
  },
  fontStacks,
  resolveFontFamily,
  resolveFontRole,
  displayMinFontSize,
  fontWeight,
  spacing,
  inset,
  gap,
  layout,
  radii,
  radius,
  shadows,
  animations,
} as const;

export type StaticTokens = typeof staticTokens;

export type Theme = StaticTokens & {
  colors: AppColors;
  mode: 'light' | 'dark';
};

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = Theme & {
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;

  initialMode?: ThemeMode;
};

export function ThemeProvider({ children, initialMode = 'light' }: Props) {
  const systemScheme = useColorScheme();
  const [manualMode, setManualMode] = useState<ThemeMode>(initialMode);

  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (manualMode !== 'system') return manualMode;
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [manualMode, systemScheme]);

  const setMode = useCallback((next: ThemeMode) => setManualMode(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolvedMode === 'dark' ? darkColors : lightColors,
      mode: resolvedMode,
      ...staticTokens,
      setMode,
    }),
    [resolvedMode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be called inside <ThemeProvider>.');
  return ctx;
}

export function useColors(): AppColors {
  return useTheme().colors;
}

export function DarkThemeScope({ children }: { children: ReactNode }) {
  const parent = useTheme();
  const value = useMemo<ThemeContextValue>(
    () => ({
      ...parent,
      colors: darkColors,
      mode: 'dark',
    }),
    [parent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
