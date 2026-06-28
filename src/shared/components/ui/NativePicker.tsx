import React from 'react';
import { Host, Picker } from '@expo/ui';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onValueChange: (value: T) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export function NativePicker<T extends string>({
  label,
  value,
  options,
  onValueChange,
  containerStyle,
}: Props<T>) {
  const { colors, radius, inset } = useTheme();

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <Host matchContents style={{ alignSelf: 'stretch' }}>
        <View
          style={{
            minHeight: 44,
            borderRadius: radius.input,
            borderWidth: 1.5,
            borderColor: colors.border.default,
            backgroundColor: colors.surface.secondary,
            paddingHorizontal: inset.md,
            justifyContent: 'center',
          }}
        >
          <Picker selectedValue={value} onValueChange={onValueChange} appearance="menu">
            {options.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
});
