import React, { type ComponentProps } from 'react';
import { Button } from 'react-native-paper';
import { palette } from '../theme';

type Props = ComponentProps<typeof Button>;

/** Primary CTA — solid UAE green, no gradient blend. */
export function BrandButton({ mode = 'contained', style, contentStyle, ...rest }: Props) {
  return (
    <Button
      mode={mode}
      style={[{ borderRadius: 999 }, style]}
      contentStyle={[{ height: 44 }, contentStyle]}
      buttonColor={mode === 'contained' ? palette.green : undefined}
      textColor={mode === 'contained' ? '#fff' : palette.green}
      {...rest}
    />
  );
}

/** Secondary / ink action. */
export function InkButton({ mode = 'contained', style, contentStyle, ...rest }: Props) {
  return (
    <Button
      mode={mode}
      style={[{ borderRadius: 999 }, style]}
      contentStyle={[{ height: 44 }, contentStyle]}
      buttonColor={mode === 'contained' ? palette.black : undefined}
      textColor={mode === 'contained' ? '#fff' : palette.black}
      {...rest}
    />
  );
}

/** Alert / live accent — blood red solid. */
export function AccentRedButton({ mode = 'contained', style, contentStyle, ...rest }: Props) {
  return (
    <Button
      mode={mode}
      style={[{ borderRadius: 999 }, style]}
      contentStyle={[{ height: 44 }, contentStyle]}
      buttonColor={mode === 'contained' ? palette.red : undefined}
      textColor={mode === 'contained' ? '#fff' : palette.red}
      {...rest}
    />
  );
}
