import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ViewStyle as RNViewStyle } from 'react-native';

type UseCollapsingHeaderOptions = {
  expandedHeight: number;
  collapsedHeight?: number;
};

type CollapsingHeaderControls = {
  scrollY: { value: number };
  scrollHandler: object;
  collapsingStyle: RNViewStyle;
  navTitleStyle: RNViewStyle;
};

export function useCollapsingHeader({
  expandedHeight,
}: UseCollapsingHeaderOptions): CollapsingHeaderControls {
  return {
    scrollY: { value: 0 },
    scrollHandler: {},
    collapsingStyle: { height: expandedHeight, opacity: 1 },
    navTitleStyle: { opacity: 0 },
  };
}

type CollapsingHeaderProps = {
  header: ReactNode;
  navBar: ReactNode;
  expandedHeight: number;
  collapsedHeight?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function CollapsingHeader({
  header,
  expandedHeight,
  children,
  style,
  contentContainerStyle,
}: CollapsingHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={{ height: expandedHeight }}>{header}</View>
      <ScrollView contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
