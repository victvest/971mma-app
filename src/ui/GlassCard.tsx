import React, { type ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Surface } from 'react-native-paper';
import { palette, shadow } from '../theme';

type Props = ComponentProps<typeof Surface> & {
  children: React.ReactNode;
};

/** White elevated card — React Native Paper surface with 971 radius + hairline. */
export function GlassCard({ children, style, elevation = 1, mode = 'elevated', ...rest }: Props) {
  return (
    <Surface style={[styles.surface, shadow.soft as object, style]} elevation={elevation} mode={mode} {...rest}>
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: palette.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.hairline,
    overflow: 'hidden',
  },
});
