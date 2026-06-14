import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors, palette } from '../theme';
import { Logo } from '../components/Logo';
import { AuroraBackground } from '../components/AuroraBackground';
import { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { TabNavigator } from './TabNavigator';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.ink900,
    card: palette.ink900,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: palette.ink900 },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <AuroraBackground tone="green" />
      <Logo size={88} tint="white" />
      <ActivityIndicator color={colors.accentBright} style={{ marginTop: 28 }} />
    </View>
  );
}

export function RootNavigator() {
  const { session, initializing } = useAuth();

  return (
    <NavigationContainer theme={navTheme}>
      {initializing ? <SplashScreen /> : session ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: palette.abyss,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
