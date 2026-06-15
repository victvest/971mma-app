import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors, palette } from '../theme';
import { LaunchSplash } from '../components/LaunchSplash';
import { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { MainStack } from './MainStack';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
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
  return <LaunchSplash message="Signing you in…" />;
}

export function RootNavigator() {
  const { session, initializing } = useAuth();
  const previewTabs = process.env.EXPO_PUBLIC_PREVIEW_TABS === '1';

  return (
    <NavigationContainer theme={navTheme}>
      {previewTabs ? (
        <MainStack />
      ) : initializing ? (
        <SplashScreen />
      ) : session ? (
        <MainStack />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
