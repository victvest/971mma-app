import 'react-native-gesture-handler';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuroraBackground } from './src/components/AuroraBackground';
import { Logo } from './src/components/Logo';
import { fontAssets, palette } from './src/theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || !!fontError;

  const renderBoot = useCallback(
    () => (
      <View style={styles.boot}>
        <AuroraBackground tone="green" />
        <Logo size={88} tint="white" />
      </View>
    ),
    [],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {ready ? (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        ) : (
          renderBoot()
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink900 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.abyss,
  },
});
